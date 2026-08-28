# Serenade — hand Integration Notes

> Phase 0 output (Milestone 0 — Repository Investigation).
> Verified against **hand 0.6.0** (`github.com/atqamz/hand`, Go) — findings below
> come from the published CLI and its source tree.

## 1. Fleet home

- Resolution (`internal/home/home.go`):
  1. `HAND_HOME` env var — must be absolute and point at a fleet home, else precondition error.
  2. Otherwise, walk up from the cwd; first ancestor that qualifies wins.
- Home markers: `state/hand.db` (normal) or legacy `data/projects.md` + `state/`.
- Layout: `config/`, `data/`, `projects/`, `state/`, `AGENTS.md`, `CLAUDE.md`.
- `hand init [path]` creates/refreshes a home; asks no questions.
- **GUI rule**: never rely on cwd — every hand invocation sets `HAND_HOME` to the
  configured absolute fleet path.

## 2. Structured output (JSON)

Only these commands support `--json`:

| Command | Shape |
|---|---|
| `hand status --json` | `{task_count, tasks: [statusJSON], holds: [holdJSON], herdr_session}` |
| `hand status <id> --json` | single `statusJSON` (+ `report_history`, `held`, `herdr_session_*`) |
| `hand project list --json` | `[{name, url, mode, upstream?, gate_issue?}]` |
| `hand search --json` | `[{Path, Title, Snippet}]` (capitalized keys — no Go json tags) |

Everything else (spawn/send/reopen/promote/hold/merge/teardown/deliver/ack/pr/
config/doctor/watch) emits **TOON** prose on stdout.

### `statusJSON` (field → meaning)

- `id`, `project`, `kind` (`ship`|`scout`), `execution_class` (`mechanical`|`standard`|`deep`, omitempty)
- `profile`, `planned_against`, `routing_source` (`explicit-profile`|`route`|`legacy`)
- `task_lifecycle` (`open`|`terminal`), `attempt_ordinal`, `attempt_lifecycle` (`provisioning`|`running`|`completed`|`failed`|`interrupted`)
- `harness`, `model`, `effort` — the active attempt's worker settings
- `agent_state` — herdr pane classification: `idle`|`working`|`blocked`|`done`|`unknown`
- `worktree` — absolute path (treehouse pool: `<clone>/.treehouse/...`)
- `herdr` — `{session, workspace_id, tab_id, pane_id}`
- `pr`, `pr_observation`, `pr_observed_url`, `merged`, `pr_merged_observed`
- `delivered_at`, `delivered_reason`, `created_at`, `last_report_at` (RFC3339, UTC)
- `reported` — `{state, note}`; state ∈ `working`|`paused`|`blocked`|`needs-decision`|`done`|`failed`|`unreadable`
- `report_history` — last 5 `"state: note"` lines (detail mode)
- `held` — holdJSON or null (detail mode)
- `repair_*`, `unacknowledged`, `unannounced`, `parked`, `unreachable`
- `attempts[]` — last 5: `{ordinal, lifecycle, harness, model, effort, execution_class, profile, planned_against, routing_source, worktree}`
- `latest_send` — `{id, task_id, attempt_id, origin, state, reason_code?, created_at, finalized_at?, needs_attention?, retry_safe?}`

### `holdJSON`

`{id, kind: operator|blocked|limit, reason, blocked_on?, set_at, inferred?, inconsistent?}`

## 3. Task creation semantics (important)

**There is no "create task without launching".** `hand spawn <id> <project>` both
creates the task and dispatches the worker:

1. The brief must already exist at **`data/<id>/brief.md`** (precondition error otherwise).
   Optional front-matter may set `model`, `effort`, `execution_class`, `planned_against`.
2. `hand spawn <id> <project> [--scout] [--profile P] [--harness H] [--model M] [--effort E]`
3. ID rules (`state.ValidateID`): `[A-Za-z0-9._-]+`, no path separators, not `.`/`..`.

