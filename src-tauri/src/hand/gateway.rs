use crate::error::SerenadeError;
use crate::hand::compatibility::{self, HandCompatibility, HandContract};
use crate::hand::model::{FleetJson, ProjectJson, StatusJson};
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
/// This type intentionally owns legacy CLI vocabulary and fallback knowledge.
/// Presentation/Tauri code should ask for semantic reads instead of spelling
/// legacy commands itself. A future `HandV08Gateway` can implement released
/// 0.8 projections/actions beside this adapter without exposing v19 persistence.
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

    /// Legacy fleet/status projection used by the 0.6 compatibility adapter.
    pub fn fleet_status(&self) -> Result<FleetJson, SerenadeError> {
        self.runner.json(&["status", "--json"], 20)
    }

    /// Legacy single-task status projection.
    pub fn task_status(&self, task_id: &str) -> Result<StatusJson, SerenadeError> {
        self.runner.json(&["status", task_id, "--json"], 20)
    }

    /// Registered project projection for the legacy adapter.
    pub fn projects(&self) -> Result<Vec<ProjectJson>, SerenadeError> {
        self.runner.json(&["project", "list", "--json"], 15)
    }

    /// Legacy route/provider config document. Parsing remains isolated in the
    /// legacy adapter path; a future canonical gateway should expose typed data.
    pub fn config_document(&self) -> Result<String, SerenadeError> {
        self.runner.expect(&["config"], 15)
    }

    pub fn session_start_hint(&self) -> Result<String, SerenadeError> {
        self.runner.expect(&["session", "start"], 20)
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
