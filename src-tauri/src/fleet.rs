//! Fleet path validation and initialization helpers.
//!
//! These helpers enforce the safety rules from quick-setup-architecture.md §13:
//! - reject obvious file paths;
//! - verify parent writable;
//! - detect an existing Fleet;
//! - detect non-empty unrelated directories;
//! - never recursively delete a directory;
//! - require explicit confirmation before adopting a pre-existing directory with data.

use crate::error::{Code, SerenadeError};
use crate::hand::HandRunner;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FleetDestinationState {
    /// Empty or absent directory — safe to initialize.
    ReadyToInitialize,
    /// Already looks like a Hand Fleet.
    ExistingFleet,
    /// Exists with content but does not look like a Fleet.
    NonEmptyUnrelated,
    /// Not a directory path.
    NotADirectory,
    /// Parent is not writable.
    ParentNotWritable,
    /// Path is inside Serenade's installation/application directory.
    InsideAppDirectory,
}

pub struct FleetDestination {
    pub path: PathBuf,
    pub state: FleetDestinationState,
    pub message: String,
}

/// Best-effort check: is the path inside the running application's directory?
/// We approximate by checking the current executable's parent chain.
fn inside_app_directory(path: &Path) -> bool {
    let Ok(exe) = std::env::current_exe() else {
        return false;
    };
    let Some(app_root) = exe.parent() else {
        return false;
    };
    // Walk up to the install root (dir containing the executable).
    let app_root = app_root.parent().unwrap_or(app_root);
    path.starts_with(app_root)
}

fn parent_writable(path: &Path) -> bool {
    path.parent()
        .map(|parent| {
            if !parent.exists() {
                return false;
            }
            let probe = parent.join(format!(".serenade-write-test-{}-tmp", std::process::id()));
            if std::fs::File::create(&probe).is_ok() {
                let _ = std::fs::remove_file(&probe);
                true
            } else {
                false
            }
        })
        .unwrap_or(false)
}

fn is_fleet_home(path: &Path) -> bool {
    let has_db = path.join("state").is_dir() && path.join("state").join("hand.db").is_file();
    let legacy = path.join("data").join("projects.md").is_file() && path.join("state").is_dir();
    has_db || legacy
}

fn is_unrelated_nonempty(path: &Path) -> bool {
    if !path.exists() {
        return false;
    }
    if !path.is_dir() {
        return false;
    }
    if is_fleet_home(path) {
        return false;
    }
    // Treat as unrelated if it has any entries.
    std::fs::read_dir(path)
        .map(|mut iter| iter.next().is_some())
        .unwrap_or(false)
}

pub fn inspect_destination(path: &Path) -> FleetDestination {
    if path.as_os_str().is_empty() {
        return FleetDestination {
            path: path.to_path_buf(),
            state: FleetDestinationState::NotADirectory,
            message: "Fleet path must not be empty.".to_string(),
        };
    }

    if inside_app_directory(path) {
        return FleetDestination {
            path: path.to_path_buf(),
            state: FleetDestinationState::InsideAppDirectory,
            message: "Fleet path must not be inside Serenade's installation directory.".to_string(),
        };
    }

    // If the path itself is an existing file, reject.
    if path.exists() && !path.is_dir() {
        return FleetDestination {
            path: path.to_path_buf(),
            state: FleetDestinationState::NotADirectory,
            message: "Fleet path must be a directory, not a file.".to_string(),
        };
    }

    if path.exists() && is_fleet_home(path) {
        return FleetDestination {
            path: path.to_path_buf(),
            state: FleetDestinationState::ExistingFleet,
            message: "Existing Hand Fleet detected.".to_string(),
        };
    }

    if path.exists() && is_unrelated_nonempty(path) {
        return FleetDestination {
            path: path.to_path_buf(),
            state: FleetDestinationState::NonEmptyUnrelated,
            message: "Directory exists and contains non-Fleet data. Choose a different path or confirm adoption.".to_string(),
        };
    }

    if !parent_writable(path) {
        return FleetDestination {
            path: path.to_path_buf(),
            state: FleetDestinationState::ParentNotWritable,
            message: "Fleet parent directory is not writable.".to_string(),
        };
    }

    FleetDestination {
        path: path.to_path_buf(),
        state: FleetDestinationState::ReadyToInitialize,
        message: "Fleet path is valid and ready to initialize.".to_string(),
    }
}

