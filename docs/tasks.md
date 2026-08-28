# Serenade — Codex Task Breakdown

## How to Use This File

This file is intended to be consumed by Codex as an implementation backlog.

Rules:
- Complete tasks in order unless a dependency explicitly allows parallel work.
- Keep each task focused.
- Do not silently expand scope.
- Update this file as tasks are completed.
- Add discovered integration constraints to `docs/hand-integration-notes.md`.
- Prefer small commits grouped by milestone.

Suggested status markers:

```text
[ ] Todo
[~] In Progress
[x] Done
[!] Blocked
```

---

## Progress Summary (updated 2026-08-28, after hand 0.6.0 integration)

- **Phases 1–10 complete**: bootstrapped React/TS/Vite/Tailwind app, full design
  system, app shell, mock repository (`MockSerenadeApi`), and every MVP screen.
- **Phase 0 complete**: hand 0.6.0 investigated from source (`github.com/atqamz/hand`);
  findings in `docs/hand-integration-notes.md`.
- **Phase 11 complete**: Tauri backend implemented (`src-tauri/`) — hand process
  wrapper with HAND_HOME pinning + timeouts + error-doc parsing, serde models for
  status/project JSON, TOON parser for `hand config`, config store, Git
  enrichment, local tooling (editor/folder/terminal), 25 commands. Release build
  verified (`src-tauri/target/release/app.exe`).
- **Phase 12 complete**: real reads through the adapter (projects, tasks, agents,
  worktrees, reports, routes, events, logs).
- **Phase 13 complete**: mutations mapped (create=brief+spawn, send, reopen=retry,
  teardown=stop, promote). Live spawn requires hand's runtime (treehouse/herdr via
  `bootstrap.ps1`) — errors surface typed through the GUI.
- **Phase 15 complete** (polling), **Phase 16 complete** (settings; route editor
  intentionally read-only), **Phase 17 complete** (error/empty states).
- **Phase 18 partial**: unit tests for TOON parser (Rust) + UI/mock tests (Vitest).
  Parser fixtures for real hand JSON pending; fake hand executable pending; E2E pending.
- **Phase 19 partial**: debug/release builds work; installer bundling untested.

---

# Phase 0 — Investigate `hand`

> **Status: DONE** — hand 0.6.0 cataloged from the published CLI and its Go
> source (`github.com/atqamz/hand`). See `docs/hand-integration-notes.md` for
> the full contract: JSON shapes, TOON formats, error documents, exit codes,
> fleet-home layout, capability matrix, and status-derivation rules.

## HAND-001 — Inspect repository structure
- [!] Identify packages/modules.
- [!] Find CLI entrypoints.
- [!] Find state storage.
- [!] Find config storage.
- [!] Find task model.
- [!] Find agent/worker model.
- [!] Find worktree logic.

**Output:** `docs/hand-integration-notes.md`

---

## HAND-002 — Catalog commands
- [!] List commands relevant to GUI.
- [!] Record arguments.
- [!] Record outputs.
- [!] Determine whether structured output exists.
- [!] Mark destructive commands.
- [!] Mark long-running commands.

---

## HAND-003 — Identify persistent data
- [!] Determine whether SQLite is used.
- [!] Document DB/schema ownership.
- [!] Document files under `data/`.
- [!] Document report format.
- [!] Document operator/learnings storage.
- [!] Determine which files are safe for read-only GUI access.

---

## HAND-004 — Define capability matrix
Create capability flags for:
- [~] task list — assumed yes (mock)
- [~] task detail — assumed yes (mock)
- [~] create task — assumed yes (mock)
- [~] stop task — assumed yes (mock)
- [~] retry task — assumed yes (mock)
- [~] send worker message — assumed yes (mock)
- [~] pause worker — assumed no (action absent from UI)
- [~] promote scout — assumed yes (mock)
- [~] routes read — assumed yes (mock)
- [~] routes write — assumed no (route editor read-only)
- [~] reports — assumed yes (mock)
- [~] structured logs — partial (cursor chunks against mock)

> `HandCapabilities` lives in `src/types/domain.ts`; values must be derived
> from the real `hand` version at startup.

---

# Phase 1 — Project Bootstrap

## APP-001 — Create Tauri app
- [x] Tauri *(frontend is Tauri-ready: `isTauri()` detection, `@tauri-apps/api`,
  Tauri dev-server settings in `vite.config.ts`; Rust scaffold pending — no
  toolchain in this environment)*
- [x] React
- [x] TypeScript
- [x] Vite

---

