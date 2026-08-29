use crate::error::{Code, SerenadeError};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HandContract {
    Legacy06,
    Transition07,
    V08Unadapted,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HandCompatibility {
    pub contract: HandContract,
    pub mutations_allowed: bool,
    pub reason: &'static str,
}

fn parse_version(raw: &str) -> Option<(u64, u64, u64)> {
    raw.split(|c: char| !(c.is_ascii_digit() || c == '.'))
        .filter(|token| !token.is_empty())
        .find_map(|token| {
            let mut parts = token.split('.');
            let major = parts.next()?.parse().ok()?;
            let minor = parts.next()?.parse().ok()?;
            let patch = parts.next()?.parse().ok()?;
            if parts.next().is_some() {
                return None;
            }
            Some((major, minor, patch))
        })
}

pub fn classify(raw: &str) -> HandCompatibility {
    let Some((major, minor, _patch)) = parse_version(raw) else {
        return HandCompatibility {
            contract: HandContract::Unknown,
            mutations_allowed: false,
            reason: "Could not identify the Hand version; workflow mutations are disabled.",
        };
    };

    match (major, minor) {
        (0, 6) => HandCompatibility {
            contract: HandContract::Legacy06,
            mutations_allowed: true,
            reason: "Verified legacy Hand 0.6 integration.",
        },
        (0, 7) => HandCompatibility {
            contract: HandContract::Transition07,
            mutations_allowed: false,
            reason: "Hand 0.7 is a transition contract that has not been release-qualified by Serenade yet.",
        },
        (0, m) if m >= 8 => HandCompatibility {
            contract: HandContract::V08Unadapted,
            mutations_allowed: false,
            reason: "Hand 0.8+ requires Serenade's canonical 0.8 adapter before workflow mutations are safe.",
        },
        (0, m) if m <= 5 => HandCompatibility {
            contract: HandContract::Unknown,
            mutations_allowed: false,
            reason: "This Hand version predates Serenade's minimum supported 0.6 contract.",
        },
        _ => HandCompatibility {
            contract: HandContract::Unknown,
            mutations_allowed: false,
            reason: "This Hand contract is not verified by Serenade; workflow mutations are disabled.",
        },
    }
}

pub fn require_mutations(raw: &str) -> Result<HandCompatibility, SerenadeError> {
    let compatibility = classify(raw);
    if compatibility.mutations_allowed {
        return Ok(compatibility);
    }

    Err(SerenadeError::new(
        Code::UnsupportedCapability,
        "Hand contract not mutation-safe",
        compatibility.reason,
    )
    .with_detail(format!("Detected: {}", raw.trim()))
    .with_action(
        "Use Serenade read-only views, or switch to the verified Hand 0.6 release until this contract is qualified.",
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_release_output_with_prefixes() {
        assert_eq!(parse_version("hand v0.6.0 (abc123)"), Some((0, 6, 0)));
        assert_eq!(parse_version("Secondhand 0.7.2"), Some((0, 7, 2)));
    }

    #[test]
    fn only_verified_06_allows_mutations() {
        assert!(classify("hand 0.6.0").mutations_allowed);
        assert!(!classify("hand 0.7.0").mutations_allowed);
        assert!(!classify("hand 0.8.0").mutations_allowed);
        assert!(!classify("hand 1.0.0").mutations_allowed);
        assert!(!classify("development build").mutations_allowed);
    }

    #[test]
    fn identifies_transition_and_v08_contracts() {
        assert_eq!(classify("0.7.4").contract, HandContract::Transition07);
        assert_eq!(classify("0.8.0").contract, HandContract::V08Unadapted);
        assert_eq!(classify("0.10.1").contract, HandContract::V08Unadapted);
    }
}
