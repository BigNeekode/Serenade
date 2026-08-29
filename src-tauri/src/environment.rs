//! Read-only environment inspector for Quick Setup.
//!
//! This module discovers platform, Git, Hand, the Supervisor Harness, and Fleet
//! health without mutating files or configuration. It is the single source of
//! truth used by the first-run wizard and by Settings → Environment.

use crate::config::AppConfig;
use crate::domain::{EnvironmentPlatform, EnvironmentStatus, FleetHealth, ToolOwnership, ToolState, ToolStatus};
use crate::hand::compatibility;
use std::cmp::Ordering;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct ParsedVersion {
    major: u64,
    minor: u64,
    patch: u64,
}

impl Ord for ParsedVersion {
    fn cmp(&self, other: &Self) -> Ordering {
        self.major
            .cmp(&other.major)
            .then_with(|| self.minor.cmp(&other.minor))
            .then_with(|| self.patch.cmp(&other.patch))
    }
}

impl PartialOrd for ParsedVersion {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

fn parse_version(raw: &str) -> Option<ParsedVersion> {
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
            Some(ParsedVersion { major, minor, patch })
        })
}

/// Filesystem/exec probes abstracted so tests can supply fakes.
pub trait EnvironmentProbes: Send + Sync {
    /// Return the absolute path to an executable if it exists and is executable.
    fn find_executable(&self, name: &str) -> Option<PathBuf>;
    /// Read the first line of `--version` output for an executable.
    fn version_line(&self, path: &Path) -> Option<String>;
    /// List entries inside a directory.
    fn list_dir(&self, path: &Path) -> Vec<PathBuf>;
    /// True if the path exists and is a directory.
    fn is_dir(&self, path: &Path) -> bool;
    /// True if the path exists and is a file.
    fn is_file(&self, path: &Path) -> bool;
    /// True if the parent directory is writable (best-effort).
    fn parent_writable(&self, path: &Path) -> bool;
}

/// Production probes that delegate to the real host.
#[derive(Clone)]
pub struct HostProbes;

impl HostProbes {
    pub fn new() -> Self {
        Self
    }
}

impl EnvironmentProbes for HostProbes {
    fn find_executable(&self, name: &str) -> Option<PathBuf> {
        which::which(name).ok()
    }

    fn version_line(&self, path: &Path) -> Option<String> {
        let output = std::process::Command::new(path)
            .arg("--version")
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .stdin(std::process::Stdio::null())
            .output()
            .ok()?;
        if !output.status.success() {
            return None;
        }
        let stdout = String::from_utf8_lossy(&output.stdout);
        stdout.lines().next().map(str::to_string)
    }

    fn list_dir(&self, path: &Path) -> Vec<PathBuf> {
        std::fs::read_dir(path)
            .ok()
            .map(|iter| {
                iter.filter_map(|e| e.ok().map(|e| e.path()))
                    .collect()
            })
            .unwrap_or_default()
    }

    fn is_dir(&self, path: &Path) -> bool {
        path.is_dir()
    }

    fn is_file(&self, path: &Path) -> bool {
        path.is_file()
    }

    fn parent_writable(&self, path: &Path) -> bool {
        path.parent()
            .map(|p| {
                // Best-effort: try to create a temp file. Ignore errors.
                let probe = p.join(format!(".serenade-write-test-{}-tmp", std::process::id()));
                if std::fs::File::create(&probe).is_ok() {
                    let _ = std::fs::remove_file(&probe);
                    true
                } else {
                    false
                }
            })
            .unwrap_or(false)
    }
}

/// Inspector that builds a complete environment status from config + host state.
pub struct EnvironmentInspector<P: EnvironmentProbes> {
    probes: P,
    managed_root: PathBuf,
}

impl<P: EnvironmentProbes> EnvironmentInspector<P> {
    pub fn new(probes: P, managed_root: PathBuf) -> Self {
        Self { probes, managed_root }
    }

