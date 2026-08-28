use crate::error::SerenadeError;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::Duration;
use wait_timeout::ChildExt;

/// CREATE_NO_WINDOW: GUI apps must not flash a console for every short-lived
/// subprocess (hand, git) they spawn.
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[cfg(windows)]
fn no_window(cmd: &mut Command) {
    use std::os::windows::process::CommandExt;
    cmd.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(windows))]
fn no_window(_cmd: &mut Command) {}

/// A parsed hand error document:
/// ```text
/// error: <message>
/// kind: <kind>
/// exit: <code>
/// help[N]:
///   - <step>
/// ```
#[derive(Debug, Clone, Default)]
pub struct HandErrorDoc {
    pub message: String,
    pub kind: String,
    pub exit: i32,
    pub help: Vec<String>,
    pub raw: String,
}

impl HandErrorDoc {
    pub fn parse(stderr: &str) -> Self {
        let mut doc = HandErrorDoc {
            raw: stderr.trim().to_string(),
            ..Default::default()
        };
        for line in stderr.lines() {
            let line = line.trim();
            if let Some(msg) = line.strip_prefix("error:") {
                doc.message = msg.trim().to_string();
            } else if let Some(kind) = line.strip_prefix("kind:") {
                doc.kind = kind.trim().to_string();
            } else if let Some(exit) = line.strip_prefix("exit:") {
                doc.exit = exit.trim().parse().unwrap_or(1);
            } else if let Some(step) = line.strip_prefix("- ") {
                doc.help.push(step.trim().to_string());
            }
        }
        doc
    }

    /// Map a hand error document onto the typed Serenade error model.
    pub fn into_serenade(self, command: &str) -> SerenadeError {
        let message = if self.message.is_empty() {
            format!("`hand {command}` failed")
        } else {
            self.message.clone()
        };
        let detail = if self.raw.is_empty() { None } else { Some(self.raw.clone()) };
        let action = self.help.first().cloned();

        // Message-based refinement for common precondition failures.
        let lower = self.message.to_lowercase();
        let err = if lower.contains("not inside a secondhand home") {
            SerenadeError::invalid_fleet(self.raw.clone())
        } else if lower.contains("task") && lower.contains("not found") {
            SerenadeError::task_not_found(&self.message)
        } else {
            let title = if self.kind.is_empty() {
                format!("hand {command} error")
            } else {
                format!("hand {}", self.kind)
            };
            SerenadeError::new(crate::error::Code::CommandFailed, &title, message)
                .with_detail(detail.unwrap_or_default())
        };
        let err = if let Some(action) = action {
            err.with_action(&action)
        } else {
            err
        };
        // usage errors and preconditions are actionable by the operator
        err
    }
}

pub struct HandRunner {
    pub binary: String,
    pub fleet_home: Option<PathBuf>,
}

impl HandRunner {
    /// Run and capture stdout+stderr together with the exit status.
    /// Fixed argument construction only — never a shell string (architecture.md §11).
    pub fn capture(
        &self,
        args: &[&str],
        timeout_secs: u64,
    ) -> Result<Result<String, HandErrorDoc>, SerenadeError> {
        let mut cmd = Command::new(&self.binary);
        cmd.args(args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .stdin(Stdio::null());
        no_window(&mut cmd);

        if let Some(home) = &self.fleet_home {
            cmd.env("HAND_HOME", absolutize(home));
        }

        let mut child = match cmd.spawn() {
            Ok(c) => c,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                return Err(SerenadeError::hand_not_found());
            }
            Err(e) => {
                return Err(SerenadeError::new(
                    crate::error::Code::HandNotFound,
                    "Could not launch hand",
                    format!("Failed to execute {}: {}", self.binary, e),
                ));
            }
        };

        let wait = Duration::from_secs(timeout_secs);
        match child.wait_timeout(wait) {
            Ok(Some(status)) => {
                // Drain pipes after exit.
                let output = child.wait_with_output().map_err(|e| {
                    SerenadeError::new(
                        crate::error::Code::CommandFailed,
                        "hand output unreadable",
                        e.to_string(),
                    )
                })?;
                let stdout = String::from_utf8_lossy(&output.stdout).into_owned();
                let stderr = String::from_utf8_lossy(&output.stderr).into_owned();
                if status.success() {
                    Ok(Ok(stdout))
                } else {
                    Ok(Err(HandErrorDoc::parse(&stderr)))
                }
            }
            Ok(None) => {
                let _ = child.kill();
                let _ = child.wait();
                Err(SerenadeError::new(
                    crate::error::Code::CommandFailed,
                    "hand timed out",
                    format!("`hand {}` did not finish within {timeout_secs}s.", args.join(" ")),
                ))
            }
            Err(e) => Err(SerenadeError::new(
                crate::error::Code::CommandFailed,
                "hand failed",
                e.to_string(),
            )),
        }
    }

    /// Run expecting success and returning stdout; maps failures to SerenadeError.
    pub fn expect(&self, args: &[&str], timeout_secs: u64) -> Result<String, SerenadeError> {
        match self.capture(args, timeout_secs)? {
            Ok(stdout) => Ok(stdout),
            Err(doc) => Err(doc.into_serenade(args.first().unwrap_or(&""))),
        }
    }

    /// Run expecting JSON output.
    pub fn json<T: serde::de::DeserializeOwned>(
        &self,
        args: &[&str],
        timeout_secs: u64,
    ) -> Result<T, SerenadeError> {
        let stdout = self.expect(args, timeout_secs)?;
        serde_json::from_str(&stdout).map_err(|e| {
            SerenadeError::new(
                crate::error::Code::ParseFailed,
                "hand returned an unexpected format",
                format!("Could not parse JSON from `hand {}`: {}", args.join(" "), e),
            )
            .with_detail(stdout.chars().take(2000).collect::<String>())
            .with_action("Open Diagnostics to inspect the raw response; the hand version may be newer than expected.")
        })
    }
}

fn absolutize(path: &Path) -> PathBuf {
    if path.is_absolute() {
        path.to_path_buf()
    } else {
        std::env::current_dir()
            .unwrap_or_else(|_| PathBuf::from("."))
            .join(path)
    }
}
