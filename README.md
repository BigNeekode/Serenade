# Serenade

**A control interface for [Secondhand / `hand`] — a local-first control room for an AI software team.**

Serenade is a graphical desktop interface for the `hand` multi-agent coding
orchestration CLI. It makes fleets, projects, tasks, workers, worktrees, and
reports visible at a glance — without keeping a pile of terminals open.

> Serenade sits on top of `hand`; it does not reimplement the orchestration engine.

## Status

**MVP complete — real `hand` integration included.** Verified against hand 0.6.0
(`github.com/atqamz/hand`): the Tauri Rust backend shells out to `hand` with
pinned `HAND_HOME`, fixed arguments, timeouts, and typed error mapping. The UI
auto-selects the real backend inside the Tauri webview and falls back to a rich
mock when running in a plain browser (`npm run dev`).

### What works

- Fleet overview — health metrics, activity feed (from `state/events.log`), project health, provider usage, failure feed
- Projects — from `hand project list --json`, dashboard with Kanban board (statuses derived from hand's lifecycle vocabulary), timeline, all-tasks table
- Tasks — global table with filters; task detail with worker report stream (`state/<id>.status`), progress, files (worktree + git status), commits, report, details
- Task actions — create (writes `data/<id>/brief.md` + `hand spawn`), send instruction (`hand send`), retry (`hand reopen`), stop (`hand teardown --force`, confirmed), promote scout (`hand promote`)
- Agents — live attempts with harness/model/agent-state, heartbeat staleness warnings, detail panel
- Worktrees — paths from hand, enriched with read-only git metadata (branch, dirty state, changed files, ahead/behind, last commit); open in editor/folder/terminal; cleanup via `hand teardown` with confirmation
- Reports — `data/<id>/report.md` viewer with markdown rendering, create-task-from-report, promote scout
- Routes & providers — `hand config` route grid + harness cards with live worker counts (read-only UI)
- Settings — fleet config + validation, `hand init` from the setup screen, editor prefs, diagnostics
- Command palette / global search (`Ctrl+K`), resizable context panel, polling with refresh indicators

### Prerequisites

- Node 22+, and Rust (`cargo`) to build the desktop app
- [`hand`](https://github.com/atqamz/hand) 0.6.0+ on PATH
- A fleet home — create one in the app (Setup screen → "Initialize a fleet") or run `hand init <path>`
- For spawning workers: hand's private runtime (treehouse + herdr) — run hand's
  `bootstrap.ps1`, and a configured harness (claude/codex/opencode) via `hand config set harness <name>`

## Quickstart

```bash
npm install
npm run dev            # browser mode with mock data → http://localhost:1420
npx tauri dev          # desktop app against your real fleet
npx tauri build        # production build (src-tauri/target/release/app.exe)
```

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server (mock backend) |
| `npx tauri dev` | Desktop app with live hand backend |
| `npx tauri build` | Production desktop build |
| `npm run build` | Frontend type-check + build only |
| `npm run test` | Vitest unit/integration tests |
| `cargo test` (in `src-tauri/`) | Rust unit tests (TOON parser) |
| `npm run lint` / `typecheck` | ESLint / TypeScript |

## Stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · TanStack Query · React Router ·
react-markdown · lucide-react · Vitest + React Testing Library · (Tauri-ready)

## Structure

```text
src/                      # React frontend
├─ app/                   # App bootstrap, router (HashRouter), providers
├─ components/
│  ├─ ui/                 # Design system (Button, Badge, Dialog, DataTable, Toast, …)
│  ├─ layout/             # AppShell, Sidebar, Topbar, StatusBar, ContextPanel
│  └─ common/             # CommandPalette, MarkdownView, LastUpdated
├─ features/              # overview, projects, tasks, agents, worktrees, reports,
│                         # routes, settings, setup
├─ hooks/                 # Query hooks with polling (useProjects, useTasks, …)
├─ lib/
│  ├─ api/                # SerenadeApi interface + Mock & Tauri implementations
│  ├─ format.ts           # Time/duration/token/cost formatting
│  └─ validation.ts       # ID/path/input validation
├─ state/                 # UI store (selected project, panel width, palette)
└─ types/                 # Domain model (Project, Task, AgentRun, …)

src-tauri/src/            # Rust backend
├─ lib.rs                 # 25 Tauri commands (see architecture.md §7 names)
├─ hand/process.rs        # hand runner: fixed args, HAND_HOME, timeouts,
│                         # error-document parsing (error:/kind:/exit:/help)
├─ hand/model.rs          # serde models for hand's --json output
├─ hand/toon.rs           # TOON parser for `hand config`
├─ adapter.rs             # hand lifecycle → UI status/agent/worktree mapping
├─ fleet_files.rs         # briefs, reports, events.log, <id>.status access
├─ git.rs                 # read-only worktree git metadata
├─ local.rs               # editor/folder/terminal launching
├─ config.rs              # GUI config store (app-data JSON)
├─ domain.rs / error.rs   # domain models / typed AppError
```

### Architecture in one line

```text
React UI → query hooks → SerenadeApi → { MockSerenadeApi | TauriSerenadeApi → Rust → hand }
```

The frontend never knows CLI syntax, and the backend will never expose
arbitrary shell execution — every command is a fixed, typed action.

## Documentation

- `docs/design.md` — product & UX design
- `docs/architecture.md` — system architecture
- `docs/implementation-plan.md` — milestone plan
- `docs/tasks.md` — task backlog with status
- `docs/hand-integration-notes.md` — verified hand 0.6.0 CLI contract

## Next steps

1. Run hand's `bootstrap.ps1` for the treehouse/herdr runtime, then configure a
   harness (`hand config set harness claude|codex|opencode`) and routes.
2. Exercise live task creation from the GUI (writes brief + `hand spawn`).
3. Installer bundling (`npx tauri build`) and icons.
4. Post-MVP: `hand watch --until-event` as an event source, log timestamps,
   cost/token surfacing, route editor.