    pub fn scan(&self, config: &AppConfig) -> EnvironmentStatus {
        let platform = self.platform();
        let git = self.scan_git(config);
        let hand = self.scan_hand(config);
        let supervisor = self.scan_supervisor(config);
        let fleet = self.scan_fleet(config);

        let tools = vec![git, hand, supervisor];
        let ready = tools.iter().all(|t| !t.required || t.state == ToolState::Ready)
            && fleet.state == ToolState::Ready;

        let mut issues = Vec::new();
        for tool in &tools {
            if tool.required && tool.state != ToolState::Ready {
                issues.push(format!("{}: {}", tool.label, tool.message.clone().unwrap_or_default()));
            }
        }
        if fleet.state != ToolState::Ready {
            issues.push(format!(
                "Fleet: {}",
                fleet.message.clone().unwrap_or_else(|| "not ready".to_string())
            ));
        }

        EnvironmentStatus {
            platform,
            tools,
            fleet,
            ready,
            issues,
            setup_completed: None,
        }
    }

    fn platform(&self) -> EnvironmentPlatform {
        EnvironmentPlatform {
            os: std::env::consts::OS.to_string(),
            arch: std::env::consts::ARCH.to_string(),
        }
    }

    fn scan_git(&self, _config: &AppConfig) -> ToolStatus {
        match self.probes.find_executable("git") {
            Some(path) => {
                let version = self.probes.version_line(&path);
                // Git is detect-only for the MVP; we just need it present.
                let state = if version.is_some() { ToolState::Ready } else { ToolState::Unhealthy };
                ToolStatus {
                    id: "git".to_string(),
                    label: "Git".to_string(),
                    required: true,
                    ownership: Some(ToolOwnership::System),
                    path: Some(path.to_string_lossy().into_owned()),
                    version,
                    state,
                    compatible: Some(state == ToolState::Ready),
                    message: if state == ToolState::Ready {
                        Some("System Git detected.".to_string())
                    } else {
                        Some("Git executable found but --version failed.".to_string())
                    },
                    suggested_action: None,
                    capabilities: vec!["version-control".to_string()],
                }
            }
            None => ToolStatus {
                id: "git".to_string(),
                label: "Git".to_string(),
                required: true,
                state: ToolState::Missing,
                ownership: None,
                path: None,
                version: None,
                compatible: Some(false),
                message: Some("Git was not found on PATH.".to_string()),
                suggested_action: Some("Install Git from https://git-scm.com or add it to PATH.".to_string()),
                capabilities: vec!["version-control".to_string()],
            },
        }
    }

    fn scan_hand(&self, config: &AppConfig) -> ToolStatus {
        // Precedence: explicit custom path > managed install > system PATH.
        // A bare "hand" is the default placeholder, not an explicit custom path.
        let configured = config.hand_binary_path.trim();
        let is_default_placeholder = configured == "hand" || configured.is_empty();

        let candidate = if !is_default_placeholder {
            let path = PathBuf::from(configured);
            if self.probes.is_file(&path) {
                // A configured path that lives inside Serenade's managed tool
                // root is a managed install, not an operator-supplied custom path.
                let ownership = if path.starts_with(&self.managed_root) {
                    ToolOwnership::Managed
                } else {
                    ToolOwnership::Custom
                };
                Some((ownership, path))
            } else {
                // Try PATH as a fallback for bare names.
                self.probes
                    .find_executable(configured)
                    .map(|path| (ToolOwnership::Custom, path))
            }
        } else {
            None
        };

        let candidate = candidate.or_else(|| {
            self.find_managed_hand()
                .map(|path| (ToolOwnership::Managed, path))
        });

        let candidate = candidate.or_else(|| {
            self.probes
                .find_executable("hand")
                .map(|path| (ToolOwnership::System, path))
        });

        let Some((ownership, path)) = candidate else {
            return ToolStatus {
                id: "hand".to_string(),
                label: "Secondhand / hand".to_string(),
                required: true,
                state: ToolState::Missing,
                ownership: None,
                path: None,
                version: None,
                compatible: Some(false),
                message: Some("No Hand executable found.".to_string()),
                suggested_action: Some(
                    "Use Quick Setup to install a managed version, or set a system/custom Hand path.".to_string(),
                ),
                capabilities: vec!["fleet".to_string()],
            };
        };

        let version = self.probes.version_line(&path);
        let compatibility = version.as_deref().map(compatibility::classify);
        let (state, compatible, message, action) = match &compatibility {
            Some(c) if c.mutations_allowed => (
                ToolState::Ready,
                Some(true),
                Some(format!("{} qualified.", c.reason)),
                None,
            ),
            Some(c) => (
                ToolState::Incompatible,
                Some(false),
                Some(format!("Detected Hand is not mutation-compatible: {}", c.reason)),
                Some("Switch to a verified Hand 0.6.x executable.".to_string()),
            ),
            None => (
                ToolState::Unhealthy,
                Some(false),
                Some("Could not determine Hand version from --version output.".to_string()),
                Some("Verify the Hand executable is healthy.".to_string()),
            ),
        };

        ToolStatus {
            id: "hand".to_string(),
            label: "Secondhand / hand".to_string(),
            required: true,
            ownership: Some(ownership),
            path: Some(path.to_string_lossy().into_owned()),
            version,
            state,
            compatible,
            message,
            suggested_action: action,
            capabilities: vec!["fleet".to_string()],
        }
    }