/// Initialize a Fleet at the given path using the canonical Hand `init` command.
/// Caller must have already validated/adopted the destination.
pub fn initialize_fleet(path: &Path, runner: &HandRunner) -> Result<(), SerenadeError> {
    let path_str = path.to_string_lossy().into_owned();
    runner.expect(&["init", &path_str], 90)?;
    Ok(())
}

/// Validate and optionally initialize a Fleet. `force` allows initializing into
/// an empty directory or adopting a non-empty unrelated directory (the UI must
/// obtain explicit operator confirmation before setting force=true).
pub fn prepare_fleet(path: &Path, runner: &HandRunner, force: bool) -> Result<FleetDestination, SerenadeError> {
    let destination = inspect_destination(path);
    match destination.state {
        FleetDestinationState::ExistingFleet => Ok(destination),
        FleetDestinationState::ReadyToInitialize => {
            initialize_fleet(path, runner)?;
            Ok(inspect_destination(path))
        }
        FleetDestinationState::NonEmptyUnrelated if force => {
            initialize_fleet(path, runner)?;
            Ok(inspect_destination(path))
        }
        FleetDestinationState::NonEmptyUnrelated => Err(SerenadeError::new(
            Code::InvalidPath,
            "Non-empty Fleet destination",
            destination.message.clone(),
        )
        .with_action("Choose an empty directory, an existing Fleet, or confirm adoption of this directory.")),
        FleetDestinationState::NotADirectory => Err(SerenadeError::new(
            Code::InvalidPath,
            "Invalid Fleet destination",
            destination.message.clone(),
        )),
        FleetDestinationState::ParentNotWritable => Err(SerenadeError::new(
            Code::PermissionDenied,
            "Cannot write Fleet destination",
            destination.message.clone(),
        )
        .with_action("Choose a directory under your user profile.")),
        FleetDestinationState::InsideAppDirectory => Err(SerenadeError::new(
            Code::InvalidPath,
            "Invalid Fleet destination",
            destination.message.clone(),
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_path_is_not_a_directory() {
        let dest = inspect_destination(Path::new(""));
        assert_eq!(dest.state, FleetDestinationState::NotADirectory);
    }

    #[test]
    fn missing_parent_is_not_writable() {
        let dest = inspect_destination(Path::new("/definitely/not/a/writable/place/fleet"));
        assert_eq!(dest.state, FleetDestinationState::ParentNotWritable);
    }

    #[test]
    fn temp_empty_directory_is_ready() {
        let tmp = std::env::temp_dir().join(format!("serenade-fleet-test-{}", std::process::id()));
        let _ = std::fs::create_dir_all(&tmp);
        let dest = inspect_destination(&tmp);
        assert_eq!(dest.state, FleetDestinationState::ReadyToInitialize);
        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn existing_fleet_is_detected() {
        let tmp = std::env::temp_dir().join(format!("serenade-fleet-existing-{}", std::process::id()));
        let _ = std::fs::create_dir_all(tmp.join("state"));
        let _ = std::fs::write(tmp.join("state").join("hand.db"), "");
        let dest = inspect_destination(&tmp);
        assert_eq!(dest.state, FleetDestinationState::ExistingFleet);
        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn unrelated_nonempty_directory_requires_confirmation() {
        let tmp = std::env::temp_dir().join(format!("serenade-fleet-unrelated-{}", std::process::id()));
        let _ = std::fs::create_dir_all(&tmp);
        let _ = std::fs::write(tmp.join("readme.txt"), "hello");
        let dest = inspect_destination(&tmp);
        assert_eq!(dest.state, FleetDestinationState::NonEmptyUnrelated);
        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn file_path_is_not_a_directory() {
        let tmp = std::env::temp_dir().join(format!("serenade-fleet-file-{}", std::process::id()));
        let _ = std::fs::write(&tmp, "not a dir");
        let dest = inspect_destination(&tmp);
        assert_eq!(dest.state, FleetDestinationState::NotADirectory);
        let _ = std::fs::remove_file(&tmp);
    }
}