So the GUI's "create task" = write brief file → spawn. The UI must be honest that
creating dispatches a worker immediately.

Scout deliverable: `data/<id>/report.md`.

## 4. Mutations

| GUI action | hand command | Exit codes | Destructive |
|---|---|---|---|
| send instruction | `hand send <id> <msg>` | 0; 3 pre; 6 not-submitted (retry-safe); 7 uncertain (do NOT blind-retry) | no |
| retry | `hand reopen <id>` | 0; 3 | starts new attempt |
| promote scout→ship | `hand promote <id>` | 0; 3 | converts, returns scout worktree |
| stop worker | `hand teardown <id> --force` | 0; 3 | **yes** — terminalizes task, returns worktree, closes pane |
| cleanup after landing | `hand teardown <id>` | 0; 3 | yes |
| hold | `hand hold set <id> --kind operator|blocked --reason T [--blocked-on id]` / `hold clear <id>` | 0; 2; 3 | no |
| mark delivered | `hand deliver <id> --reason T` | 0; 2; 3 | no |
| acknowledge report | `hand ack <id> [--reason T]` | 0; 3 | no |
| record PR | `hand pr <id> <url>` (github.com PR URL pattern) | 0; 2; 3 | no |
| merge | `hand merge <id> [--squash\|--merge\|--rebase\|--local]` | 0; 3 | **yes** |
| init fleet | `hand init [path]` | 0 | no (asks nothing) |

There is **no pause command**; an operator hold is the closest non-destructive equivalent.

## 5. Error contract

Failure = single TOON error document on **stderr**; exit code is authoritative.

```text
error: <message>
kind: <kind>
exit: <code>
help[N]:
  - <next step>
```

| exit | kind |
|---|---|
| 1 | general |
| 2 | usage |
| 3 | precondition (nothing changed; fix state and rerun) |
| 4 | no-event (watch timeout) |
| 5 | arm-failed |
| 6 | send-not-submitted (retry-safe) |
| 7 | send-uncertain (never blind-retry) |
| 8/9 | watch interrupted/replaced |

## 6. Read-only files (safe for GUI)

| Path | Contents |
|---|---|
| `state/<id>.status` | append-only report lines (`"state: note"`, one per line) — the worker log stream |
| `state/events.log` | watcher event log, capped 200 lines |
| `state/hand.db` | SQLite (task/attempt/project/hold/send_attempt/meta). **Do not write.** Schema is version-checked; rows hand would never write are treated as corruption. Prefer CLI JSON. |
| `state/index.db` | FTS5 index over `data/` (derived; safe to delete) |
| `data/<id>/brief.md` | task brief (must exist pre-spawn; GUI may create) |
| `data/<id>/report.md` | scout report |
| `data/*.md` | prose corpus: backlog, operator, learnings, projects, archives |
| `config/routes/<kind>.<class>` | file content = profile name |
| `config/profiles/<name>/…` | profile generations |

## 7. Routes & providers

- `hand config` (TOON): `harnesses[N]{name,installed,model,effort}`, `profiles[N]{name,harness,model,effort}`, `routes[6]{kind,execution_class,profile,state}`, `problems[N]{...}`.
- Route grid = full cross-product scout/ship × mechanical/standard/deep (6 cells); state per cell: `configured|missing|malformed`.
- Writes: `hand config route set`, `hand config profile set` — validated by hand. UI stays read-only for now (capability-gated).
- Profile names, model choices, and route policy are operator-owned; Serenade must not invent a global default harness.
- Harnesses observed installed during live verification: claude, codex, opencode (grok/pi not).
- Serenade's **Supervisor chat is separate from worker routing** and currently launches `opencode` directly. Worker profiles/routes may use other Hand-supported harnesses.

## 8. Events (`hand watch --until-event`)