    fn find_managed_hand(&self) -> Option<PathBuf> {
        let hand_root = self.managed_root.join("tools").join("hand");
        if !self.probes.is_dir(&hand_root) {
            return None;
        }
        // Look for <version>/hand(.exe).
        let mut candidates: Vec<(ParsedVersion, PathBuf)> = Vec::new();
        for entry in self.probes.list_dir(&hand_root) {
            if !self.probes.is_dir(&entry) {
                continue;
            }
            let version_name = entry.file_name()?.to_string_lossy().into_owned();
            let Some(version) = parse_version(&version_name) else {
                continue;
            };
            let binary_name = if std::env::consts::OS == "windows" {
                "hand.exe"
            } else {
                "hand"
            };
            let binary = entry.join(binary_name);
            if self.probes.is_file(&binary) {
                candidates.push((version, binary));
            }
        }
        candidates.sort_by(|a, b| b.0.cmp(&a.0));
        candidates.into_iter().next().map(|(_, p)| p)
    }

    fn scan_supervisor(&self, config: &AppConfig) -> ToolStatus {
        // Only OpenCode is qualified today.
        if config.supervisor_harness.trim() != "opencode" {
            return ToolStatus {
                id: "supervisor".to_string(),
                label: "Serenade Supervisor".to_string(),
                required: false,
                state: ToolState::ConfigurationRequired,
                ownership: None,
                path: None,
                version: None,
                compatible: Some(false),
                message: Some(format!(
                    "Configured supervisor harness '{}' is not qualified.",
                    config.supervisor_harness
                )),
                suggested_action: Some("Select OpenCode as the Supervisor Harness, or skip Supervisor setup.".to_string()),
                capabilities: vec!["supervisor-chat".to_string()],
            };
        }

        let candidate = self
            .probes
            .find_executable("opencode")
            .map(|path| (ToolOwnership::System, path));

        let Some((ownership, path)) = candidate else {
            return ToolStatus {
                id: "supervisor".to_string(),
                label: "Serenade Supervisor (OpenCode)".to_string(),
                required: false,
                state: ToolState::Missing,
                ownership: None,
                path: None,
                version: None,
                compatible: Some(false),
                message: Some("OpenCode was not found on PATH.".to_string()),
                suggested_action: Some(
                    "Install OpenCode or skip Supervisor setup; core Serenade does not require it.".to_string(),
                ),
                capabilities: vec!["supervisor-chat".to_string()],
            };
        };

        let version = self.probes.version_line(&path);
        let state = if version.is_some() { ToolState::Installed } else { ToolState::Unhealthy };
        // Authentication readiness is not reliably probeable headlessly; let the
        // user complete the provider flow if needed.
        ToolStatus {
            id: "supervisor".to_string(),
            label: "Serenade Supervisor (OpenCode)".to_string(),
            required: false,
            ownership: Some(ownership),
            path: Some(path.to_string_lossy().into_owned()),
            version,
            state,
            compatible: Some(state == ToolState::Installed),
            message: if state == ToolState::Installed {
                Some("OpenCode executable found. Complete provider authentication if prompted.".to_string())
            } else {
                Some("OpenCode executable found but --version failed.".to_string())
            },
            suggested_action: None,
            capabilities: vec!["supervisor-chat".to_string()],
        }
    }

