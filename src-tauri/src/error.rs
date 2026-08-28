use serde::Serialize;

/// Typed error codes — mirrors architecture.md §17.
#[allow(dead_code)] // full contract surface; not every variant is emitted yet
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Code {
    HandNotFound,
    InvalidFleet,
    ProjectNotFound,
    TaskNotFound,
    WorktreeNotFound,
    CommandFailed,
    ParseFailed,
    PermissionDenied,
    UnsupportedCapability,
    GitFailed,
    InvalidPath,
    NotFound,
}

impl Code {
    pub fn as_str(&self) -> &'static str {
        match self {
            Code::HandNotFound => "HAND_NOT_FOUND",
            Code::InvalidFleet => "INVALID_FLEET",
            Code::ProjectNotFound => "PROJECT_NOT_FOUND",
            Code::TaskNotFound => "TASK_NOT_FOUND",
            Code::WorktreeNotFound => "WORKTREE_NOT_FOUND",
            Code::CommandFailed => "COMMAND_FAILED",
            Code::ParseFailed => "PARSE_FAILED",
            Code::PermissionDenied => "PERMISSION_DENIED",
            Code::UnsupportedCapability => "UNSUPPORTED_CAPABILITY",
            Code::GitFailed => "GIT_FAILED",
            Code::InvalidPath => "INVALID_PATH",
            Code::NotFound => "NOT_FOUND",
        }
    }
}

/// Serialized AppError — the exact shape the frontend expects
/// ({ code, title, message, detail?, recoverable, suggestedAction? }).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SerenadeError {
    pub code: String,
    pub title: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    pub recoverable: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub suggested_action: Option<String>,
}

impl SerenadeError {
    pub fn new(code: Code, title: &str, message: impl Into<String>) -> Self {
        Self {
            code: code.as_str().to_string(),
            title: title.to_string(),
            message: message.into(),
            detail: None,
            recoverable: true,
            suggested_action: None,
        }
    }

    pub fn with_detail(mut self, detail: impl Into<String>) -> Self {
        self.detail = Some(detail.into());
        self
    }

    pub fn with_action(mut self, action: &str) -> Self {
        self.suggested_action = Some(action.to_string());
        self
    }

    pub fn not_recoverable(mut self) -> Self {
        self.recoverable = false;
        self
    }

    pub fn hand_not_found() -> Self {
        Self::new(
            Code::HandNotFound,
            "Hand executable not found",
            "The configured hand binary could not be executed.",
        )
        .with_action("Set the hand binary path in Settings.")
    }

    pub fn invalid_fleet(detail: String) -> Self {
        Self::new(
            Code::InvalidFleet,
            "Invalid fleet home",
            "The configured fleet path is not a secondhand home.",
        )
        .with_detail(detail)
        .with_action("Pick a directory containing state/hand.db (run `hand init` to create one).")
    }

    pub fn task_not_found(id: &str) -> Self {
        Self::new(
            Code::TaskNotFound,
            "Task not found",
            format!("No task with id {id}."),
        )
        .not_recoverable()
    }
}

impl std::fmt::Display for SerenadeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}

impl std::error::Error for SerenadeError {}