- Blocking event source: exits 0 on event, 4 on timeout, 8/9 on interruption/takeover.
- stdout = one prose line per event (`"<kind> <id>: <note>"`); kinds: `idle-unreported, blocked, failed, stale, pr-merged, gate-absent, gate-unknown, pr-not-recorded, pr-record-unknown, report-working, report-paused, report-blocked, report-needs-decision, report-done, report-failed, report-malformed, parked, usage-limit, usage-limit-resumed, usage-limit-stuck`.
- Only one watcher owns a fleet at a time (`--takeover` to displace).
- MVP GUI reads `state/events.log` instead; watch streaming is post-MVP.

## 9. Capability matrix (hand 0.6.0 — verified)

| Capability | Supported | Notes |
|---|---|---|
| Task list / detail (structured) | **yes** | `status --json` |
| Projects (structured) | **yes** | `project list --json` |
| Create task | **yes** | write brief + `spawn`; dispatches worker immediately |
| Stop task | **destructive-only** | `teardown --force`; requires confirmation |
| Retry task | **yes** | `reopen` |
| Send worker message | **yes** | `send`; exits 6/7 encode retry-safety |
| Pause worker | **no** | operator hold is the closest equivalent |
| Promote scout | **yes** | `promote` |
| Routes read | **yes** | TOON parse of `hand config` |
| Routes write | **yes** (CLI) | UI read-only pending safety review |
| Reports | **yes** | `data/<id>/report.md` files |
| Structured logs | **partial** | `state/<id>.status` plain lines; cursor = line offset |
| Full-text search | **yes** | `search --json` (unused by UI yet) |

## 10. Windows runtime requirements (verified live)

1. **herdr panes must run a POSIX shell.** hand types POSIX-syntax worker launch
   commands (`VAR=val cmd && …`) into herdr panes and fails closed on cmd.exe /
   PowerShell (the command sits at a `>>` continuation prompt and the harness
   never starts). Fix: set herdr's shell to Git Bash and reload:
   `%APPDATA%\herdr\config.toml` → `[terminal] default_shell = "C:\Program Files\Git\bin\bash.exe"`,
   then `herdr server reload-config`.
2. **herdr server must be running** before spawn (`herdr` in any window, or
   `herdr status server` to check). spawn fails with `server_not_running` otherwise.
3. **treehouse install can dangle**: the `.local\bin\treehouse.cmd` shim can
   outlive its target (`AppData\Local\treehouse\treehouse.exe`). `hand doctor`
   reports it installed (presence check) while `treehouse --version` fails.
   Reinstall: `irm https://kunchenguid.github.io/treehouse/install.ps1 | iex`.
4. **Claude Code harness shows a trust dialog** ("Allow external CLAUDE.md file
   imports?") when the operator's global config imports files. hand refuses to
   answer unknown dialogs; the operator must answer it once per project in the
   herdr pane, or route that work through another already-configured Hand profile.
5. A spawn that fails mid-launch (harness never confirmed) leaves the task
   `open/provisioning`. `hand reconcile <id>` unwinds it cleanly ("unwind-failed-
   provisioning"), after which `hand reopen <id>` retries. There is no
   non-destructive stop for a provisioning task.

Live verification: scout `survey-kanvas` on project `Kanvas-Kosong-Web`
(local-only mode), harness opencode, treehouse v2.3.0, herdr 0.8.2 — attempt
reached `running` with `agent_state: working`.

## 11. UI status derivation (hand → board columns)

hand has no board states; Serenade derives them:

| UI status | Derived from |
|---|---|
| `scouting` | kind=scout, task_lifecycle=open, attempt running/provisioning |
| `in_progress` | kind=ship, open, attempt running/provisioning |
| `review` | open + reported=done/needs-decision (or PR recorded), not merged |
| `blocked` | reported=blocked/needs-decision/paused, or held |
| `done` | terminal + merged/delivered (or reported done) |
| `failed` | attempt failed/interrupted (terminal or latest attempt) |
| `stopped` | terminal, unlanded, no failure |
| `backlog`/`queued` | not representable — tasks exist only once spawned (brief writing in the UI can pre-stage) |
