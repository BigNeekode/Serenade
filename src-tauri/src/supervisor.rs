//! Supervisor chat — hosts a headless AI supervisor runtime for the fleet.
//!
//! Serenade is presentation + interaction, not a competing source of Fleet
//! truth. A provider conversation is therefore only ephemeral UX/runtime state:
//! every reasoning turn is prefixed with fresh Hand-owned context. On Hand 0.7+
//! that is `hand orient`; Hand 0.6 falls back to its older per-turn
//! `hand session start` context contract.

use crate::error::{Code, SerenadeError};
use serde::Serialize;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::time::Duration;
use wait_timeout::ChildExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

const SUPERVISOR_TIMEOUT_SECS: u64 = 240;
/// Cap injected Hand context so a large fleet cannot blow up the prompt.
const CONTEXT_BUDGET: usize = 12_000;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SupervisorReply {
    pub text: String,
}

/// Parse `opencode run --format json` event stream: keep the provider session
/// id and concatenate assistant text parts. The session id is runtime mechanics
/// only; it is never canonical Fleet workflow identity.
pub fn parse_events(stdout: &str) -> (Option<String>, String) {
    let mut session = None;
    let mut text = String::new();
    for line in stdout.lines() {
        let Ok(v) = serde_json::from_str::<serde_json::Value>(line) else {
            continue;
        };
        if session.is_none() {
            if let Some(s) = v.get("sessionID").and_then(|s| s.as_str()) {
                session = Some(s.to_string());
            }
        }
        if let Some(part) = v.get("part") {
            if part.get("type").and_then(|t| t.as_str()) == Some("text") {
                if let Some(t) = part.get("text").and_then(|t| t.as_str()) {
                    text.push_str(t);
                }
            }
        }
    }
    (session, text)
}

fn truncate(s: String, budget: usize) -> String {
    if s.len() <= budget {
        s
    } else {
        let mut cut = budget;
        while cut > 0 && !s.is_char_boundary(cut) {
            cut -= 1;
        }
        format!("{}…[truncated]", &s[..cut])
    }
}