    fn scan_fleet(&self, config: &AppConfig) -> FleetHealth {
        let path = config.fleet_path.as_ref().filter(|p| !p.trim().is_empty());
        let Some(path_str) = path else {
            return FleetHealth {
                path: None,
                state: ToolState::Missing,
                message: Some("No Fleet path configured.".to_string()),
            };
        };

        let path = PathBuf::from(path_str);
        if !self.probes.is_dir(&path) {
            return FleetHealth {
                path: Some(path_str.clone()),
                state: ToolState::Missing,
                message: Some("Fleet path does not exist.".to_string()),
            };
        }

        let has_db = self.probes.is_dir(&path.join("state"))
            && self.probes.is_file(&path.join("state").join("hand.db"));
        let legacy = self.probes.is_file(&path.join("data").join("projects.md"))
            && self.probes.is_dir(&path.join("state"));

        if has_db || legacy {
            FleetHealth {
                path: Some(path_str.clone()),
                state: ToolState::Ready,
                message: Some("Valid Fleet home detected.".to_string()),
            }
        } else {
            FleetHealth {
                path: Some(path_str.clone()),
                state: ToolState::ConfigurationRequired,
                message: Some("Directory exists but is not a Hand Fleet (no state/hand.db).".to_string()),
            }
        }
    }
}

/// Locate the highest-versioned managed Hand binary under the managed root,
/// using the real host filesystem (no probe abstraction).
pub fn find_managed_hand_path(managed_root: &Path) -> Option<PathBuf> {
    let hand_root = managed_root.join("tools").join("hand");
    if !hand_root.is_dir() {
        return None;
    }
    let binary_name = if std::env::consts::OS == "windows" {
        "hand.exe"
    } else {
        "hand"
    };
    let mut candidates: Vec<(ParsedVersion, PathBuf)> = Vec::new();
    let entries = std::fs::read_dir(&hand_root).ok()?;
    for entry in entries.filter_map(|e| e.ok()) {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let Some(version_name) = path.file_name().map(|n| n.to_string_lossy().into_owned()) else {
            continue;
        };
        let Some(version) = parse_version(&version_name) else {
            continue;
        };
        let binary = path.join(binary_name);
        if binary.is_file() {
            candidates.push((version, binary));
        }
    }
    candidates.sort_by(|a, b| b.0.cmp(&a.0));
    candidates.into_iter().next().map(|(_, p)| p)
}

/// Resolve the Hand executable that should actually be run, applying the same
/// precedence the environment scan uses: explicit custom path > managed install
/// > system PATH. Returns the resolved absolute path where possible, otherwise
/// falls back to the configured string so the runner can report a clean error.
pub fn resolve_hand_binary(configured: &str, managed_root: &Path) -> PathBuf {
    let configured = configured.trim();
    let is_placeholder = configured == "hand" || configured.is_empty();

    if !is_placeholder {
        let path = PathBuf::from(configured);
        if path.is_file() {
            return path;
        }
        if let Ok(resolved) = which::which(configured) {
            return resolved;
        }
        return path;
    }

    if let Some(managed) = find_managed_hand_path(managed_root) {
        return managed;
    }
    if let Ok(system) = which::which("hand") {
        return system;
    }
    PathBuf::from("hand")
}

