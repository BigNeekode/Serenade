mod adapter;
mod config;
mod domain;
mod environment;
mod error;
mod fleet;
mod fleet_files;
mod git;
mod hand;
mod installer;
mod local;
mod runtime_tools;
mod supervisor;

use crate::config::{AppConfig, ConfigStore};
use crate::domain::*;
use crate::error::{Code, SerenadeError};
use crate::fleet_files::{valid_task_id, FleetFiles};
use crate::hand::gateway::HandLegacyGateway;
use crate::hand::model::{FleetJson, StatusJson};
use crate::hand::{toon, HandRunner};
use serde::Deserialize;
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::Manager;

struct AppCtx {
    config: ConfigStore,
    managed_root: PathBuf,
    fleet_cache: Mutex<Option<(Instant, Arc<FleetJson>)>>,
    git_cache: Mutex<HashMap<String, (Instant, git::GitInfo)>>,
    supervisor_sessions: Mutex<HashMap<String, String>>,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Build runner + fleet files from the current config. Errors when the
/// environment is not usable.
fn setup() -> Result<(AppConfig, HandRunner, FleetFiles), SerenadeError> {
    let ctx = CTX
        .get()
        .expect("app context initialized in setup hook");
    let config = ctx.config.load();
    let fleet = config
        .fleet_path
        .clone()
        .filter(|p| !p.trim().is_empty())
        .map(PathBuf::from)
        .ok_or_else(|| SerenadeError::invalid_fleet("No fleet path configured.".into()))?;
    if !fleet_home_valid(&fleet) {
        return Err(SerenadeError::invalid_fleet(format!(
            "{} is not a secondhand home (no state/hand.db).",
            fleet.display()
        )));
    }
    let binary = environment::resolve_hand_binary(&config.hand_binary_path, &ctx.managed_root);
    let runner = HandRunner {
        binary: binary.to_string_lossy().into_owned(),
        fleet_home: Some(fleet.clone()),
    };
    Ok((config, runner, FleetFiles::new(fleet)))
}

fn fleet_home_valid(path: &std::path::Path) -> bool {
    let has_db = path.join("state").is_dir() && path.join("state").join("hand.db").is_file();
    let legacy = path.join("data").join("projects.md").is_file() && path.join("state").is_dir();
    has_db || legacy
}

/// Runner with no HAND_HOME — for version probes and `hand init`.
fn global_runner(config: &AppConfig) -> HandRunner {
    let ctx = CTX.get().expect("ctx");
    let binary = environment::resolve_hand_binary(&config.hand_binary_path, &ctx.managed_root);
    HandRunner {
        binary: binary.to_string_lossy().into_owned(),
        fleet_home: None,
    }
}

/// TTL-cached fleet status. Every polled view (tasks, agents, worktrees,
/// reports, events, routes) needs the same fleet snapshot; without this each
/// poll spawns its own hand process — the main source of UI lag and
/// console-window flashing on Windows. The lock is held across the run so
/// concurrent callers dedupe into a single process.
///
/// The legacy CLI spelling lives in `HandLegacyGateway`; this cache layer only
/// knows the semantic read.
const FLEET_CACHE_TTL: Duration = Duration::from_millis(3_000);

fn fleet_status_cached(runner: &HandRunner) -> Result<Arc<FleetJson>, SerenadeError> {
    let ctx = CTX.get().expect("ctx");
    let mut guard = ctx.fleet_cache.lock().expect("fleet cache");
    if let Some((at, fleet)) = guard.as_ref() {
        if at.elapsed() < FLEET_CACHE_TTL {
            return Ok(fleet.clone());
        }
    }
    let gateway = HandLegacyGateway::new(runner.clone());
    let fleet = Arc::new(gateway.fleet_status()?);
    *guard = Some((Instant::now(), fleet.clone()));
    Ok(fleet)
}

/// Drop the cache after mutations so the UI immediately reflects changes.
fn invalidate_fleet_cache() {
    let ctx = CTX.get().expect("ctx");
    *ctx.fleet_cache.lock().expect("fleet cache") = None;
}

/// Cached read-only git enrichment per worktree path (git is fast but four
/// subprocesses per worktree per poll still churns).
const GIT_CACHE_TTL: Duration = Duration::from_secs(20);

fn git_inspect_cached(path: &str) -> git::GitInfo {
    let ctx = CTX.get().expect("ctx");
    let mut guard = ctx.git_cache.lock().expect("git cache");
    if let Some((at, info)) = guard.get(path) {
        if at.elapsed() < GIT_CACHE_TTL {
            return info.clone();
        }
    }
    let info = git::inspect(path);
    guard.insert(path.to_string(), (Instant::now(), info.clone()));
    info
}

fn held_ids(fleet: &FleetJson) -> HashSet<String> {
    fleet.holds.iter().map(|h| h.id.clone()).collect()
}

/// Static context stored once during app setup (config store path only).
static CTX: std::sync::OnceLock<AppCtx> = std::sync::OnceLock::new();

// ---------------------------------------------------------------------------
// Config & environment commands
// ---------------------------------------------------------------------------

#[tauri::command]
async fn config_get() -> Result<AppConfig, SerenadeError> {
    Ok(CTX.get().expect("ctx").config.load())
}

#[tauri::command]
async fn config_update(input: serde_json::Value) -> Result<AppConfig, SerenadeError> {
    CTX.get()
        .expect("ctx")
        .config
        .update(input)
        .map_err(|e| SerenadeError::new(Code::CommandFailed, "Could not save config", e))
}

#[tauri::command]
async fn environment_validate() -> Result<EnvironmentStatus, SerenadeError> {
    let ctx = CTX.get().expect("ctx");
    let config = ctx.config.load();
    Ok(environment::scan_environment(&config, ctx.managed_root.clone()))
}

#[tauri::command]
async fn fleet_init(path: String, force: Option<bool>) -> Result<(), SerenadeError> {
    let config = CTX.get().expect("ctx").config.load();
    let runner = global_runner(&config);
    fleet::prepare_fleet(PathBuf::from(&path).as_path(), &runner, force.unwrap_or(false))?;
    Ok(())
}

#[tauri::command]
async fn install_managed_hand() -> Result<String, SerenadeError> {
    let ctx = CTX.get().expect("ctx");
    let result = installer::install_managed_hand(&ctx.managed_root).await?;
    let path = result.path.to_string_lossy().into_owned();
    // Point the configured Hand binary at the freshly installed managed
    // executable so subsequent operations (fleet init, workflow mutations)
    // use it without requiring PATH changes.
    ctx.config
        .update(serde_json::json!({ "handBinaryPath": path }))
        .map_err(|e| SerenadeError::new(Code::CommandFailed, "Could not save config", e))?;
    Ok(path)
}

#[tauri::command]
async fn install_treehouse() -> Result<String, SerenadeError> {
    runtime_tools::install_treehouse().await
}

#[tauri::command]
async fn install_herdr() -> Result<String, SerenadeError> {
    runtime_tools::install_herdr().await
}

/// Open a Herdr console window (starting/attaching the Herdr server).
#[tauri::command]
async fn herdr_start() -> Result<(), SerenadeError> {
    runtime_tools::start_herdr_console()
}

#[tauri::command]
async fn diagnostics_get() -> Result<Diagnostics, SerenadeError> {
    let ctx = CTX.get().expect("ctx");
    let config = ctx.config.load();
    let binary = environment::resolve_hand_binary(&config.hand_binary_path, &ctx.managed_root);
    let version = HandRunner {
        binary: binary.to_string_lossy().into_owned(),
        fleet_home: None,
    }
    .capture(&["--version"], 10)
    .ok()
    .and_then(|r| r.ok())
    .map(|s| s.trim().to_string());
    let fleet_valid = config
        .fleet_path
        .as_ref()
        .map(|p| fleet_home_valid(PathBuf::from(p).as_path()));
    Ok(Diagnostics {
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        mode: "tauri".to_string(),
        tauri_version: Some(tauri::VERSION.to_string()),
        hand_path: Some(binary.to_string_lossy().into_owned()),
        hand_version: version,
        fleet_path: config.fleet_path.clone(),
        fleet_valid,
        capabilities: HandCapabilities {
            supports_structured_task_output: true,
            supports_pause: false,
            supports_route_write: true,
            supports_task_message: true,
            supports_report_listing: true,
        },
        recent_errors: Vec::new(),
    })
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

#[tauri::command]
async fn projects_list() -> Result<Vec<Project>, SerenadeError> {
    let (_config, runner, files) = setup()?;
    let gateway = HandLegacyGateway::new(runner);
    let raw = gateway.projects()?;
    Ok(raw
        .into_iter()
        .map(|p| {
            let repo_path = files
                .home
                .join("projects")
                .join(&p.name)
                .to_str()
                .map(str::to_string);
            Project {
                id: p.name.clone(),
                name: p.name,
                repo_path,
                repo_url: if p.url.is_empty() { None } else { Some(p.url) },
                status: if p.gate_issue.is_some() { "paused" } else { "active" }.to_string(),
                default_branch: None,
            }
        })
        .collect())
}

#[tauri::command]
async fn project_get(project_id: String) -> Result<Project, SerenadeError> {
    let projects = projects_list().await?;
    projects
        .into_iter()
        .find(|p| p.id == project_id)
        .ok_or_else(|| {
            SerenadeError::new(
                Code::ProjectNotFound,
                "Project not found",
                format!("No project named {project_id}."),
            )
            .not_recoverable()
        })
}

#[tauri::command]
async fn project_add(source: String) -> Result<(), SerenadeError> {
    let (_, runner, _) = setup()?;
    runner.assert_workflow_mutation_compatible()?;
    let source = source.trim();
    if source.is_empty() {
        return Err(SerenadeError::new(
            Code::InvalidPath,
            "Invalid project source",
            "Project source must not be empty.",
        ));
    }
    // Hand 0.6 only registers remote sources; local paths and `create` are 0.8
    // contracts. Reject early so the user sees a clear message instead of an
    // opaque "invalid project URL" from hand.
    if !is_supported_project_url(source) {
        return Err(SerenadeError::new(
            Code::InvalidPath,
            "Unsupported project source",
            "Hand 0.6 only registers remote Git URLs (https://, git@, ssh://, git://).",
        )
        .with_action("Create the repository on your remote first, then register its URL."));
    }
    runner.expect(&["project", "add", source], 120)?;
    invalidate_fleet_cache();
    Ok(())
}

fn is_supported_project_url(source: &str) -> bool {
    ["https://", "git@", "ssh://", "git://"]
        .iter()
        .any(|prefix| source.starts_with(prefix))
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

#[tauri::command]
async fn tasks_list(project_id: Option<String>) -> Result<Vec<Task>, SerenadeError> {
    let (_, runner, files) = setup()?;
    let fleet = fleet_status_cached(&runner)?;
    let held = held_ids(&fleet);
    Ok(fleet
        .tasks
        .iter()
        .filter(|t| project_id.as_ref().is_none_or(|p| *p == t.project))
        .map(|s| adapter::to_task(s, &files, held.contains(&s.id)))
        .collect())
}

#[tauri::command]
async fn task_get(task_id: String) -> Result<Task, SerenadeError> {
    let (_, runner, files) = setup()?;
    if !valid_task_id(&task_id) {
        return Err(SerenadeError::new(
            Code::InvalidPath,
            "Invalid task id",
            format!("{task_id:?} is not a valid hand task id."),
        ));
    }
    // Serve from the cached fleet snapshot when possible; fall back to a
    // direct per-task call (which also reports not-found).
    let fleet = fleet_status_cached(&runner)?;
    if let Some(s) = fleet.tasks.iter().find(|t| t.id == task_id) {
        let held = fleet.holds.iter().any(|h| h.id == task_id);
        return Ok(adapter::to_task(s, &files, held));
    }
    let gateway = HandLegacyGateway::new(runner);
    let s = gateway.task_status(&task_id)?;
    let held = s.held.is_some();
    Ok(adapter::to_task(&s, &files, held))
}

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

#[tauri::command]
async fn agents_list() -> Result<Vec<AgentRun>, SerenadeError> {
    let (_, runner, _) = setup()?;
    let fleet = fleet_status_cached(&runner)?;
    let mut agents = Vec::new();
    for s in &fleet.tasks {
        if let Some(attempts) = &s.attempts {
            if attempts.is_empty() {
                agents.push(adapter::to_agent_run(s));
                continue;
            }
            let active_ordinal = s.attempt_ordinal.unwrap_or(0);
            for a in attempts {
                let is_active = a.ordinal == active_ordinal;
                let mut run = agent_from_attempt(s, a, is_active);
                if is_active {
                    run.heartbeat_at = s.last_report_at.clone();
                }
                agents.push(run);
            }
        } else {
            agents.push(adapter::to_agent_run(s));
        }
    }
    agents.sort_by(|a, b| b.id.cmp(&a.id));
    Ok(agents)
}

fn agent_from_attempt(s: &StatusJson, a: &hand::model::AttemptJson, is_active: bool) -> AgentRun {
    // For the active Attempt, use the consolidated adapter mapping so
    // provider/agent `done` while the Attempt is running is presented as
    // waiting, not lifecycle completion. Older attempts keep their own
    // lifecycle-derived status.
    let status = if is_active {
        adapter::derive_agent_status(s).to_string()
    } else {
        match a.lifecycle.as_str() {
            "provisioning" => "starting".to_string(),
            "running" => "running".to_string(),
            "completed" => "completed".to_string(),
            "failed" => "failed".to_string(),
            "interrupted" => "stopped".to_string(),
            _ => "unknown".to_string(),
        }
    };
    AgentRun {
        id: adapter::agent_id_for(&s.id, a.ordinal),
        task_id: Some(s.id.clone()),
        project_id: Some(s.project.clone()),
        provider: a.harness.clone().unwrap_or_else(|| "unknown".into()),
        model: a.model.clone(),
        status,
        branch: a.worktree.as_ref().map(|w| {
            std::path::Path::new(w)
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_else(|| w.clone())
        }),
        started_at: s.created_at.clone(),
        ended_at: None,
        heartbeat_at: None,
        log_path: Some(format!("state/{}.status", s.id)),
    }
}

// ---------------------------------------------------------------------------
// Worktrees
// ---------------------------------------------------------------------------

#[tauri::command]
async fn worktrees_list(project_id: Option<String>) -> Result<Vec<Worktree>, SerenadeError> {
    let (_, runner, _) = setup()?;
    let fleet = fleet_status_cached(&runner)?;
    let mut out = Vec::new();
    for s in &fleet.tasks {
        if project_id.as_ref().is_some_and(|p| *p != s.project) {
            continue;
        }
        let Some(mut w) = adapter::to_worktree(s) else { continue };
        // Read-only git enrichment (best-effort; path may be back in the pool).
        if std::path::Path::new(&w.path).is_dir() {
            let info = git_inspect_cached(&w.path);
            if let Some(b) = info.branch {
                w.branch = b;
            }
            w.git_status = info.git_status;
            w.changed_files = info.changed_files;
            w.ahead_behind = info.ahead_behind;
            w.last_commit = info.last_commit;
        }
        out.push(w);
    }
    Ok(out)
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

fn report_from_content(
    task_id: &str,
    project_id: &str,
    path: PathBuf,
    created_at: Option<String>,
    with_content: bool,
) -> Report {
    let raw = std::fs::read_to_string(&path).unwrap_or_default();
    let title = fleet_files::brief_title_from(&raw);
    let summary = fleet_files::strip_front_matter(&raw)
        .lines()
        .map(str::trim)
        .find(|l| !l.is_empty() && !l.starts_with('#') && !l.starts_with("---"))
        .map(|l| l.chars().take(200).collect::<String>());
    Report {
        id: format!("r_{task_id}"),
        task_id: task_id.to_string(),
        project_id: project_id.to_string(),
        kind: "scout_report".to_string(),
        title: if title.is_empty() { format!("Report for {task_id}") } else { title },
        path: Some(path.to_string_lossy().into_owned()),
        summary,
        content: with_content.then_some(raw),
        created_at,
    }
}

#[tauri::command]
async fn reports_list(project_id: Option<String>) -> Result<Vec<Report>, SerenadeError> {
    let (_, runner, files) = setup()?;
    let fleet = fleet_status_cached(&runner)?;
    let project_of: std::collections::HashMap<String, String> = fleet
        .tasks
        .iter()
        .map(|s| (s.id.clone(), s.project.clone()))
        .collect();
    let mut out = Vec::new();
    for (task_id, mtime) in files.list_report_tasks() {
        let proj = project_of
            .get(&task_id)
            .cloned()
            .unwrap_or_default();
        if project_id.as_ref().is_some_and(|p| *p != proj) {
            continue;
        }
        let path = files.report_file(&task_id);
        out.push(report_from_content(
            &task_id,
            &proj,
            path,
            Some(fleet_files::iso_from_system_time(mtime)),
            false,
        ));
    }
    Ok(out)
}

#[tauri::command]
async fn report_get(report_id: String) -> Result<Report, SerenadeError> {
    let (_, runner, files) = setup()?;
    let task_id = report_id
        .strip_prefix("r_")
        .unwrap_or(&report_id)
        .to_string();
    if !valid_task_id(&task_id) || !files.report_exists(&task_id) {
        return Err(SerenadeError::new(
            Code::NotFound,
            "Report not found",
            format!("No report for {task_id}."),
        )
        .not_recoverable());
    }
    let fleet = fleet_status_cached(&runner)?;
    let project = fleet
        .tasks
        .iter()
        .find(|s| s.id == task_id)
        .map(|s| s.project.clone())
        .unwrap_or_default();
    let path = files.report_file(&task_id);
    let created = fleet_files::file_mtime(&path);
    Ok(report_from_content(&task_id, &project, path, created, true))
}

// ---------------------------------------------------------------------------
// Routes & providers
// ---------------------------------------------------------------------------

#[tauri::command]
async fn routes_list() -> Result<RoutesPayload, SerenadeError> {
    let (_, runner, _) = setup()?;
    let gateway = HandLegacyGateway::new(runner.clone());
    let doc = gateway.config_document()?;
    let mut providers = Vec::new();
    for row in toon::table(&doc, "harnesses") {
        if row.len() < 2 {
            continue;
        }
        let installed = row[1] == "true";
        providers.push(Provider {
            id: row[0].clone(),
            name: row[0].clone(),
            enabled: installed,
            connected: installed,
            default_model: None,
            active_workers: 0,
            tasks_completed: 0,
            recent_error: None,
        });
    }
    let mut routes = Vec::new();
    for (i, row) in toon::table(&doc, "routes").into_iter().enumerate() {
        if row.len() < 4 {
            continue;
        }
        let configured = row[3] == "configured";
        let profile = row[2].clone();
        routes.push(RouteRule {
            id: format!("{}-{}", row[0], row[1]),
            task_type: Some(row[0].clone()),
            execution_class: Some(row[1].clone()),
            provider_id: profile.clone(),
            model: profile,
            priority: (i as u32 + 1) * 10,
            enabled: configured,
            fallback: None,
        });
    }
    // Enrich providers with live usage when the fleet is reachable.
    if let Ok(fleet) = fleet_status_cached(&runner) {
        for p in &mut providers {
            p.active_workers = fleet
                .tasks
                .iter()
                .filter(|t| {
                    t.harness.as_deref() == Some(p.id.as_str())
                        && matches!(t.attempt_lifecycle.as_deref(), Some("provisioning") | Some("running"))
                })
                .count() as u32;
            p.tasks_completed = fleet
                .tasks
                .iter()
                .filter(|t| {
                    t.harness.as_deref() == Some(p.id.as_str())
                        && t.task_lifecycle.as_deref() == Some("terminal")
                })
                .count() as u32;
        }
    }
    for row in toon::table(&doc, "problems") {
        if row.len() >= 5 && row[0] == "missing-route" {
            continue; // surfaced via route `enabled` flags
        }
    }
    Ok(RoutesPayload { providers, routes })
}

// ---------------------------------------------------------------------------
// Events & logs
// ---------------------------------------------------------------------------

fn event_severity(kind: &str) -> &'static str {
    match kind {
        "done" | "reported-done" | "report-done" | "pr-merged" | "usage-limit-resumed" => "success",
        "failed" | "report-failed" => "error",
        "blocked" | "report-blocked" | "needs-decision" | "report-needs-decision" | "stale"
        | "parked" | "idle-unreported" | "gate-absent" | "gate-unknown" | "pr-not-recorded"
        | "pr-record-unknown" | "report-malformed" | "usage-limit" | "usage-limit-stuck" => "warning",
        _ => "info",
    }
}

#[tauri::command]
async fn events_recent(limit: Option<u32>) -> Result<Vec<FleetEvent>, SerenadeError> {
    let (_, runner, files) = setup()?;
    let log_mtime = fleet_files::file_mtime(&files.events_log()).unwrap_or_default();
    let lines = files.read_events_log();
    // One fleet lookup for the whole batch (task → project), not one per event.
    let project_of: HashMap<String, String> = fleet_status_cached(&runner)
        .map(|f| {
            f.tasks
                .iter()
                .map(|t| (t.id.clone(), t.project.clone()))
                .collect()
        })
        .unwrap_or_default();
    let mut out = Vec::new();
    for (i, line) in lines.into_iter().take(limit.unwrap_or(50) as usize).enumerate() {
        let mut parts = line.splitn(3, ' ');
        let kind = parts.next().unwrap_or("event").to_string();
        let target = parts.next().unwrap_or("").trim_matches(':').to_string();
        let note = parts.next().unwrap_or("").trim().to_string();
        let task_id = valid_task_id(&target).then_some(target);
        let project_id = task_id.as_ref().and_then(|id| project_of.get(id).cloned());
        out.push(FleetEvent {
            id: format!("e{i}"),
            kind: kind.clone(),
            message: if note.is_empty() { line.clone() } else { note },
            project_id,
            task_id,
            severity: event_severity(&kind).to_string(),
            created_at: log_mtime.clone(),
        });
    }
    Ok(out)
}

fn log_level_for(line: &str) -> &'static str {
    let head = line.split(':').next().unwrap_or("").trim();
    match head {
        "failed" => "error",
        "paused" | "blocked" | "needs-decision" => "warn",
        "done" => "success",
        _ => "info",
    }
}

#[tauri::command]
async fn task_logs_read(
    request: serde_json::Value,
) -> Result<LogChunkResponse, SerenadeError> {
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Req {
        task_id: String,
        cursor: Option<String>,
        limit: Option<usize>,
    }
    let req: Req =
        serde_json::from_value(request).map_err(|e| {
            SerenadeError::new(Code::CommandFailed, "Invalid log request", e.to_string())
        })?;
    if !valid_task_id(&req.task_id) {
        return Err(SerenadeError::new(
            Code::InvalidPath,
            "Invalid task id",
            req.task_id,
        ));
    }
    let (runner, files) = {
        let (_, runner, files) = setup()?;
        (runner, files)
    };
    let mut lines = files.read_status_lines(&req.task_id)?;
    let mtime = fleet_files::file_mtime(&files.status_file(&req.task_id)).unwrap_or_default();
    let mut source = "worker";

    // Some harnesses (e.g. opencode) never follow hand's report protocol, so
    // the status stream stays empty. Synthesize system lines from fleet state
    // so the log tab still tells the operator what is going on.
    if lines.is_empty() && req.cursor.is_none() {
        if let Ok(fleet) = fleet_status_cached(&runner) {
            if let Some(s) = fleet.tasks.iter().find(|t| t.id == req.task_id) {
                let mut synth: Vec<String> = Vec::new();
                synth.push(format!(
                    "task {} created ({}/{})",
                    s.id,
                    s.kind,
                    s.execution_class.as_deref().unwrap_or("standard")
                ));
                if let Some(h) = &s.harness {
                    let model = s.model.as_deref().unwrap_or("default model");
                    synth.push(format!("worker dispatched: {h} ({model})"));
                }
                match s.agent_state.as_deref() {
                    Some("done") => synth.push(
                        "agent finished its turn (herdr: done) but wrote no report line — \
                         inspect the worktree diff and decide: send an instruction, or teardown"
                            .to_string(),
                    ),
                    Some("idle") => synth.push(
                        "agent pane is idle with nothing reported (idle-unreported) — \
                         it may have stalled; send an instruction or check the pane"
                            .to_string(),
                    ),
                    Some("blocked") => {
                        synth.push("agent is blocked waiting for help".to_string())
                    }
                    Some("working") => {
                        synth.push("agent is working (no progress lines yet)".to_string())
                    }
                    _ => {}
                }
                if s.held.is_some() {
                    synth.push("task is on hold".to_string());
                }
                if !synth.is_empty() {
                    lines = synth;
                    source = "system";
                }
            }
        }
    }

    let start = req
        .cursor
        .and_then(|c| c.parse::<usize>().ok())
        .unwrap_or(0);
    let limit = req.limit.unwrap_or(100).clamp(1, 500);
    let slice: Vec<LogLine> = lines
        .iter()
        .skip(start)
        .take(limit)
        .enumerate()
        .map(|(i, line)| LogLine {
            id: format!("{}-L{}", req.task_id, start + i),
            ts: mtime.clone(),
            source: source.to_string(),
            level: log_level_for(line).to_string(),
            message: line.clone(),
        })
        .collect();
    let next = start + slice.len();
    Ok(LogChunkResponse {
        lines: slice,
        next_cursor: (next < lines.len()).then_some(next.to_string()),
    })
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateTaskInput {
    project_id: String,
    title: String,
    #[serde(default)]
    description: Option<String>,
    #[serde(rename = "type")]
    kind: String,
    #[serde(default)]
    execution_class: Option<String>,
    #[serde(default)]
    tags: Option<Vec<String>>,
    #[serde(default)]
    _source_task_id: Option<String>,
    #[serde(default)]
    _source_report_id: Option<String>,
}

fn slugify(title: &str) -> String {
    let mut slug: String = title
        .to_lowercase()
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() {
                c
            } else if c == '.' || c == '_' {
                c
            } else {
                '-'
            }
        })
        .collect();
    // collapse runs of '-', trim, clamp length
    let mut collapsed = String::new();
    let mut prev_dash = false;
    for c in slug.chars() {
        if c == '-' {
            if !prev_dash && !collapsed.is_empty() {
                collapsed.push('-');
            }
            prev_dash = true;
        } else {
            collapsed.push(c);
            prev_dash = false;
        }
    }
    slug = collapsed.trim_matches('-').to_string();
    slug.chars().take(40).collect::<String>().trim_matches('-').to_string()
}

#[tauri::command]
async fn task_create(input: serde_json::Value) -> Result<Task, SerenadeError> {
    let parsed: CreateTaskInput =
        serde_json::from_value(input).map_err(|e| {
            SerenadeError::new(Code::CommandFailed, "Invalid task input", e.to_string())
        })?;
    let (_, runner, files) = setup()?;
    runner.assert_workflow_mutation_compatible()?;

    let title = parsed.title.trim();
    if title.len() < 3 {
        return Err(SerenadeError::new(
            Code::CommandFailed,
            "Title too short",
            "Task titles must be at least 3 characters.",
        ));
    }
    let kind = if parsed.kind == "scout" { "scout" } else { "ship" };
    let execution_class = parsed
        .execution_class
        .as_deref()
        .filter(|c| ["mechanical", "standard", "deep"].contains(c))
        .unwrap_or("standard");

    // Derive a unique task id from the title.
    let base = slugify(title);
    if base.is_empty() {
        return Err(SerenadeError::new(
            Code::InvalidPath,
            "Could not derive a task id",
            "The title must contain letters or digits.",
        ));
    }
    let fleet = fleet_status_cached(&runner)?;
    let existing: HashSet<String> = fleet.tasks.iter().map(|t| t.id.clone()).collect();
    let mut id = base.clone();
    let mut n = 1;
    while existing.contains(&id) || files.brief_file(&id).exists() {
        n += 1;
        id = format!("{base}-{n}");
    }

    files.write_brief(&id, title, parsed.description.as_deref(), execution_class, &parsed.tags.clone().unwrap_or_default())?;

    // Dispatch the worker: hand spawn (scout flag when requested).
    let mut args: Vec<&str> = vec!["spawn", &id, &parsed.project_id];
    if kind == "scout" {
        args.push("--scout");
    }
    runner.expect(&args, 180)?;
    invalidate_fleet_cache();

    let gateway = HandLegacyGateway::new(runner);
    let s = gateway.task_status(&id)?;
    Ok(adapter::to_task(&s, &files, false))
}

#[tauri::command]
async fn task_send_message(task_id: String, message: String) -> Result<(), SerenadeError> {
    let (_, runner, _) = setup()?;
    runner.assert_workflow_mutation_compatible()?;
    let msg = message.trim();
    if msg.is_empty() {
        return Err(SerenadeError::new(
            Code::CommandFailed,
            "Empty message",
            "The instruction message must not be empty.",
        ));
    }
    // Bounded composer wait keeps the UI responsive; hand encodes
    // retry-safety in exit codes 6/7 and the error document.
    runner.expect(&["send", &task_id, msg, "--wait", "10s"], 30)?;
    invalidate_fleet_cache();
    Ok(())
}

#[tauri::command]
async fn task_retry(task_id: String) -> Result<(), SerenadeError> {
    let (_, runner, _) = setup()?;
    runner.assert_workflow_mutation_compatible()?;
    runner.expect(&["reopen", &task_id], 180)?;
    invalidate_fleet_cache();
    Ok(())
}

#[tauri::command]
async fn task_stop(task_id: String) -> Result<(), SerenadeError> {
    let (_, runner, _) = setup()?;
    runner.assert_workflow_mutation_compatible()?;
    // Destructive: the UI must confirm before invoking (architecture.md §21).
    runner.expect(&["teardown", &task_id, "--force"], 120)?;
    invalidate_fleet_cache();
    Ok(())
}

#[tauri::command]
async fn task_promote(task_id: String) -> Result<Task, SerenadeError> {
    let (_, runner, files) = setup()?;
    runner.assert_workflow_mutation_compatible()?;
    runner.expect(&["promote", &task_id], 180)?;
    invalidate_fleet_cache();
    let gateway = HandLegacyGateway::new(runner);
    let s = gateway.task_status(&task_id)?;
    Ok(adapter::to_task(&s, &files, false))
}

#[tauri::command]
async fn worktree_cleanup(worktree_id: String) -> Result<(), SerenadeError> {
    let (_, runner, _) = setup()?;
    runner.assert_workflow_mutation_compatible()?;
    // worktree_id == task id in this adapter. teardown without --force:
    // hand refuses when unlanded work exists, which is the safety we want.
    runner.expect(&["teardown", &worktree_id], 120)?;
    invalidate_fleet_cache();
    Ok(())
}

// ---------------------------------------------------------------------------
// Local tooling
// ---------------------------------------------------------------------------

fn worktree_path_for(task_id: &str) -> Result<PathBuf, SerenadeError> {
    let (_, runner, _) = setup()?;
    // Prefer the cached snapshot; fall back to a direct status call.
    let path = fleet_status_cached(&runner)
        .ok()
        .and_then(|f| {
            f.tasks
                .iter()
                .find(|t| t.id == task_id)
                .and_then(|t| t.worktree.clone())
        })
        .or_else(|| {
            let gateway = HandLegacyGateway::new(runner.clone());
            gateway.task_status(task_id).ok().and_then(|s| s.worktree)
        });
    let path = path.ok_or_else(|| {
        SerenadeError::new(
            Code::WorktreeNotFound,
            "No worktree for this task",
            format!("Task {task_id} has no worktree on record."),
        )
    })?;
    local::validate_worktree_path(&path)
}

#[tauri::command]
async fn worktree_open_editor(worktree_id: String) -> Result<(), SerenadeError> {
    let (config, _, _) = setup()?;
    let path = worktree_path_for(&worktree_id)?;
    local::open_editor(&path, &config.preferred_editor, config.custom_editor_path.as_deref())
}

#[tauri::command]
async fn worktree_open_folder(worktree_id: String) -> Result<(), SerenadeError> {
    let path = worktree_path_for(&worktree_id)?;
    local::open_folder(&path)
}

#[tauri::command]
async fn worktree_open_terminal(worktree_id: String) -> Result<(), SerenadeError> {
    let path = worktree_path_for(&worktree_id)?;
    local::open_terminal(&path)
}

// ---------------------------------------------------------------------------
// Supervisor chat
// ---------------------------------------------------------------------------

/// Chat with the headless fleet supervisor. Sessions are scoped: one for the
/// whole fleet (`project_id: None`) and one per registered project. A
/// project-scoped supervisor runs with cwd at the project clone, so the agent
/// can read that repository. Serenade supplies only a bootstrap compatibility
/// hint; the actual Supervisor Harness must orient itself every reasoning turn.
#[tauri::command]
async fn supervisor_chat(
    message: String,
    project_id: Option<String>,
) -> Result<supervisor::SupervisorReply, SerenadeError> {
    let (_config, runner, files) = setup()?;
    let ctx = CTX.get().expect("ctx");
    let msg = message.trim();
    if msg.is_empty() {
        return Err(SerenadeError::new(
            Code::CommandFailed,
            "Empty message",
            "The supervisor message must not be empty.",
        ));
    }

    // Scope: fleet-wide chat runs in the fleet home; project chat runs in the
    // project clone so the agent sees the codebase it is planning work for.
    let scope = project_id.clone().unwrap_or_default();
    let cwd = if scope.is_empty() {
        files.home.clone()
    } else {
        if !valid_task_id(&scope) {
            return Err(SerenadeError::new(
                Code::InvalidPath,
                "Invalid project name",
                format!("{scope:?} is not a valid project name."),
            ));
        }
        let clone = files.home.join("projects").join(&scope);
        if !clone.is_dir() {
            return Err(SerenadeError::new(
                Code::ProjectNotFound,
                "Project clone not found",
                format!("No clone for project {scope} under {}.", files.home.join("projects").display()),
            )
            .with_action("Register the project with `hand project add` first."));
        }
        clone
    };

    let session_id = ctx
        .supervisor_sessions
        .lock()
        .expect("supervisor sessions")
        .get(&scope)
        .cloned();
    let prompt = if session_id.is_none() {
        let gateway = HandLegacyGateway::new(runner);
        let session_doc = gateway.session_start_hint()?;
        supervisor::build_first_turn_prompt(&session_doc, "", "", msg, project_id.as_deref())
    } else {
        let _ = runner;
        msg.to_string()
    };

    let (session, text) = supervisor::run_supervisor_turn(&prompt, session_id.as_deref(), &cwd)?;
    if let Some(id) = session {
        ctx.supervisor_sessions
            .lock()
            .expect("supervisor sessions")
            .insert(scope, id);
    }
    Ok(supervisor::SupervisorReply { text })
}

/// Forget a supervisor session; the next chat message starts fresh.
#[tauri::command]
async fn supervisor_reset(project_id: Option<String>) -> Result<(), SerenadeError> {
    let ctx = CTX.get().expect("ctx");
    let scope = project_id.unwrap_or_default();
    ctx.supervisor_sessions
        .lock()
        .expect("supervisor sessions")
        .remove(&scope);
    Ok(())
}

// ---------------------------------------------------------------------------
// App entry
// ---------------------------------------------------------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            // Managed binaries are machine-local: they must not roam across
            // machines (architecture/activation state is host-specific).
            let local_dir = app.path().app_local_data_dir()?;
            let managed_root = local_dir.join("Serenade");
            let _ = std::fs::create_dir_all(&managed_root);
            let _ = CTX.set(AppCtx {
                config: ConfigStore::new(data_dir),
                managed_root,
                fleet_cache: Mutex::new(None),
                git_cache: Mutex::new(HashMap::new()),
                supervisor_sessions: Mutex::new(HashMap::new()),
            });
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            config_get,
            config_update,
            environment_validate,
            fleet_init,
            install_managed_hand,
            install_treehouse,
            install_herdr,
            herdr_start,
            diagnostics_get,
            projects_list,
            project_get,
            project_add,
            tasks_list,
            task_get,
            agents_list,
            worktrees_list,
            reports_list,
            report_get,
            routes_list,
            events_recent,
            task_logs_read,
            task_create,
            task_send_message,
            task_retry,
            task_stop,
            task_promote,
            worktree_cleanup,
            worktree_open_editor,
            worktree_open_folder,
            worktree_open_terminal,
            supervisor_chat,
            supervisor_reset,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::is_supported_project_url;

    #[test]
    fn project_add_accepts_only_remote_sources() {
        assert!(is_supported_project_url("https://github.com/you/repo.git"));
        assert!(is_supported_project_url("git@github.com:you/repo.git"));
        assert!(is_supported_project_url("ssh://git@github.com/you/repo.git"));
        assert!(is_supported_project_url("git://github.com/you/repo.git"));
        assert!(!is_supported_project_url("C:\\dev\\repo"));
        assert!(!is_supported_project_url("~/work/repo"));
        assert!(!is_supported_project_url("github.com/you/repo"));
    }
}