/// Best-effort read of one Hand context command in the supervisor cwd.
///
/// This is deliberately read-only. Serenade does not perform supervisor-origin
/// workflow mutations here; exact GUI actions continue through typed Tauri
/// commands. The direct `hand` executable is a transition shim until the Rust
/// HandGateway owns the configured binary for all supervisor reads as well.
fn read_hand_context(cwd: &PathBuf, args: &[&str]) -> Option<String> {
    let mut cmd = Command::new("hand");
    cmd.args(args)
        .current_dir(cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .stdin(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let output = cmd.output().ok()?;
    if !output.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    (!text.is_empty()).then_some(text)
}

/// Refresh current Hand-owned supervisor context for every reasoning turn.
///
/// 0.7+ owns the `session start once -> orient every turn` split. Hand 0.6 did
/// not yet expose `orient`, so its older `session start` command remains the
/// compatibility fallback and is intentionally re-read every turn.
fn fresh_hand_context(cwd: &PathBuf) -> Option<(&'static str, String)> {
    if let Some(orientation) = read_hand_context(cwd, &["orient"]) {
        return Some(("hand orient", orientation));
    }
    read_hand_context(cwd, &["session", "start"])
        .map(|context| ("hand session start (legacy fallback)", context))
}

/// First-turn conversation framing. `fleet_json` and `projects_json` are kept in
/// the signature temporarily so the 0.6 Tauri caller can migrate independently,
/// but they are intentionally ignored: manually assembled Serenade snapshots
/// must not become private competing Supervisor truth.
pub fn build_first_turn_prompt(
    session_doc: &str,
    _fleet_json: &str,
    _projects_json: &str,
    message: &str,
    project: Option<&str>,
) -> String {
    let scope = match project {
        Some(name) => format!(
            "You are the supervisor for project **{name}** specifically. You are running inside \
             that project's managed clone, so you can inspect its code. Propose work only for \
             {name}; set every proposed task's `project` to \"{name}\"."
        ),
        None => "You are the supervisor for the whole fleet; propose work for any registered \
                 project as appropriate."
            .to_string(),
    };
    format!(
        r#"You are the fleet supervisor for this Secondhand (`hand`) fleet, interacting with the operator through the Serenade desktop GUI.

{scope}

=== supervisor runtime bootstrap (first turn only) ===
{session_doc}

=== Serenade interaction contract ===
- Serenade presentation/chat history is not workflow truth.
- A fresh Hand-owned context is injected immediately before every reasoning turn. Treat that fresh context as authoritative when it conflicts with remembered conversation state.
- On current Hand this context comes from `hand orient`; legacy Hand 0.6 falls back to `hand session start`.
- Do not infer completion/currentness from conversational memory, provider session identity, or a worker saying `done`.
- Workflow-changing actions remain operator-approved through typed Serenade actions during this transition.
- To propose work, emit a fenced code block labeled `tasks` containing a JSON array, one object per task:
```tasks
[{{"title": "...", "project": "<project name>", "kind": "scout|ship", "executionClass": "mechanical|standard|deep", "description": "...", "tags": ["..."]}}]
```
- Serenade shows each entry as an approval card; approval writes the brief and invokes the verified Hand mutation adapter.
- Keep replies short and operator-focused. Ask only genuinely operator-owned questions.

Operator: {message}"#,
        session_doc = truncate(session_doc.to_string(), CONTEXT_BUDGET / 2),
        message = message,
    )
}

/// Run `opencode run --format json [--session <id>] <message>` in the selected
/// fleet/project scope. Every turn receives fresh Hand-owned orientation before
/// the operator message reaches the provider runtime.
pub fn run_supervisor_turn(
    message: &str,
    session_id: Option<&str>,
    cwd: &PathBuf,
) -> Result<(Option<String>, String), SerenadeError> {
    let turn_prompt = match fresh_hand_context(cwd) {
        Some((source, context)) => format!(
            "=== FRESH HAND CONTEXT — AUTHORITATIVE FOR THIS TURN ===\nsource: {source}\n\
             Do not substitute remembered chat state for these current facts.\n\n{}\n\n\
             === SERENADE TURN ===\n{}",
            truncate(context, CONTEXT_BUDGET),
            message,
        ),
        None => format!(
            "=== HAND CONTEXT REFRESH REQUIRED ===\n\
             Serenade could not refresh Hand directly from PATH. Before reasoning, run `hand orient`; \
             if this is legacy Hand 0.6 where `orient` is unavailable, run `hand session start` instead. \
             Treat that result as authoritative over remembered chat state.\n\n=== SERENADE TURN ===\n{message}"
        ),
    };

    let mut cmd = Command::new("opencode");
    cmd.args(["run", "--format", "json"])
        .current_dir(cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::null());
    if let Some(id) = session_id {
        cmd.args(["--session", id]);
    }
    cmd.arg(&turn_prompt);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW); // no console flash
    }

    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            return Err(SerenadeError::new(
                Code::HandNotFound,
                "opencode not found",
                "Serenade Supervisor chat currently runs through OpenCode, but `opencode` is not on PATH.",
            )
            .with_action(
                "Install OpenCode and ensure `opencode` is on PATH. Worker routes may still use other Hand-supported harnesses.",
            ));
        }
        Err(e) => {
            return Err(SerenadeError::new(
                Code::CommandFailed,
                "Could not launch supervisor",
                e.to_string(),
            ));
        }
    };

    // Drain both pipes concurrently while waiting: a supervisor turn can emit
    // megabytes of JSON events (tool calls embed file contents). If nobody
    // reads while the child runs, the OS pipe buffer fills and deadlocks.
    let mut stdout_pipe = child.stdout.take().expect("stdout piped");
    let mut stderr_pipe = child.stderr.take().expect("stderr piped");
    let stdout_thread = std::thread::spawn(move || {
        let mut buf = Vec::new();
        let _ = std::io::Read::read_to_end(&mut stdout_pipe, &mut buf);
        buf
    });
    let stderr_thread = std::thread::spawn(move || {
        let mut buf = Vec::new();
        let _ = std::io::Read::read_to_end(&mut stderr_pipe, &mut buf);
        buf
    });

    match child.wait_timeout(Duration::from_secs(SUPERVISOR_TIMEOUT_SECS)) {
        Ok(Some(status)) => {
            let stdout_bytes = stdout_thread.join().unwrap_or_default();
            let stderr_bytes = stderr_thread.join().unwrap_or_default();
            let _ = child.wait();
            let stdout = String::from_utf8_lossy(&stdout_bytes).into_owned();
            if !status.success() && stdout.trim().is_empty() {
                let stderr = String::from_utf8_lossy(&stderr_bytes).into_owned();
                return Err(SerenadeError::new(
                    Code::CommandFailed,
                    "Supervisor agent failed",
                    truncate(stderr, 2000),
                ));
            }
            let (session, text) = parse_events(&stdout);
            if text.trim().is_empty() {
                return Err(SerenadeError::new(
                    Code::ParseFailed,
                    "Supervisor returned no reply",
                    "The headless agent finished without text output.",
                )
                .with_detail(format!(
                    "stdout (first 2000 chars): {}",
                    truncate(stdout, 2000)
                )));
            }
            Ok((session, text))
        }
        Ok(None) => {
            let _ = child.kill();
            let _ = child.wait();
            Err(SerenadeError::new(
                Code::CommandFailed,
                "Supervisor timed out",
                format!("The supervisor agent did not reply within {SUPERVISOR_TIMEOUT_SECS}s."),
            ))
        }
        Err(e) => Err(SerenadeError::new(
            Code::CommandFailed,
            "Supervisor failed",
            e.to_string(),
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_session_and_text() {
        let stdout = concat!(
            r#"{"type":"step_start","sessionID":"ses_1","part":{"type":"step-start"}}"#, "\n",
            r#"{"type":"text","sessionID":"ses_1","part":{"type":"text","text":"hello "}}"#, "\n",
            r#"{"type":"text","sessionID":"ses_1","part":{"type":"text","text":"world"}}"#, "\n",
            r#"{"type":"step_finish","sessionID":"ses_1","part":{"type":"step-finish"}}"#, "\n",
        );
        let (session, text) = parse_events(stdout);
        assert_eq!(session.as_deref(), Some("ses_1"));
        assert_eq!(text, "hello world");
    }

    #[test]
    fn tolerant_of_garbage_lines() {
        let stdout = "not json\n{\"part\":{\"type\":\"text\",\"text\":\"ok\"}}\n";
        let (session, text) = parse_events(stdout);
        assert_eq!(session, None);
        assert_eq!(text, "ok");
    }

    #[test]
    fn first_turn_prompt_contains_protocol_without_private_snapshot() {
        let prompt = build_first_turn_prompt(
            "SESSION",
            "PRIVATE_FLEET_JSON",
            "PRIVATE_PROJECT_JSON",
            "do stuff",
            None,
        );
        assert!(prompt.contains("```tasks"));
        assert!(prompt.contains("SESSION"));
        assert!(prompt.contains("do stuff"));
        assert!(prompt.contains("presentation/chat history is not workflow truth"));
        assert!(!prompt.contains("PRIVATE_FLEET_JSON"));
        assert!(!prompt.contains("PRIVATE_PROJECT_JSON"));
    }

    #[test]
    fn project_scoped_prompt_pins_project() {
        let prompt = build_first_turn_prompt("S", "{}", "[]", "go", Some("Kanvas-Kosong-Web"));
        assert!(prompt.contains("project **Kanvas-Kosong-Web** specifically"));
        assert!(prompt.contains("set every proposed task's `project` to \"Kanvas-Kosong-Web\""));
    }
}
