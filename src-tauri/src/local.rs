//! Local tooling actions — open a worktree in the preferred editor,
//! the file manager, or a terminal. Fixed executables, no shell strings.

use crate::error::{Code, SerenadeError};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

pub fn validate_worktree_path(path: &str) -> Result<PathBuf, SerenadeError> {
    let p = Path::new(path);
    if !p.is_absolute() {
        return Err(SerenadeError::new(
            Code::InvalidPath,
            "Invalid worktree path",
            format!("Expected an absolute path, got {path:?}"),
        ));
    }
    if !p.is_dir() {
        return Err(SerenadeError::new(
            Code::InvalidPath,
            "Worktree not found on disk",
            format!("{path} does not exist (it may already be returned to the pool)."),
        ));
    }
    Ok(p.to_path_buf())
}

fn spawn_detached(program: &str, args: &[&str]) -> Result<(), SerenadeError> {
    Command::new(program)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map(|_| ())
        .map_err(|e| {
            SerenadeError::new(
                Code::CommandFailed,
                "Could not launch",
                format!("Failed to run {program}: {e}"),
            )
            .with_action("Check that the executable is installed and on PATH.")
        })
}

pub fn open_editor(
    path: &Path,
    editor: &str,
    custom_path: Option<&str>,
) -> Result<(), SerenadeError> {
    let dir = path.to_string_lossy();
    match editor {
        "vscode" => spawn_detached("code", &[dir.as_ref()]),
        "cursor" => spawn_detached("cursor", &[dir.as_ref()]),
        "zed" => spawn_detached("zed", &[dir.as_ref()]),
        "custom" => {
            let exe = custom_path.filter(|s| !s.trim().is_empty()).ok_or_else(|| {
                SerenadeError::new(
                    Code::CommandFailed,
                    "No editor configured",
                    "The preferred editor is 'custom' but no executable path is set.",
                )
                .with_action("Set the custom editor path in Settings.")
            })?;
            spawn_detached(exe, &[dir.as_ref()])
        }
        other => spawn_detached(other, &[dir.as_ref()]),
    }
}

pub fn open_folder(path: &Path) -> Result<(), SerenadeError> {
    let dir = path.to_string_lossy();
    if cfg!(windows) {
        spawn_detached("explorer", &[dir.as_ref()])
    } else if cfg!(target_os = "macos") {
        spawn_detached("open", &[dir.as_ref()])
    } else {
        spawn_detached("xdg-open", &[dir.as_ref()])
    }
}

pub fn open_terminal(path: &Path) -> Result<(), SerenadeError> {
    let dir = path.to_string_lossy();
    if cfg!(windows) {
        // Windows Terminal if available; fall back to cmd.
        if spawn_detached("wt.exe", &["-d", dir.as_ref()]).is_ok() {
            return Ok(());
        }
        spawn_detached("cmd", &["/K", &format!("cd /D {}", dir)])
    } else {
        // Open the system default terminal at the directory.
        let terminal = if cfg!(target_os = "macos") { "open" } else { "xdg-open" };
        let _ = terminal;
        // Most Linux terminals accept a working dir flag; try a common set.
        for (prog, args) in [
            ("kitty", vec!["--directory", dir.as_ref()]),
            ("alacritty", vec!["--working-directory", dir.as_ref()]),
            ("gnome-terminal", vec![format!("--working-directory={dir}").as_str()]),
            ("xterm", vec![]),
        ] {
            if spawn_detached(prog, &args).is_ok() {
                return Ok(());
            }
        }
        Err(SerenadeError::new(
            Code::CommandFailed,
            "No terminal found",
            "Could not find a known terminal emulator.",
        ))
    }
}
