//! Maps hand's legacy statusJSON onto Serenade's presentation domain.
//! See docs/hand-integration-notes.md §10 for the legacy status derivation table.
//!
//! Important: these are display projections only. Worker/provider state and
//! WorkerReport claims must not be promoted into canonical lifecycle truth.

use crate::domain::{AgentRun, AttemptProjection, Task, TaskLineage, Worktree};
use crate::fleet_files::FleetFiles;
use crate::hand::model::StatusJson;

pub fn agent_id_for(task_id: &str, ordinal: i64) -> String {
    format!("{task_id}#a{ordinal}")
}

/// Derive a legacy UI task status from Hand lifecycle fields.
///
/// The status is presentation-only. In particular, provider/agent `done` and a
/// WorkerReport `done` claim do not complete an active Attempt. Terminal "done"
/// is based on delivery/merge or Hand's Attempt lifecycle instead.
pub fn derive_task_status(s: &StatusJson, held: bool) -> &'static str {
    let reported = s.reported.as_ref().map(|r| r.state.as_str()).unwrap_or("");
    let attempt = s.attempt_lifecycle.as_deref().unwrap_or("");
    let open = s.task_lifecycle.as_deref().unwrap_or("open") == "open";
    let merged = s.merged.unwrap_or(false);
    let delivered = s.delivered_at.is_some();

    if open {
        if held || matches!(reported, "blocked" | "needs-decision") {
            return "blocked";
        }
        if matches!(attempt, "failed" | "interrupted") {
            return "failed";
        }
        if matches!(attempt, "provisioning" | "running") {
            // Do not turn agent_state=done into review/completion. The provider
            // may merely have finished one turn while the Attempt is still live.
            return if s.kind == "scout" { "scouting" } else { "in_progress" };
        }
        if matches!(attempt, "completed") {
            return "review";
        }
        if matches!(reported, "failed") {
            // A report is still only a claim; use it here as a presentation
            // warning when no stronger active lifecycle state exists.
            return "failed";
        }
        if matches!(reported, "done") {
            // Claim-driven actionability only; this does not make the Task done.
            return "review";
        }
        if matches!(reported, "paused") {
            return "blocked";
        }
        return if s.kind == "scout" { "scouting" } else { "in_progress" };
    }

    // Terminal presentation follows Hand lifecycle/delivery facts rather than
    // a worker claim. This keeps `reported: done` distinct from completion.
    if merged || delivered || matches!(attempt, "completed") {
        return "done";
    }
    if matches!(attempt, "failed") {
        return "failed";
    }
    if matches!(attempt, "interrupted") {
        return "stopped";
    }
    "stopped"
}

/// Map Attempt lifecycle + provider activity onto the legacy UI vocabulary.
///
/// `agent_state=done` is deliberately **not** `completed`: completion belongs to
/// Attempt lifecycle. While the Attempt is still running it is presented as
/// waiting for the next canonical transition/operator action.
pub fn derive_agent_status(s: &StatusJson) -> &'static str {
    let attempt = s.attempt_lifecycle.as_deref().unwrap_or("");
    match attempt {
        "provisioning" => "starting",
        "running" => match s.agent_state.as_deref().unwrap_or("unknown") {
            "working" => "running",
            "idle" | "done" => "waiting",
            "blocked" => "blocked",
            _ => "unknown",
        },
        "completed" => "completed",
        "failed" => "failed",
        "interrupted" => "stopped",
        _ => "unknown",
    }
}

