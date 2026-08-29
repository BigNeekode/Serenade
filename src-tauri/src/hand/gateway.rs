use crate::error::SerenadeError;
use crate::hand::compatibility::{self, HandCompatibility, HandContract};
use crate::hand::HandRunner;
use std::path::Path;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SupervisorContextSource {
    Orient,
    LegacySessionStart,
}

impl SupervisorContextSource {
    pub fn label(self) -> &'static str {
        match self {
            Self::Orient => "hand orient",
            Self::LegacySessionStart => "hand session start (legacy fallback)",
        }
    }
}

/// Adapter for Serenade's currently implemented Hand CLI contract.
///
/// This type intentionally owns CLI fallback knowledge. Presentation and
/// Supervisor code should ask for semantic operations (fresh orientation,
/// compatibility) rather than branching on Hand command availability itself.
/// A future `HandV08Gateway` can implement the released 0.8 projection/action
/// contract beside this adapter without exposing v19 persistence to Serenade.
pub struct HandLegacyGateway {
    runner: HandRunner,
}

impl HandLegacyGateway {
    pub fn new(runner: HandRunner) -> Self {
        Self { runner }
    }

    pub fn compatibility(&self) -> Result<HandCompatibility, SerenadeError> {
        Ok(compatibility::classify(&self.runner.version()?))
    }

    pub fn assert_workflow_mutation_compatible(&self) -> Result<(), SerenadeError> {
        self.runner.assert_workflow_mutation_compatible()
    }

    /// Presentation-side read-only context for a Supervisor turn.
    ///
    /// Verified Hand 0.6 goes straight to its legacy session-start context so
    /// Serenade does not probe a command that is known not to exist. Transition
    /// and newer/unknown contracts prefer `orient`; session start remains a
    /// compatibility fallback only. This is supplemental to the actual
    /// Supervisor Harness's own orientation obligation.
    pub fn fresh_supervisor_context(
        &self,
        cwd: &Path,
    ) -> Option<(SupervisorContextSource, String)> {
        let contract = self.compatibility().ok().map(|c| c.contract);

        if contract == Some(HandContract::Legacy06) {
            return self.legacy_session_context(cwd);
        }

        if let Ok(text) = self.runner.expect_in(&["orient"], 20, cwd) {
            let text = text.trim().to_string();
            if !text.is_empty() {
                return Some((SupervisorContextSource::Orient, text));
            }
        }

        self.legacy_session_context(cwd)
    }

    fn legacy_session_context(&self, cwd: &Path) -> Option<(SupervisorContextSource, String)> {
        self.runner
            .expect_in(&["session", "start"], 20, cwd)
            .ok()
            .map(|text| text.trim().to_string())
            .filter(|text| !text.is_empty())
            .map(|text| (SupervisorContextSource::LegacySessionStart, text))
    }
}
