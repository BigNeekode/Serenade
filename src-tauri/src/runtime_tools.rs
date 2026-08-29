//! Runtime tool installers for the Hand 0.6 dependency chain.
//!
//! Hand 0.6 relies on `treehouse` (git worktree pool) and `herdr` (terminal
//! runtime) as external tools it does not install itself — there is no
//! `hand runtime` command in 0.6. Their only official Windows install methods
//! are the vendor bootstrap scripts, so this module invokes those with explicit
//! user consent (via a typed Tauri command, never a generic shell endpoint) and
//! validates the resulting binary with `--version` afterward.
//!
//! This is architecture.md §6 strategy #3: official bootstrap with consent and
//! post-install validation. Unlike the managed Hand installer, these tools are
//! version-unpinned ("latest stable") because that is the vendor's documented
//! contract; we validate the resulting binary but do not fabricate a pinned
//! asset URL for them.

use crate::error::{Code, SerenadeError};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::time::Duration;
use wait_timeout::ChildExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

const TREEHOUSE_INSTALL_SCRIPT: &str =
    "irm https://kunchenguid.github.io/treehouse/install.ps1 | iex";
const HERDR_INSTALL_SCRIPT: &str = "irm https://herdr.dev/install.ps1 | iex";

const INSTALL_TIMEOUT_SECS: u64 = 300;

fn localappdata() -> Option<PathBuf> {
    if !cfg!(windows) {
        return None;
    }
    std::env::var("LOCALAPPDATA")
        .ok()
        .map(PathBuf::from)
        .filter(|p| !p.as_os_str().is_empty())
}

pub fn treehouse_exe() -> Option<PathBuf> {
    localappdata().map(|p| p.join("treehouse").join("treehouse.exe"))
}

pub fn herdr_exe() -> Option<PathBuf> {
    localappdata()
        .map(|p| p.join("Programs").join("Herdr").join("bin").join("herdr.exe"))
}

fn run_powershell_install(script: &str) -> Result<String, SerenadeError> {
    let mut cmd = Command::new("powershell");
    cmd.args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = cmd.spawn().map_err(|e| {
        SerenadeError::new(Code::InstallFailed, "Could not launch installer", e.to_string())
    })?;

    let wait = Duration::from_secs(INSTALL_TIMEOUT_SECS);
    match child.wait_timeout(wait) {
        Ok(Some(status)) => {
            let out = child.wait_with_output().map_err(|e| {
                SerenadeError::new(Code::InstallFailed, "Installer output unreadable", e.to_string())
            })?;
            let stdout = String::from_utf8_lossy(&out.stdout).into_owned();
            let stderr = String::from_utf8_lossy(&out.stderr).into_owned();
            if !status.success() {
                let detail = if stderr.trim().is_empty() { stdout.clone() } else { stderr.clone() };
                return Err(SerenadeError::new(Code::InstallFailed, "Installer failed", detail)
                    .with_detail(stdout));
            }
            Ok(format!("{stdout}\n{stderr}"))
        }
        Ok(None) => {
            let _ = child.kill();
            let _ = child.wait();
            Err(SerenadeError::new(
                Code::InstallFailed,
                "Installer timed out",
                format!("The installer did not finish within {INSTALL_TIMEOUT_SECS}s."),
            ))
        }
        Err(e) => Err(SerenadeError::new(
            Code::InstallFailed,
            "Installer failed",
            e.to_string(),
        )),
    }
}

fn version_of(binary: &PathBuf) -> Option<String> {
    let mut cmd = Command::new(binary);
    cmd.arg("--version")
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .stdin(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let out = cmd.output().ok()?;
    if !out.status.success() {
        return None;
    }
    let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
    Some(stdout)
}

fn verify_installed(label: &str, exe: Option<PathBuf>) -> Result<String, SerenadeError> {
    let exe = exe.ok_or_else(|| {
        SerenadeError::new(
            Code::UnsupportedPlatform,
            format!("{label} auto-install is Windows-only in this MVP").as_str(),
            "Use the official installer for your platform.",
        )
    })?;
    version_of(&exe).ok_or_else(|| {
        SerenadeError::new(
            Code::InstallFailed,
            format!("{label} install could not be verified").as_str(),
            format!("{} --version failed after install.", exe.display()),
        )
    })
}

/// Install treehouse via its official bootstrap and return the verified version.
pub fn install_treehouse() -> Result<String, SerenadeError> {
    run_powershell_install(TREEHOUSE_INSTALL_SCRIPT)?;
    verify_installed("Treehouse", treehouse_exe())
}

/// Install herdr via its official bootstrap and return the verified version.
pub fn install_herdr() -> Result<String, SerenadeError> {
    run_powershell_install(HERDR_INSTALL_SCRIPT)?;
    verify_installed("Herdr", herdr_exe())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn install_scripts_are_pinned_official_sources() {
        assert!(TREEHOUSE_INSTALL_SCRIPT.contains("kunchenguid.github.io/treehouse/install.ps1"));
        assert!(HERDR_INSTALL_SCRIPT.contains("herdr.dev/install.ps1"));
    }

    #[test]
    fn known_install_locations_are_expected() {
        if !cfg!(windows) {
            assert!(treehouse_exe().is_none());
            assert!(herdr_exe().is_none());
        }
    }
}
