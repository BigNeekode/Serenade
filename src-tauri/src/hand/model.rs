//! Serde models for hand's JSON output — field names exactly as hand 0.6.0
//! emits them (see docs/hand-integration-notes.md §2). Enums are kept as
//! strings for forward compatibility with newer hand versions.

use serde::Deserialize;

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(default)]
pub struct FleetJson {
    pub task_count: i64,
    pub tasks: Vec<StatusJson>,
    pub holds: Vec<HoldJson>,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(default)]
pub struct StatusJson {
    pub id: String,
    pub project: String,
    pub kind: String,
    pub execution_class: Option<String>,
    pub profile: Option<String>,
    pub planned_against: Option<String>,
    pub routing_source: Option<String>,
    pub task_lifecycle: Option<String>,
    pub attempt_ordinal: Option<i64>,
    pub attempt_lifecycle: Option<String>,
    pub harness: Option<String>,
    pub model: Option<String>,
    pub effort: Option<String>,
    pub agent_state: Option<String>,
    pub worktree: Option<String>,
    pub herdr: Option<HerdrRef>,
    pub pr: Option<String>,
    pub merged: Option<bool>,
    pub pr_merged_observed: Option<bool>,
    pub delivered_at: Option<String>,
    pub delivered_reason: Option<String>,
    pub created_at: Option<String>,
    pub last_report_at: Option<String>,
    pub reported: Option<ReportedJson>,
    pub report_history: Option<Vec<String>>,
    pub held: Option<HoldJson>,
    pub unacknowledged: Option<bool>,
    pub parked: Option<bool>,
    pub unreachable: Option<bool>,
    pub attempts: Option<Vec<AttemptJson>>,
    pub latest_send: Option<SendJson>,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(default)]
pub struct HerdrRef {
    pub session: String,
    pub workspace_id: String,
    pub tab_id: String,
    pub pane_id: String,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(default)]
pub struct ReportedJson {
    pub state: String,
    pub note: String,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(default)]
pub struct HoldJson {
    pub id: String,
    pub kind: String,
    pub reason: String,
    pub blocked_on: Option<String>,
    pub set_at: Option<String>,
    pub inferred: Option<bool>,
    pub inconsistent: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(default)]
pub struct AttemptJson {
    pub ordinal: i64,
    pub lifecycle: String,
    pub harness: Option<String>,
    pub model: Option<String>,
    pub effort: Option<String>,
    pub execution_class: Option<String>,
    pub profile: Option<String>,
    pub worktree: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(default)]
pub struct SendJson {
    pub id: i64,
    pub task_id: String,
    pub attempt_id: i64,
    pub origin: String,
    pub state: String,
    pub reason_code: Option<String>,
    pub created_at: Option<String>,
    pub finalized_at: Option<String>,
    pub needs_attention: Option<bool>,
    pub retry_safe: Option<bool>,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(default)]
pub struct ProjectJson {
    pub name: String,
    pub url: String,
    pub mode: String,
    pub upstream: Option<String>,
    pub gate_issue: Option<String>,
}