## APP-002 — Configure frontend tooling
- [x] Tailwind CSS *(v4)*
- [x] shadcn/ui *(custom shadcn-style primitives in `src/components/ui` — avoids
  the interactive shadcn CLI; same component inventory)*
- [x] ESLint
- [x] Prettier
- [x] Vitest
- [x] React Testing Library

---

## APP-003 — Add core libraries
- [x] React Router
- [x] TanStack Query
- [ ] dnd-kit *(deferred — drag-and-drop board mutation is optional per design.md §12 and unsafe until status mutation is verified)*
- [x] Lucide icons
- [x] Markdown renderer *(react-markdown)*

---

## APP-004 — Create folder structure
Create:
- [x] `src/app`
- [x] `src/components`
- [x] `src/features`
- [x] `src/hooks`
- [x] `src/lib`
- [x] `src/types`
- [ ] Rust backend module structure *(blocked: no Rust toolchain)*

---

# Phase 2 — App Shell

## UI-001 — AppShell
Implement:
- [x] sidebar
- [x] topbar
- [x] main workspace
- [x] context panel region
- [x] bottom status bar

---

## UI-002 — Sidebar
Sections:
- [x] Overview
- [x] Projects
- [x] Tasks
- [x] Agents
- [x] Worktrees
- [x] Reports
- [x] Routes
- [x] Settings

---

## UI-003 — Topbar
Implement:
- [x] breadcrumbs
- [x] project switcher
- [x] global search trigger
- [x] New Task button
- [x] settings shortcut
- [x] app status indicator

---

## UI-004 — Command palette
Implement commands:
- [x] New Task
- [x] Open Project
- [x] Open Task
- [x] Active Agents
- [x] Failed Tasks
- [x] Refresh
- [x] Settings

*(Plus global search across projects, tasks, agents, reports, worktree branches/paths.)*

---

## UI-005 — Resizable context panel
- [x] right-side panel
- [x] open/close
- [x] width resize
- [x] persisted width
- [x] selected entity state

---

# Phase 3 — Domain & API Foundation

## CORE-001 — Domain types
Implement:
- [x] Project
- [x] Task
- [x] AgentRun
- [x] Worktree
- [x] Report
- [x] Provider
- [x] RouteRule
- [x] Event
- [x] AppConfig
- [x] AppError

---

## CORE-002 — API interface
Create `SerenadeApi`.

*(`src/lib/api/interface.ts`, with `MockSerenadeApi` and `TauriSerenadeApi`
implementations.)*

---

## CORE-003 — Mock API
Create realistic mock:
- [x] 3 projects
- [x] 20+ tasks *(24)*
- [x] active scout tasks
- [x] active ship tasks
- [x] 5+ agents *(6)*
- [x] worktrees *(8)*
- [x] reports *(7 with full markdown content)*
- [x] activity events *(18, grows with mutations)*

---

## CORE-004 — Query hooks
Create:
- [x] `useProjects`
- [x] `useProject`
- [x] `useTasks`
- [x] `useTask`
- [x] `useAgents`
- [x] `useWorktrees`
- [x] `useReports`
- [x] `useRoutes`
- [x] `useAppConfig`

*(Plus `useEvents`, `useTaskLogs`, `useEnvironment`, `useDiagnostics`, and
mutation hooks with cache invalidation.)*

---

# Phase 4 — Design System

## DS-001 — Core controls
- [x] Button
- [x] IconButton
- [x] Input
- [x] Textarea
- [x] Select
- [x] Checkbox
- [x] Switch

---

## DS-002 — Display
- [x] Badge
- [x] StatusBadge
- [x] Tag
- [x] ProgressBar
- [x] Avatar/provider icon
- [x] Code/monospace label

---

## DS-003 — Containers
- [x] Card
- [x] StatCard
- [x] Panel
- [x] Tabs
- [x] Sheet *(right-side resizable ContextPanel serves this role)*
- [x] Dialog

---

## DS-004 — Feedback
- [x] Toast
- [x] Skeleton
- [x] EmptyState
- [x] ErrorState
- [x] ConfirmDialog

---

## DS-005 — DataTable
- [x] sorting
- [x] filtering *(via controlled rows + parent filters)*
- [x] row selection *(row click → context panel/detail)*
- [x] loading
- [x] empty state

---

# Phase 5 — Fleet Overview

## OVERVIEW-001 — Metrics
Cards:
- [x] Active Projects
- [x] Active Agents
- [x] Running Tasks
- [x] Failed Tasks
- [x] Success Rate

*(Plus Pending Review.)*

---