/// Convenience entry point for the Tauri command using real host probes.
pub fn scan_environment(config: &AppConfig, managed_root: PathBuf) -> EnvironmentStatus {
    EnvironmentInspector::new(HostProbes::new(), managed_root).scan(config)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::{HashMap, HashSet};

    struct FakeProbes {
        executables: HashMap<String, PathBuf>,
        versions: HashMap<PathBuf, String>,
        dirs: HashMap<PathBuf, Vec<PathBuf>>,
        dir_set: HashSet<PathBuf>,
        file_set: HashSet<PathBuf>,
        writable_parents: HashSet<PathBuf>,
    }

    impl FakeProbes {
        fn new() -> Self {
            Self {
                executables: HashMap::new(),
                versions: HashMap::new(),
                dirs: HashMap::new(),
                dir_set: HashSet::new(),
                file_set: HashSet::new(),
                writable_parents: HashSet::new(),
            }
        }
    }

    impl EnvironmentProbes for FakeProbes {
        fn find_executable(&self, name: &str) -> Option<PathBuf> {
            self.executables.get(name).cloned()
        }

        fn version_line(&self, path: &Path) -> Option<String> {
            self.versions.get(path).cloned()
        }

        fn list_dir(&self, path: &Path) -> Vec<PathBuf> {
            self.dirs.get(path).cloned().unwrap_or_default()
        }

        fn is_dir(&self, path: &Path) -> bool {
            self.dir_set.contains(path)
        }

        fn is_file(&self, path: &Path) -> bool {
            self.file_set.contains(path)
        }

        fn parent_writable(&self, path: &Path) -> bool {
            path.parent()
                .map(|p| self.writable_parents.contains(p))
                .unwrap_or(false)
        }
    }

    fn default_config() -> AppConfig {
        AppConfig::default()
    }

    #[test]
    fn scan_reports_missing_tools_on_empty_host() {
        let probes = FakeProbes::new();
        let inspector = EnvironmentInspector::new(probes, PathBuf::from("/managed"));
        let status = inspector.scan(&default_config());

        assert_eq!(status.platform.os, std::env::consts::OS);
        assert!(!status.ready);
        let hand = status.tools.iter().find(|t| t.id == "hand").unwrap();
        assert_eq!(hand.state, ToolState::Missing);
        let git = status.tools.iter().find(|t| t.id == "git").unwrap();
        assert_eq!(git.state, ToolState::Missing);
        assert_eq!(status.fleet.state, ToolState::Missing);
        assert!(!status.issues.is_empty());
    }

    #[test]
    fn custom_hand_path_outranks_system() {
        let mut probes = FakeProbes::new();
        probes.executables.insert("hand".to_string(), PathBuf::from("/usr/bin/hand"));
        probes.executables.insert("/opt/hand".to_string(), PathBuf::from("/opt/hand"));
        probes.versions.insert(PathBuf::from("/opt/hand"), "hand v0.6.1".to_string());
        probes.versions.insert(PathBuf::from("/usr/bin/hand"), "hand v0.7.0".to_string());

        let mut config = default_config();
        config.hand_binary_path = "/opt/hand".to_string();

        let inspector = EnvironmentInspector::new(probes, PathBuf::from("/managed"));
        let status = inspector.scan(&config);
        let hand = status.tools.iter().find(|t| t.id == "hand").unwrap();
        assert_eq!(hand.ownership, Some(ToolOwnership::Custom));
        assert_eq!(hand.path.as_deref(), Some("/opt/hand"));
        assert_eq!(hand.state, ToolState::Ready);
    }

    #[test]
    fn managed_hand_is_preferred_when_no_custom_path_set() {
        let mut probes = FakeProbes::new();
        probes.executables.insert("hand".to_string(), PathBuf::from("/usr/bin/hand"));
        probes.versions.insert(PathBuf::from("/usr/bin/hand"), "hand v0.7.0".to_string());

        let managed_root = PathBuf::from("/managed");
        let hand_root = managed_root.join("tools").join("hand");
        let version_dir = hand_root.join("0.6.3");
        let hand_bin_name = if cfg!(windows) { "hand.exe" } else { "hand" };
        let managed_hand = version_dir.join(hand_bin_name);
        probes.dir_set.insert(hand_root.clone());
        probes.dir_set.insert(version_dir.clone());
        probes.dirs.insert(hand_root.clone(), vec![version_dir.clone()]);
        probes.file_set.insert(managed_hand.clone());
        probes.versions.insert(managed_hand.clone(), "hand v0.6.3".to_string());

        let inspector = EnvironmentInspector::new(probes, managed_root.clone());
        let status = inspector.scan(&default_config());
        let hand = status.tools.iter().find(|t| t.id == "hand").unwrap();
        assert_eq!(hand.ownership, Some(ToolOwnership::Managed));
        assert_eq!(hand.path.as_deref(), Some(managed_hand.to_str().unwrap()));
        assert_eq!(hand.state, ToolState::Ready);
    }

    #[test]
    fn configured_path_inside_managed_root_is_managed() {
        let managed_root = PathBuf::from("/managed");
        let hand_bin_name = if cfg!(windows) { "hand.exe" } else { "hand" };
        let managed_hand = managed_root
            .join("tools")
            .join("hand")
            .join("0.6.0")
            .join(hand_bin_name);

        let mut probes = FakeProbes::new();
        probes.file_set.insert(managed_hand.clone());
        probes.versions.insert(managed_hand.clone(), "hand v0.6.0".to_string());

        let mut config = default_config();
        config.hand_binary_path = managed_hand.to_string_lossy().into_owned();

        let inspector = EnvironmentInspector::new(probes, managed_root);
        let status = inspector.scan(&config);
        let hand = status.tools.iter().find(|t| t.id == "hand").unwrap();
        assert_eq!(hand.ownership, Some(ToolOwnership::Managed));
        assert_eq!(hand.state, ToolState::Ready);
    }

    #[test]
    fn newer_hand_is_incompatible() {
        let mut probes = FakeProbes::new();
        probes.executables.insert("hand".to_string(), PathBuf::from("/usr/bin/hand"));
        probes.versions.insert(PathBuf::from("/usr/bin/hand"), "hand v0.8.0".to_string());

        let inspector = EnvironmentInspector::new(probes, PathBuf::from("/managed"));
        let status = inspector.scan(&default_config());
        let hand = status.tools.iter().find(|t| t.id == "hand").unwrap();
        assert_eq!(hand.state, ToolState::Incompatible);
        assert_eq!(hand.compatible, Some(false));
        assert!(!status.ready);
    }

    #[test]
    fn system_git_ready() {
        let mut probes = FakeProbes::new();
        probes.executables.insert("git".to_string(), PathBuf::from("/usr/bin/git"));
        probes.versions.insert(PathBuf::from("/usr/bin/git"), "git version 2.42.0".to_string());

        let inspector = EnvironmentInspector::new(probes, PathBuf::from("/managed"));
        let status = inspector.scan(&default_config());
        let git = status.tools.iter().find(|t| t.id == "git").unwrap();
        assert_eq!(git.state, ToolState::Ready);
        assert_eq!(git.ownership, Some(ToolOwnership::System));
    }

    #[test]
    fn valid_fleet_is_ready() {
        let mut probes = FakeProbes::new();
        let fleet = PathBuf::from("/fleets/main");
        probes.dir_set.insert(fleet.clone());
        probes.dir_set.insert(fleet.join("state"));
        probes.file_set.insert(fleet.join("state").join("hand.db"));

        let mut config = default_config();
        config.fleet_path = Some(fleet.to_str().unwrap().to_string());

        let inspector = EnvironmentInspector::new(probes, PathBuf::from("/managed"));
        let status = inspector.scan(&config);
        assert_eq!(status.fleet.state, ToolState::Ready);
    }

    #[test]
    fn unqualified_supervisor_harness_fails_closed() {
        let mut config = default_config();
        config.supervisor_harness = "claude".to_string();

        let inspector = EnvironmentInspector::new(FakeProbes::new(), PathBuf::from("/managed"));
        let status = inspector.scan(&config);
        let supervisor = status.tools.iter().find(|t| t.id == "supervisor").unwrap();
        assert_eq!(supervisor.state, ToolState::ConfigurationRequired);
        assert_eq!(supervisor.compatible, Some(false));
        // Supervisor is optional, so overall readiness is not blocked by it alone.
    }

    #[test]
    fn find_managed_hand_path_returns_highest_version_binary() {
        let tmp = std::env::temp_dir().join(format!("serenade-managed-{}-{}", std::process::id(), "find"));
        let hand_root = tmp.join("tools").join("hand");
        let bin_name = if cfg!(windows) { "hand.exe" } else { "hand" };
        for v in ["0.6.0", "0.5.9"] {
            let dir = hand_root.join(v);
            std::fs::create_dir_all(&dir).unwrap();
            std::fs::write(dir.join(bin_name), "").unwrap();
        }
        let found = find_managed_hand_path(&tmp).unwrap();
        assert_eq!(found, hand_root.join("0.6.0").join(bin_name));
        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn find_managed_hand_path_returns_none_when_missing() {
        let tmp = std::env::temp_dir().join(format!("serenade-managed-{}-{}", std::process::id(), "none"));
        assert_eq!(find_managed_hand_path(&tmp), None);
    }
}
