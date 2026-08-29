//! Supervisor chat — hosts a headless AI supervisor runtime for the fleet.
//!
//! Serenade is presentation + interaction, not a competing source of Fleet
//! truth. A provider conversation is therefore only ephemeral UX/runtime state.
//! Serenade performs a best-effort read-only preflight before each turn through
//! the configured Hand gateway, while the actual Supervisor Harness is instructed
//! to follow Hand's own runtime contract (`session start` once for a new runtime,
//! `orient` every turn).

use crate::error::{Code, SerenadeError};
use crate::hand::gateway::HandLegacyGateway;
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::Duration;
use wait_timeout::ChildExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

const SUPERVISOR_TIMEOUT_SECS: u64 = 240;
/// Cap injected Hand context so a large fleet cannot blow up the prompt.
const CONTEXT_BUDGET: usize = 12_000;
/// CreateProcess caps a command line at 32767 characters; refuse turns whose
/// composed prompt would risk exceeding it instead of failing obscurely.
const PROMPT_HARD_LIMIT: usize = 30_000;

/// Resolved OpenCode program, cached for the app session once discovery
/// succeeds. Failed lookups are never cached so a later install is picked up.
static RESOLVED_OPENCODE: std::sync::OnceLock<HarnessProgram> = std::sync::OnceLock::new();

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

/// Refresh current Hand-owned context as a presentation-side preflight through
/// the configured legacy gateway. The fallback command details live in the
/// adapter rather than in Supervisor presentation code.
fn fresh_hand_context(cwd: &PathBuf) -> Option<(&'static str, String)> {
    let (_, runner, _) = crate::setup().ok()?;
    let gateway = HandLegacyGateway::new(runner);
    gateway
        .fresh_supervisor_context(cwd)
        .map(|(source, context)| (source.label(), context))
}

/// The program to spawn for a Supervisor turn.
#[derive(Debug, Clone)]
enum HarnessProgram {
    /// A directly executable binary.
    Exe(PathBuf),
    /// A Node.js launcher referenced by an npm-style shim: spawn with node,
    /// which accepts multi-line arguments without cmd.exe's limits.
    Node { node: PathBuf, script: PathBuf },
}

impl HarnessProgram {
    fn label(&self) -> String {
        match self {
            Self::Exe(exe) => exe.display().to_string(),
            Self::Node { node, script } => format!("{} {}", node.display(), script.display()),
        }
    }
}

/// Resolve the OpenCode executable the same way the environment scan does
/// (PATHEXT-aware). A bare-name spawn only finds `.exe` files, so an npm-style
/// `opencode.cmd` shim is "installed" for the scan but invisible to the spawn.
///
/// The shim itself can never be spawned with our prompt: Rust std rejects
/// multi-line arguments to batch files ("batch file arguments are invalid"),
/// and cmd.exe caps command lines at 8191 characters. Instead, resolve what
/// the shim forwards to — an `.exe` is spawned directly, a launcher script is
/// run with `node` — and validate the result with `--version` before use.
fn resolve_opencode_program() -> Result<HarnessProgram, SerenadeError> {
    let path = which::which("opencode").map_err(|_| {
        SerenadeError::new(
            Code::HandNotFound,
            "Supervisor Harness executable not found",
            "The qualified Serenade Supervisor Harness \"opencode\" is not available on PATH.",
        )
        .with_action("Install OpenCode (https://opencode.ai) and make sure its executable is on PATH.")
    })?;

    let is_shim = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.eq_ignore_ascii_case("cmd") || e.eq_ignore_ascii_case("bat"))
        .unwrap_or(false);
    if !is_shim {
        return Ok(HarnessProgram::Exe(path));
    }

    for target in shim_targets(&path) {
        if target
            .extension()
            .map(|e| e.eq_ignore_ascii_case("exe"))
            .unwrap_or(false)
        {
            let program = HarnessProgram::Exe(target);
            if probe_harness_version(&program) {
                return Ok(program);
            }
        } else if let Ok(node) = which::which("node") {
            let program = HarnessProgram::Node { node, script: target };
            if probe_harness_version(&program) {
                return Ok(program);
            }
        }
    }

    Err(SerenadeError::new(
        Code::CommandFailed,
        "OpenCode npm shim could not be resolved",
        "OpenCode was installed through npm as a command shim, and command shims cannot receive the multi-line supervisor prompt directly.",
    )
    .with_action(
        "Install the standalone OpenCode binary (https://opencode.ai), or make sure Node.js (node.exe) is on PATH so the shim's target can be launched directly.",
    ))
}