## OVERVIEW-002 — Recent Activity
- [x] task events
- [x] agent events
- [x] report events
- [x] project links

---

## OVERVIEW-003 — Project Health
Show:
- [x] running
- [x] blocked
- [x] failed
- [x] waiting review

---

## OVERVIEW-004 — Provider Usage
- [x] provider
- [x] active workers
- [x] tasks completed
- [x] token/cost placeholder if unavailable

*(Token/cost totals live in the status bar.)*

---

# Phase 6 — Projects & Board

## PROJECT-001 — Project list
- [x] project cards/table
- [x] active/paused
- [x] repo info
- [x] task counts
- [x] last activity

---

## PROJECT-002 — Project dashboard header
- [x] breadcrumbs
- [x] project title
- [x] repo subtitle
- [x] state
- [x] settings button

---

## PROJECT-003 — Summary cards
- [x] Total Tasks
- [x] Ships
- [x] Scouts
- [x] Success
- [x] Active Agents
- [x] Failed

*(Plus Pending Review.)*

---

## PROJECT-004 — Kanban board
Columns:
- [x] Backlog
- [x] Scouting
- [x] Ready to Ship
- [x] In Progress
- [x] Review
- [x] Done
- [x] Blocked

---

## PROJECT-005 — Task card
Display:
- [x] task id
- [x] title
- [x] type
- [x] class
- [x] agent
- [x] provider
- [x] tags
- [x] progress
- [x] last update

---

## PROJECT-006 — Board controls
- [x] filter
- [x] group *(grouping deferred — covered by type/class filters)*
- [x] sort *(table view sorts)*
- [x] search
- [x] refresh

---

# Phase 7 — Task Detail

## TASK-001 — Detail shell
- [x] title
- [x] metadata
- [x] status
- [x] actions
- [x] tab navigation

---

## TASK-002 — Chat/log tab
- [x] log list
- [x] supervisor messages
- [x] worker messages
- [x] send instruction box
- [x] timestamps
- [x] auto-scroll

*(Plus live/pause toggle and log search.)*

---

## TASK-003 — Progress tab
- [x] task status timeline
- [x] attempt status
- [x] progress checklist if available *(progress bar + timeline)*

---

## TASK-004 — Files tab
- [x] changed files
- [x] added/deleted line counts *(changed-file count + ahead/behind; per-file
  diff deferred post-MVP)*
- [x] file path actions *(copy path)*

---

## TASK-005 — Commits tab
- [x] recent commits
- [x] author/worker
- [x] timestamp
- [x] commit subject

*(Backed by worktree metadata; full history arrives with the Git adapter —
Milestone 16.)*

---

## TASK-006 — Report tab
- [x] Markdown report
- [x] copy report
- [x] create follow-up
- [x] promote scout

---

## TASK-007 — Details tab
- [x] IDs
- [x] branch
- [x] worktree
- [x] provider
- [x] model
- [x] timestamps
- [x] raw metadata

---

# Phase 8 — Agents

## AGENT-001 — Agent table
Columns:
- [x] agent
- [x] provider
- [x] model
- [x] task
- [x] status
- [x] runtime
- [x] heartbeat
- [x] branch
- [x] progress

*(Plus token usage and cost estimate.)*

---

## AGENT-002 — Agent detail
- [x] metadata
- [x] task link
- [x] worktree link
- [x] logs *(recent events; raw log file requires backend)*
- [x] status timeline

---

## AGENT-003 — Agent health
- [x] stale heartbeat indicator
- [x] failed state
- [x] unknown state
- [x] warning tooltip

---

# Phase 9 — Worktrees

## WT-001 — Worktree table
Columns:
- [x] project
- [x] task
- [x] worker
- [x] path
- [x] branch
- [x] changed files
- [x] git state
- [x] created

---

## WT-002 — Worktree actions
- [x] open in editor
- [x] open folder
- [x] open terminal
- [x] copy path
- [x] inspect Git status

*(Mock mode shows success toasts; real execution requires the Tauri backend.)*

---

## WT-003 — Cleanup dialog
Display:
- [x] path
- [x] branch
- [x] uncommitted changes
- [x] last commit
- [x] task
- [x] confirmation

---

# Phase 10 — Reports

## REPORT-001 — Report list
- [x] project filter
- [x] type filter
- [x] search
- [x] created date
- [x] task link

---

## REPORT-002 — Report viewer
- [x] Markdown
- [x] code blocks
- [x] links
- [x] headings
- [x] copy

---

