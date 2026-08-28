# Serenade

**A control interface for [Secondhand / `hand`] — a local-first control room for an AI software team.**

Serenade is a graphical desktop interface for the `hand` multi-agent coding
orchestration CLI. It makes fleets, projects, tasks, workers, worktrees, and
reports visible at a glance — without keeping a pile of terminals open.

> Serenade sits on top of `hand`; it does not reimplement the orchestration engine.

## Status

- **Frontend MVP: complete** (mock-data driven — see `docs/hand-integration-notes.md`).
- **Tauri backend: not scaffolded** — requires a Rust toolchain and a real
  `hand` binary, neither of which exist in the current environment. The UI is
  Tauri-ready: `TauriSerenadeApi` activates automatically when running inside a
  Tauri webview.

### What works today (mock mode)

- Fleet overview — health metrics, activity feed, project health, provider usage, failure feed
- Projects — list + dashboard with summary cards, Kanban board (7 columns), timeline, all-tasks table
- Tasks — global table with filters, task detail (chat/logs with instruction sending, progress, files, commits, report, details), create / follow-up / promote flows
- Agents — live table with runtime, heartbeat staleness warnings, tokens/cost, detail panel
- Worktrees — git status, changed files, ahead/behind, open-in-editor actions, cleanup confirmation
- Reports — searchable list, markdown viewer, create-task-from-report, promote scout
- Routes & providers — read-only route rules and provider cards
- Settings — fleet config + validation, editor, UI prefs, diagnostics
- First-run setup screen when the environment is invalid
- Command palette / global search (`Ctrl+K`), resizable context panel, polling with refresh indicators

## Quickstart

```bash
npm install
npm run dev        # http://localhost:1420
```

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check + production build |
| `npm run test` | Vitest unit/integration tests |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript project check |
| `npm run format` | Prettier |

## Stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · TanStack Query · React Router ·
react-markdown · lucide-react · Vitest + React Testing Library · (Tauri-ready)

## Structure

```text
src/
├─ app/            # App shell bootstrap, router, providers, query client
├─ components/
│  ├─ ui/          # Design system (Button, Badge, Dialog, DataTable, Toast, …)
│  ├─ layout/      # AppShell, Sidebar, Topbar, StatusBar, ContextPanel
│  └─ common/      # CommandPalette, MarkdownView, LastUpdated
├─ features/       # overview, projects, tasks, agents, worktrees, reports,
│                  # routes, settings, setup
├─ hooks/          # Query hooks with polling (useProjects, useTasks, …)
├─ lib/
│  ├─ api/         # SerenadeApi interface + Mock & Tauri implementations
│  ├─ format.ts    # Time/duration/token/cost formatting
│  └─ validation.ts# ID/path/input validation
├─ state/          # UI store (selected project, panel width, palette)
└─ types/          # Domain model (Project, Task, AgentRun, …)
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
- `docs/hand-integration-notes.md` — Phase 0 findings & blockers

## Next steps

1. Install `hand` + Rust toolchain, then complete Phase 0 investigation
   (`docs/hand-integration-notes.md`).
2. Scaffold the Tauri backend (`src-tauri/`) and implement the command layer
   against the real CLI (Phases 11–12).
3. Swap mock reads for adapter reads (Phase 12, DATA-001…006).
4. Packaging (Phase 19).
