//! Read-only Git metadata for worktrees (Milestone 16 scope).
//! Explicit fixed arguments; no mutations.

use std::path::Path;
use std::process::{Command, Stdio};
use std::time::Duration;

pub struct GitInfo {
    pub branch: Option<String>,
    pub git_status: Option<String>,
    pub changed_files: Option<u32>,
    pub ahead_behind: Option<(u32, u32)>,
    pub last_commit: Option<String>,
}

fn git(path: &Path, args: &[&str]) -> Option<String> {
    let out = Command::new("git")
        .arg("-C")
        .arg(path)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .stdin(Stdio::null())
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    Some(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

/// Best-effort enrichment; every field degrades to None independently.
pub fn inspect(path: &str) -> GitInfo {
    let p = Path::new(path);
    GitInfo {
        branch: git(p, &["branch", "--show-current"]).filter(|b| !b.is_empty()),
        git_status: git(p, &["status", "--porcelain"]).map(|out| {
            if out.is_empty() {
                "clean".to_string()
            } else {
                "dirty".to_string()
            }
        }),
        changed_files: git(p, &["status", "--porcelain"])
            .map(|out| out.lines().filter(|l| !l.trim().is_empty()).count() as u32),
        ahead_behind: git(p, &["rev-list", "--left-right", "--count", "@{u}...HEAD"])
            .and_then(|out| {
                let mut parts = out.split_whitespace();
                let behind = parts.next()?.parse().ok()?;
                let ahead = parts.next()?.parse().ok()?;
                Some((ahead, behind))
            }),
        last_commit: git(p, &["log", "-1", "--pretty=%s"]),
    }
}

/// Timeout-guarded spawn variant is unnecessary here: git against a local
/// worktree is fast; commands above are all read-only.
#[allow(dead_code)]
fn unused(_: Duration) {}