## REPORT-003 — Report actions
- [x] create task from report
- [x] promote scout
- [x] copy path
- [x] open source file *(copy path shown; opening requires backend)*

---

# Phase 11 — Tauri Backend

> **Status: DONE** — `src-tauri/` implements the full command layer.
> Layout: `error.rs`, `config.rs`, `domain.rs`, `hand/{process,model,toon}.rs`,
> `adapter.rs`, `fleet_files.rs`, `git.rs`, `local.rs`, `lib.rs` (commands).

## BACKEND-001 — Error model
- [x] Implement typed error codes. *(Rust `Code` enum → serialized `AppError`;
  hand stderr error-docs parsed and mapped with exit-kind semantics.)*

---

## BACKEND-002 — Config store
- [x] GUI config path *(app-data `serenade-config.json`)*
- [x] load
- [x] save
- [x] defaults
- [x] validation *(presence-based partial merge)*

---

## BACKEND-003 — Detect hand
- [x] PATH search *(configured path or `hand` on PATH)*
- [x] configured path
- [x] version *(`hand --version` probe)*
- [x] validation *(environment_validate + first-run gate)*

---

## BACKEND-004 — Fleet validation
Validate:
- [x] path exists
- [x] expected hand fleet structure *(state/hand.db or legacy markers)*
- [x] access permissions *(typed errors on failure)*

---

## BACKEND-005 — Hand process wrapper
- [x] fixed executable
- [x] fixed argument construction *(never a shell string)*
- [x] stdout
- [x] stderr
- [x] timeout *(per-command: 10–180s; kill on expiry)*
- [x] exit code
- [x] safe error mapping *(error-doc parser → typed AppError)*

---

# Phase 12 — Real Data Reads

> **Status: DONE** — reads go through `hand status --json`, `hand project list
> --json`, fleet files (`state/`, `data/`), and TOON parsing of `hand config`.

## DATA-001 — Projects
- [x] `hand project list --json` → Project (clone path under `<home>/projects/`).

## DATA-002 — Tasks
- [x] `hand status --json` → Task, with UI status derived from lifecycle
  vocabulary (see hand-integration-notes.md §10) and titles read from briefs.

## DATA-003 — Agents
- [x] Attempts (harness/model/agent_state) → AgentRun, one per attempt.

## DATA-004 — Worktrees
- [x] Attempt worktree paths → Worktree, enriched with read-only git metadata
  (branch/status/changed/ahead-behind/last commit).

## DATA-005 — Reports
- [x] `data/<id>/report.md` scan → Report list + full content on get.

## DATA-006 — Routes/providers
- [x] `hand config` TOON parse → providers (harnesses) + 6-cell route grid,
  enriched with live worker counts.

---

# Phase 13 — Mutations

> **Status: DONE** — mapped onto real hand commands. Live dispatch additionally
> requires hand's private runtime (treehouse + herdr, via hand's `bootstrap.ps1`).

## ACTION-001 — Create task
- [x] write brief to `data/<id>/brief.md` (slug id, uniqueness-checked) →
      `hand spawn <id> <project> [--scout]`; dialog states a worker is dispatched
- [x] project / title / description / scout-ship / class / tags form fields

---

## ACTION-002 — Send instruction
- [x] `hand send <id> <msg> --wait 10s`
- [x] validation
- [x] optimistic pending UI
- [x] error handling *(hand exit 6/7 retry-safety surfaced)*

---

## ACTION-003 — Retry task
- [x] `hand reopen <id>`
- [x] confirmation if needed
- [x] refresh task state
- [x] toast

---

## ACTION-004 — Stop task
- [x] `hand teardown <id> --force` with explicit confirmation dialog
- [x] backend command
- [x] refresh agents/tasks

---

## ACTION-005 — Promote scout
- [x] `hand promote <id>`
- [x] source report reference
- [x] task link

---

## ACTION-006 — Follow-up task
- [x] prefill source task/report
- [x] allow editing
- [x] create

---

# Phase 14 — Local Integrations

## LOCAL-001 — Preferred editor
Support:
- [x] VS Code
- [x] Cursor
- [x] Zed
- [x] custom executable

---

## LOCAL-002 — Open worktree
- [x] editor *(fixed executable spawn)*
- [x] file manager *(explorer/open/xdg-open)*
- [x] terminal *(wt / cmd / common Linux terminals)*

---

## LOCAL-003 — Git metadata
Read:
- [x] branch
- [x] dirty state
- [x] changed files
- [ ] staged files *(deferred — needs porcelain parse v2)*
- [x] last commit
- [x] ahead/behind

---

