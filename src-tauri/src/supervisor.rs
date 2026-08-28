//! Supervisor chat — hosts a headless AI supervisor session for the fleet.
//!
//! hand's design (the fleet home's AGENTS.md + `hand session start`) puts an AI
//! agent in the supervisor role: it plans work, writes briefs, and dispatches
//! workers. Serenade hosts that supervisor as a chat: the agent runs headless
//! in the fleet home (so it reads the fleet's AGENTS.md), receives the same
//! session context `hand session start` produces plus live fleet state, and
//! proposes tasks as approval cards. The operator approves; Serenade writes
//! the brief and runs `hand spawn` (human-gated dispatch, matching hand's
//! "explicit authorization" invariants).

use crate::error::{Code, SerenadeError};
use serde::Serialize;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::time::Duration;
use wait_timeout::ChildExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

const SUPERVISOR_TIMEOUT_SECS: u64 = 240;
/// Cap fleet context so a large fleet cannot blow up the prompt.
const CONTEXT_BUDGET: usize = 12_000;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SupervisorReply {
    pub text: String,
}

/// Parse `opencode run --format json` event stream: keep the session id and
/// concatenate assistant text parts. Tolerant of unknown event types.
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

/// The first-turn prompt: supervisor contract + live fleet state + protocol.
/// When `project` is set, the supervisor is scoped to that project (and runs
/// with cwd at its clone, so it can read the code).
pub fn build_first_turn_prompt(
    session_doc: &str,
    fleet_json: &str,
    projects_json: &str,
    message: &str,
    project: Option<&str>,
) -> String {
    let scope = match project {
        Some(name) => format!(
            "You are the supervisor for project **{name}** specifically. You are running inside \
             that project's clone, so you can read its code directly. Propose work only for \
             {name}; set every proposed task's `project` to \"{name}\"."
        ),
        None => "You are the supervisor for the whole fleet; propose work for any registered \
                 project as appropriate."
            .to_string(),
    };
    format!(
        r#"You are the fleet supervisor for this Secondhand (`hand`) fleet, chatting with the operator through the Serenade desktop GUI.

{scope}

=== hand supervisor session context ===
{session_doc}

=== current fleet state ===
projects:
{projects_json}

tasks:
{fleet_json}

=== how you operate in Serenade ===
- You cannot run hand commands yourself in this chat. The operator approves actions in the GUI.
- To propose work, emit a fenced code block labeled `tasks` containing a JSON array, one object per task:
```tasks
[{{"title": "...", "project": "<project name>", "kind": "scout|ship", "executionClass": "mechanical|standard|deep", "description": "...", "tags": ["..."]}}]
```
- Serenade shows each entry as an approval card; approval writes the brief and runs `hand spawn`, which launches a real worker.
- Follow the session context above for scout-vs-ship and execution-class guidance. Keep replies short and operator-focused. Ask only genuinely operator-owned questions.

Operator: {message}"#,
        session_doc = truncate(session_doc.to_string(), CONTEXT_BUDGET / 2),
        fleet_json = truncate(fleet_json.to_string(), CONTEXT_BUDGET / 4),
        projects_json = truncate(projects_json.to_string(), CONTEXT_BUDGET / 4),
        message = message,
    )
}

/// Run `opencode run --format json [--session <id>] <message>` in the fleet
/// home. Fixed arguments only; the message is a single positional argument.
pub fn run_supervisor_turn(
    message: &str,
    session_id: Option<&str>,
    fleet_home: &PathBuf,
) -> Result<(Option<String>, String), SerenadeError> {
    let mut cmd = Command::new("opencode");
    cmd.args(["run", "--format", "json"])
        .current_dir(fleet_home)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::null());
    if let Some(id) = session_id {
        cmd.args(["--session", id]);
    }
    cmd.arg(message);
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
    // reads while the child runs, the OS pipe buffer fills, the child blocks
    // on write, and the turn deadlocks into the timeout.
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
    fn first_turn_prompt_contains_protocol() {
        let prompt = build_first_turn_prompt("SESSION", "{\"task_count\":0}", "[]", "do stuff", None);
        assert!(prompt.contains("```tasks"));
        assert!(prompt.contains("SESSION"));
        assert!(prompt.contains("do stuff"));
    }

    #[test]
    fn project_scoped_prompt_pins_project() {
        let prompt = build_first_turn_prompt("S", "{}", "[]", "go", Some("Kanvas-Kosong-Web"));
        assert!(prompt.contains("project **Kanvas-Kosong-Web** specifically"));
        assert!(prompt.contains("set every proposed task's `project` to \"Kanvas-Kosong-Web\""));
    }
}