pub fn to_task(s: &StatusJson, files: &FleetFiles, held: bool) -> Task {
    let title = files
        .brief_title(&s.id)
        .unwrap_or_else(|| s.id.clone());
    let attempts = s.attempt_ordinal.unwrap_or(0);
    let agent_id = if matches!(
        s.attempt_lifecycle.as_deref().unwrap_or(""),
        "provisioning" | "running"
    ) {
        Some(agent_id_for(&s.id, attempts))
    } else {
        None
    };
    let active_attempt = s.attempt_ordinal.map(|ordinal| AttemptProjection {
        ordinal,
        lifecycle: s.attempt_lifecycle.clone(),
        harness: s.harness.clone(),
        model: s.model.clone(),
    });
    Task {
        id: s.id.clone(),
        project_id: s.project.clone(),
        title,
        description: files.brief_summary(&s.id),
        r#type: s.kind.clone(),
        execution_class: s
            .execution_class
            .clone()
            .unwrap_or_else(|| "standard".to_string()),
        status: derive_task_status(s, held).to_string(),
        tags: Vec::new(),
        assigned_agent_id: agent_id,
        worktree_id: s.worktree.as_ref().map(|_| s.id.clone()),
        report_id: if files.report_exists(&s.id) {
            Some(format!("r_{}", s.id))
        } else {
            None
        },
        branch: s.worktree.as_ref().map(|w| {
            std::path::Path::new(w)
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_else(|| w.clone())
        }),
        attempts,
        lineage: Some(TaskLineage {
            source: "legacy".to_string(),
            // Hand 0.6 has no canonical v19 Plan projection. Do not manufacture
            // one from brief/task-kind data merely to fill the future shape.
            plan: None,
            active_attempt,
        }),
        created_at: s.created_at.clone().unwrap_or_default(),
        updated_at: s.last_report_at
            .clone()
            .or_else(|| s.created_at.clone())
            .unwrap_or_default(),
    }
}

pub fn to_agent_run(s: &StatusJson) -> AgentRun {
    let attempts = s.attempt_ordinal.unwrap_or(0);
    let status = derive_agent_status(s);
    let ended = if s.task_lifecycle.as_deref() == Some("terminal")
        || !matches!(s.attempt_lifecycle.as_deref().unwrap_or(""), "provisioning" | "running")
    {
        s.last_report_at.clone()
    } else {
        None
    };
    AgentRun {
        id: agent_id_for(&s.id, attempts),
        task_id: Some(s.id.clone()),
        project_id: Some(s.project.clone()),
        provider: s.harness.clone().unwrap_or_else(|| "unknown".to_string()),
        model: s.model.clone(),
        status: status.to_string(),
        branch: s.worktree.as_ref().map(|w| {
            std::path::Path::new(w)
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_else(|| w.clone())
        }),
        started_at: s.created_at.clone(),
        ended_at: ended,
        heartbeat_at: s.last_report_at.clone(),
        log_path: s
            .id
            .is_empty()
            .then(String::new)
            .map(|_| format!("state/{}.status", s.id)),
    }
}

pub fn to_worktree(s: &StatusJson) -> Option<Worktree> {
    let path = s.worktree.as_ref()?;
    let attempt_running = matches!(
        s.attempt_lifecycle.as_deref().unwrap_or(""),
        "provisioning" | "running"
    );
    let state = if attempt_running {
        "active"
    } else if s.merged.unwrap_or(false) || s.delivered_at.is_some() {
        "ready-for-review"
    } else if s.task_lifecycle.as_deref() == Some("terminal") {
        "orphaned"
    } else {
        "idle"
    };
    Some(Worktree {
        id: s.id.clone(),
        project_id: s.project.clone(),
        task_id: Some(s.id.clone()),
        path: path.clone(),
        branch: std::path::Path::new(path)
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_else(|| path.clone()),
        git_status: None,
        changed_files: None,
        ahead_behind: None,
        last_commit: None,
        state: state.to_string(),
        created_at: s.created_at.clone(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::hand::model::ReportedJson;

    fn status(attempt: &str, agent: Option<&str>) -> StatusJson {
        StatusJson {
            id: "task-1".into(),
            project: "demo".into(),
            kind: "ship".into(),
            task_lifecycle: Some("open".into()),
            attempt_lifecycle: Some(attempt.into()),
            agent_state: agent.map(str::to_string),
            ..Default::default()
        }
    }

    #[test]
    fn provider_done_does_not_complete_running_attempt() {
        let s = status("running", Some("done"));
        assert_eq!(derive_agent_status(&s), "waiting");
        assert_eq!(derive_task_status(&s, false), "in_progress");
    }

    #[test]
    fn worker_report_done_does_not_complete_terminal_interrupted_attempt() {
        let mut s = status("interrupted", None);
        s.task_lifecycle = Some("terminal".into());
        s.reported = Some(ReportedJson {
            state: "done".into(),
            note: "worker claims done".into(),
        });
        assert_eq!(derive_task_status(&s, false), "stopped");
    }

    #[test]
    fn attempt_completion_is_strong_enough_for_terminal_done() {
        let mut s = status("completed", None);
        s.task_lifecycle = Some("terminal".into());
        assert_eq!(derive_task_status(&s, false), "done");
    }
}