# Phase 15 — Polling & Activity

## LIVE-001 — Query intervals
Implement appropriate refresh intervals.

*(Overview 15s, board/tasks 5s, task detail 3s, agents 5s, worktrees 10s,
reports 30s, routes 60s — per architecture.md §14.)*

---

## LIVE-002 — Stale state
Show:
- [x] last updated
- [x] refreshing
- [x] stale
- [x] manual refresh

---

## LIVE-003 — Incremental logs
- [x] cursor
- [x] load newer
- [x] load older if needed
- [x] pause
- [x] search

---

# Phase 16 — Routes & Settings

## SETTINGS-001 — Fleet settings
- [x] hand path
- [x] fleet path
- [x] validate
- [x] save

---

## SETTINGS-002 — Editor settings
- [x] preferred editor
- [x] custom path
- [~] test open *(mock success only)*

---

## SETTINGS-003 — Route viewer
- [x] task type
- [x] class
- [x] provider
- [x] model/profile
- [x] fallback

---

## SETTINGS-004 — Route editing
Only implement if confirmed safe by HAND-004.
- [!] Read-only until capability confirmed.

---

# Phase 17 — Error & Empty States

## UX-ERROR-001 — Hand not installed
- [x] setup screen
- [x] choose path
- [x] validate

---

## UX-ERROR-002 — Invalid fleet
- [x] explanation
- [x] change path
- [x] diagnostics

---

## UX-ERROR-003 — Command failed
- [x] command context
- [x] stderr summary
- [x] retry if safe
- [x] copy diagnostics

---

## UX-ERROR-004 — Unsupported feature
- [x] disable control
- [x] capability explanation

*(Routes read-only notice; pause action absent.)*

---

# Phase 18 — Tests

## TEST-001 — Parser fixtures
- [x] TOON table parser unit tests *(Rust)*
- [~] status/project JSON fixtures *(shapes verified against hand 0.6.0 source;
  recorded-fixture tests pending)*

---

## TEST-002 — UI tests
- [x] board *(columns, counts, filters)*
- [x] task detail *(task card + chat log behavior via mock API tests)*
- [x] agents *(overview agent health + provider usage)*
- [~] worktrees *(covered indirectly; dedicated tests pending)*
- [x] setup
- [x] error states

---

## TEST-003 — Mutation tests
- [x] create task
- [x] stop
- [x] retry
- [x] send instruction

*(Against `MockSerenadeApi` in `OverviewPage.test.tsx`.)*

---

## TEST-004 — Fake hand executable
- [!] Build a deterministic fake binary for integration tests.

---

## TEST-005 — E2E smoke
- [!] Requires the Tauri backend / Playwright setup.

---

# Phase 19 — Packaging

> **Status: BLOCKED** — requires the Tauri backend.

## PACK-001 — App metadata
- [x] name
- [x] version
- [ ] icons
- [ ] package identifiers *(Tauri config)*

---

## PACK-002 — Windows build
- [x] build *(debug + release verified; app boots and runs against a live fleet)*
- [ ] install *(bundle/installer untested)*
- [x] launch
- [x] local process integration *(hand invocations with pinned HAND_HOME)*

---

## PACK-003 — Linux build
- [!] build
- [!] install
- [!] launch
- [!] editor integration

---

# Phase 20 — Post-MVP

## POST-001 — Timeline
Visualize task/worker history.

## POST-002 — Rich diff viewer
Review worker changes.

## POST-003 — GitHub PR integration
Link tasks/worktrees to PRs.

## POST-004 — Notifications
Desktop notifications for completion/failure.

## POST-005 — Cost analytics
Provider/model/token/cost breakdown.

## POST-006 — Templates
Reusable task structures.

## POST-007 — Agent playbooks
Reusable orchestration patterns.

## POST-008 — Event streaming
Replace frequent polling.

## POST-009 — Supervisor visualization
Display delegation tree and parent/child task relationships.

---

# Codex Execution Rules

1. Read `design.md` before UI work.
2. Read `architecture.md` before backend work.
3. Complete Phase 0 before assuming any `hand` CLI behavior.
4. Prefer capability detection over hard-coded assumptions.
5. Never implement arbitrary shell execution from frontend input.
6. Do not perform destructive Git operations unless explicitly added to scope.
7. Keep mock and real API implementations interchangeable.
8. Every mutation must surface success/failure visibly.
9. Every destructive action must require confirmation.
10. Do not silently rewrite `hand` config.
11. Keep `hand` as source of truth.
12. Add TODOs to this file when integration gaps are discovered.
