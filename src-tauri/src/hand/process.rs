use crate::error::SerenadeError;
use crate::hand::compatibility;
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
        } else if lower.contains("server_not_running") {
            // Hand 0.6 dispatches workers into Herdr panes; the Herdr server
            // must be running first (verified Windows runtime requirement).
            SerenadeError::new(
                crate::error::Code::CommandFailed,
                "Herdr server not running",
                "Workers run inside Herdr panes, and no Herdr server is running yet.",
            )
            .with_detail(self.raw.clone())
            .with_action(
                "Start the Herdr server (Settings -> Environment -> Herdr -> Start server, or run \
                 `herdr` in any terminal), then retry. Keep it running to watch workers; \
                 Ctrl+B Q detaches and `herdr` reattaches.",
            )
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
        // Keep branch-specific actions: hand's generic help lines are less
        // specific than the mapped ones above.
        let err = if err.suggested_action.is_none() {
            match action {
                Some(action) => err.with_action(&action),
                None => err,
            }
        } else {
            err
        };
        // usage errors and preconditions are actionable by the operator
        err
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn herdr_server_not_running_maps_to_actionable_error() {
        let stderr = concat!(
            "error: herdr workspace lookup/create failed: herdr workspace list: exit status 1: ",
            "{\"id\":\"cli:workspace:list\",\"error\":{\"code\":\"server_not_running\",",
            "\"message\":\"no herdr server is running at C:\\Users\\x\\AppData\\Roaming\\herdr\\herdr.sock; ",
            "run `herdr` to start or attach it\"}}\n",
            "kind: precondition\n",
            "exit: 3\n",
        );
        let doc = HandErrorDoc::parse(stderr);
        let err = doc.into_serenade("spawn");
        assert_eq!(err.title, "Herdr server not running");
        assert!(err.detail.as_deref().unwrap_or("").contains("server_not_running"));
        let action = err.suggested_action.expect("must carry an action");
        assert!(action.contains("Start server"));
    }
}

#[derive(Clone)]
pub struct HandRunner {
    pub binary: String,
    pub fleet_home: Option<PathBuf>,
}

fn is_workflow_mutation(args: &[&str]) -> bool {
    matches!(
        args.first(),
        Some(&"spawn")
            | Some(&"send")
            | Some(&"reopen")
            | Some(&"teardown")
            | Some(&"promote")
    )
}

/// PATH for Hand/Supervisor child processes: the current PATH plus Serenade's
/// known runtime tool directories (treehouse, herdr) and any extra directories
/// (e.g. the managed Hand binary's own directory) when they exist. Hand 0.6
/// invokes these tools from PATH, and the app process does not inherit a
/// freshly-written user PATH until restart, so the directories are appended
/// explicitly (never mutating the app's own environment).
pub fn child_path_with_extra_dirs(extra: &[PathBuf]) -> Option<std::ffi::OsString> {
    let current = std::env::var_os("PATH")?;
    let mut dirs: Vec<PathBuf> = std::env::split_paths(&current).collect();
    let mut changed = false;
    let mut all: Vec<PathBuf> = extra.to_vec();
    all.extend(crate::runtime_tools::runtime_tool_dirs());
    for candidate in all {
        if candidate.is_dir() && !dirs.contains(&candidate) {
            dirs.push(candidate);
            changed = true;
        }
    }
    if !changed {
        return None;
    }
    std::env::join_paths(dirs).ok()
}

impl HandRunner {
    /// Run and capture stdout+stderr together with the exit status.
    /// Fixed argument construction only — never a shell string (architecture.md §11).
    pub fn capture(
        &self,
        args: &[&str],
        timeout_secs: u64,
    ) -> Result<Result<String, HandErrorDoc>, SerenadeError> {
        self.capture_at(args, timeout_secs, None)
    }

    /// Same as `capture`, but executes with an explicit process cwd. HAND_HOME
    /// still points at the configured Fleet, so project-scoped presentation can
    /// inspect a project clone without changing Hand's Fleet identity.
    pub fn capture_in(
        &self,
        args: &[&str],
        timeout_secs: u64,
        cwd: &Path,
    ) -> Result<Result<String, HandErrorDoc>, SerenadeError> {
        self.capture_at(args, timeout_secs, Some(cwd))
    }

    fn capture_at(
        &self,
        args: &[&str],
        timeout_secs: u64,
        cwd: Option<&Path>,
    ) -> Result<Result<String, HandErrorDoc>, SerenadeError> {
        let mut cmd = Command::new(&self.binary);
        cmd.args(args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .stdin(Stdio::null());
        if let Some(cwd) = cwd {
            cmd.current_dir(cwd);
        }
        no_window(&mut cmd);

        if let Some(home) = &self.fleet_home {
            cmd.env("HAND_HOME", absolutize(home));
        }
        // Make the configured Hand binary's own directory reachable so tool
        // calls inside Hand's own flows (and Supervisor Harnesses instructing
        // `hand orient`) resolve even before a refreshed user PATH takes effect.
        let mut extra: Vec<PathBuf> = Vec::new();
        if let Some(parent) = Path::new(&self.binary).parent() {
            extra.push(parent.to_path_buf());
        }
        if let Some(path) = child_path_with_extra_dirs(&extra) {
            cmd.env("PATH", path);
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

    pub fn version(&self) -> Result<String, SerenadeError> {
        match self.capture(&["--version"], 10)? {
            Ok(stdout) => Ok(stdout.trim().to_string()),
            Err(doc) => Err(doc.into_serenade("--version")),
        }
    }

    /// Fail closed before executing a workflow mutation through the Rust
    /// boundary. This duplicates the frontend compatibility guard on purpose:
    /// raw Tauri invocation must not bypass contract qualification.
    pub fn assert_workflow_mutation_compatible(&self) -> Result<(), SerenadeError> {
        let version = self.version()?;
        compatibility::require_mutations(&version).map(|_| ())
    }

    /// Run expecting success and returning stdout; maps failures to SerenadeError.
    pub fn expect(&self, args: &[&str], timeout_secs: u64) -> Result<String, SerenadeError> {
        if is_workflow_mutation(args) {
            self.assert_workflow_mutation_compatible()?;
        }
        self.expect_unchecked_at(args, timeout_secs, None)
    }

    pub fn expect_in(
        &self,
        args: &[&str],
        timeout_secs: u64,
        cwd: &Path,
    ) -> Result<String, SerenadeError> {
        if is_workflow_mutation(args) {
            self.assert_workflow_mutation_compatible()?;
        }
        self.expect_unchecked_at(args, timeout_secs, Some(cwd))
    }

    fn expect_unchecked_at(
        &self,
        args: &[&str],
        timeout_secs: u64,
        cwd: Option<&Path>,
    ) -> Result<String, SerenadeError> {
        let result = match cwd {
            Some(cwd) => self.capture_in(args, timeout_secs, cwd)?,
            None => self.capture(args, timeout_secs)?,
        };
        match result {
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