/// Validate a resolved harness program with `--version` (best-effort).
fn probe_harness_version(program: &HarnessProgram) -> bool {
    let mut cmd = match program {
        HarnessProgram::Exe(exe) => {
            let mut c = Command::new(exe);
            c.arg("--version");
            c
        }
        HarnessProgram::Node { node, script } => {
            let mut c = Command::new(node);
            c.arg(script).arg("--version");
            c
        }
    };
    cmd.stdout(Stdio::piped())
        .stderr(Stdio::null())
        .stdin(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd.output().map(|o| o.status.success()).unwrap_or(false)
}

/// Extract the target programs an npm-style `.cmd`/`.bat` shim forwards to.
/// npm shims reference their program relative to the shim directory via
/// `%dp0%` / `%~dp0`; expand those tokens and keep every referenced file.
///
/// Tokens are split on all whitespace: the reference appears at the start of
/// its own line in real npm shims, so splitting on spaces alone would glue
/// the previous line onto the path and break resolution.
fn shim_targets(shim: &Path) -> Vec<PathBuf> {
    let mut out: Vec<PathBuf> = Vec::new();
    let Ok(script) = std::fs::read_to_string(shim) else {
        return out;
    };
    let Some(base) = shim.parent() else {
        return out;
    };
    let base_str = base.to_string_lossy().into_owned();
    for raw in script.split_whitespace() {
        let token = raw.trim_matches('"');
        if !token.contains("%dp0%") && !token.contains("%~dp0") {
            continue;
        }
        let expanded = token.replace("%dp0%", &base_str).replace("%~dp0", &base_str);
        let expanded = expanded.trim_end_matches(['\\', '/']);
        let candidate = PathBuf::from(expanded);
        let with_exe = if candidate
            .extension()
            .map(|e| e.eq_ignore_ascii_case("exe"))
            .unwrap_or(false)
        {
            candidate.clone()
        } else {
            let mut s = candidate.clone().into_os_string();
            s.push(".exe");
            PathBuf::from(s)
        };
        for hit in [with_exe, candidate] {
            if hit.is_file() && !out.contains(&hit) {
                out.push(hit);
            }
        }
    }
    out
}

/// Build the process for one explicitly qualified Supervisor Harness adapter.
///
/// Worker routing is intentionally unrelated to this selection. Adding a new
/// value here requires verifying that Harness's headless invocation, session
/// resume, output parsing, cwd behavior, and Hand supervisor-runtime contract.
fn qualified_harness_program(harness: &str) -> Result<HarnessProgram, SerenadeError> {
    match harness {
        "opencode" => {
            if let Some(cached) = RESOLVED_OPENCODE.get() {
                return Ok(cached.clone());
            }
            let resolved = resolve_opencode_program()?;
            let _ = RESOLVED_OPENCODE.set(resolved.clone());
            Ok(resolved)
        }
        other => Err(SerenadeError::new(
            Code::UnsupportedCapability,
            "Supervisor Harness not qualified",
            format!(
                "Serenade has no verified Supervisor Harness runtime adapter for {other:?}."
            ),
        )
        .with_action(
            "Select OpenCode as the Supervisor Harness until another runtime adapter is explicitly qualified.",
        )),
    }
}

/// Assemble the harness command for one turn.
///
/// `--auto` (documented OpenCode flag: "auto-approve permissions that are not
/// explicitly denied") is required for headless operation: a `run` turn cannot
/// answer interactive permission prompts, and the Supervisor runtime contract
/// requires the harness to execute `hand orient` / `hand session start` — and,
/// per Hand's own design, to persist operator-accepted profile/route choices
/// through `hand config`. Serenade's operator gate is unchanged: task dispatch
/// still happens only through typed approval cards.
fn harness_command(
    program: &HarnessProgram,
    session_id: Option<&str>,
    cwd: &Path,
    turn_prompt: &str,
) -> Command {
    let mut cmd = match program {
        HarnessProgram::Exe(exe) => {
            let mut c = Command::new(exe);
            c.args(["run", "--format", "json", "--auto"]);
            c
        }
        HarnessProgram::Node { node, script } => {
            let mut c = Command::new(node);
            c.arg(script).args(["run", "--format", "json", "--auto"]);
            c
        }
    };
    cmd.current_dir(cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::null());
    if let Some(id) = session_id {
        cmd.args(["--session", id]);
    }
    cmd.arg(turn_prompt);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
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

=== Serenade-collected bootstrap hint ===
{session_doc}

The block above was collected by Serenade before your provider runtime started. It is a compatibility hint, not your runtime identity and not workflow authority.

=== Supervisor Harness runtime contract ===
- You are the actual Supervisor Harness runtime for this turn.
- On the first turn of a new actual provider runtime/session, run `hand session start` once yourself before reasoning. Do not persist its runtime/session identity as Fleet workflow truth.
- Before reasoning or acting on every turn, run `hand orient` yourself and use its fresh bounded SupervisorOrientation. If `hand orient` is unavailable because this is legacy Hand 0.6, run `hand session start` as the legacy per-turn context refresh instead.
- Any Serenade-injected preflight context is supplemental; your own runtime orientation is the required current observation before reasoning/action.
- Serenade presentation/chat history is not workflow truth.
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

/// Compose the full turn prompt. `None` context produces the minimal variant
/// used when the preflight fails.
fn compose_turn_prompt(
    context: Option<&(&'static str, String)>,
    context_budget: usize,
    message: &str,
    runtime_instruction: &str,
) -> String {
    match context {
        Some((source, context)) => format!(
            "=== SERENADE READ-ONLY HAND PREFLIGHT ===\nsource: {source}\n\
             This is supplemental context, not a substitute for Supervisor Harness orientation.\n\n{}\n\n\
             === SUPERVISOR RUNTIME REQUIREMENT ===\n{runtime_instruction}\n\n\
             === SERENADE TURN ===\n{}",
            truncate(context.clone(), context_budget),
            message,
        ),
        None => format!(
            "=== SUPERVISOR RUNTIME REQUIREMENT ===\n{runtime_instruction}\n\n\
             Serenade could not refresh Hand through the configured gateway, so do not rely on presentation-side context.\n\n\
             === SERENADE TURN ===\n{message}"
        ),
    }
}

/// Run one turn through the selected, explicitly qualified Supervisor Harness.
/// Every turn receives a best-effort fresh Hand preflight and an explicit
/// instruction to orient inside the actual provider runtime.
pub fn run_supervisor_turn(
    message: &str,
    session_id: Option<&str>,
    cwd: &Path,
) -> Result<(Option<String>, String), SerenadeError> {
    let runtime_instruction =
        "Before reasoning or acting on this turn, run `hand orient` yourself. If `hand orient` is unavailable on legacy Hand 0.6, run `hand session start` instead. Treat the result as authoritative over remembered chat state.";

    let (config, runner, _) = crate::setup()?;
    let harness = config.supervisor_harness.clone();
    let program = qualified_harness_program(&harness)?;

    let context = fresh_hand_context(&cwd.to_path_buf());
    let turn_prompt = compose_turn_prompt(context.as_ref(), CONTEXT_BUDGET, message, runtime_instruction);
    if turn_prompt.len() > PROMPT_HARD_LIMIT {
        return Err(SerenadeError::new(
            Code::CommandFailed,
            "Supervisor message too long",
            format!(
                "The composed turn prompt is {} characters; the practical command-line limit is {}.",
                turn_prompt.len(),
                PROMPT_HARD_LIMIT
            ),
        )
        .with_action("Send a shorter message."));
    }

    let mut cmd = harness_command(&program, session_id, cwd, &turn_prompt);

    // The Supervisor runtime contract requires the harness to run `hand orient`
    // / `hand session start` itself. Make the configured Hand binary and the
    // runtime tools (treehouse, herdr) resolvable from the harness's own tool
    // calls, without relying on a user PATH that may not be refreshed yet.
    let mut extra: Vec<PathBuf> = Vec::new();
    if let Some(parent) = Path::new(&runner.binary).parent() {
        extra.push(parent.to_path_buf());
    }
    if let Some(path) = crate::hand::process::child_path_with_extra_dirs(&extra) {
        cmd.env("PATH", path);
    }

    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            return Err(SerenadeError::new(
                Code::HandNotFound,
                "Supervisor Harness executable not found",
                format!(
                    "The qualified Serenade Supervisor Harness {harness:?} could not be executed at {}.",
                    program.label()
                ),
            )
            .with_action(
                "Install the selected Supervisor Harness and ensure its executable is on PATH.",
            ));
        }
        Err(e) => {
            return Err(SerenadeError::new(
                Code::CommandFailed,
                "Could not launch Supervisor Harness",
                format!("{} ({})", e, program.label()),
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
                    "Supervisor Harness failed",
                    truncate(stderr, 2000),
                )
                .with_detail(truncate(stdout, 2000))
                .with_action(
                    "Verify the Supervisor Harness is installed and authenticated with its provider (OpenCode stores credentials through its own `opencode auth` login flow). Then send the message again.",
                ));
            }
            let (session, text) = parse_events(&stdout);
            if text.trim().is_empty() {
                return Err(SerenadeError::new(
                    Code::ParseFailed,
                    "Supervisor returned no reply",
                    "The Supervisor Harness finished without text output.",
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
                format!("The Supervisor Harness did not reply within {SUPERVISOR_TIMEOUT_SECS}s."),
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
    fn first_turn_prompt_contains_runtime_contract_without_private_snapshot() {
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
        assert!(prompt.contains("run `hand session start` once yourself"));
        assert!(prompt.contains("run `hand orient` yourself"));
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

    #[test]
    fn unqualified_harness_fails_before_spawn() {
        let err = qualified_harness_program("claude")
            .expect_err("unqualified harness must fail closed");
        assert_eq!(err.code, "UNSUPPORTED_CAPABILITY");
    }

    #[test]
    fn shim_targets_parses_real_npm_shim_layout() {
        // Mirrors the actual npm-generated opencode.cmd, where the target
        // reference appears at the start of its own line. A tokenizer that
        // split only on spaces glued the previous line onto the path and
        // broke resolution — this is the regression test for that.
        let tmp = std::env::temp_dir().join(format!("serenade-shim-real-{}", std::process::id()));
        let bin_dir = tmp.join("node_modules").join("opencode-ai").join("bin");
        std::fs::create_dir_all(&bin_dir).unwrap();
        let exe = bin_dir.join("opencode.exe");
        std::fs::write(&exe, b"fake").unwrap();
        let shim = tmp.join("opencode.cmd");
        std::fs::write(
            &shim,
            "@ECHO off\nGOTO start\n:find_dp0\nSET dp0=%~dp0\nEXIT /b\n:start\nSETLOCAL\nCALL :find_dp0\n\"%dp0%\\node_modules\\opencode-ai\\bin\\opencode.exe\"   %*\n",
        )
        .unwrap();

        let targets = shim_targets(&shim);
        assert!(targets.contains(&exe), "expected {exe:?} in {targets:?}");
        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn shim_targets_finds_launcher_script_and_exe_variant() {
        // npm shims for JS-launcher packages reference a script without an
        // extension; both the script and a sibling .exe are collected.
        let tmp = std::env::temp_dir().join(format!("serenade-shim-js-{}", std::process::id()));
        let bin_dir = tmp.join("node_modules").join("opencode-ai").join("bin");
        std::fs::create_dir_all(&bin_dir).unwrap();
        let script = bin_dir.join("opencode");
        std::fs::write(&script, b"// launcher").unwrap();
        let shim = tmp.join("opencode.cmd");
        std::fs::write(
            &shim,
            "@ECHO off\nSET dp0=%~dp0\n\"%dp0%\\node_modules\\opencode-ai\\bin\\opencode\" %*\n",
        )
        .unwrap();

        let targets = shim_targets(&shim);
        assert!(targets.contains(&script));
        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn shim_targets_returns_empty_without_references() {
        let tmp = std::env::temp_dir().join(format!("serenade-shim-none-{}", std::process::id()));
        std::fs::create_dir_all(&tmp).unwrap();
        let shim = tmp.join("opencode.cmd");
        std::fs::write(&shim, "@ECHO off\necho no references\n").unwrap();
        assert!(shim_targets(&shim).is_empty());
        let _ = std::fs::remove_dir_all(&tmp);
    }
}
