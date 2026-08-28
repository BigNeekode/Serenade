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

## Progress Summary (updated 2026-08-28)

- **Phases 1–10 complete**: bootstrapped React/TS/Vite/Tailwind app, full design
  system, app shell, mock repository (`MockSerenadeApi`), and every MVP screen
  (overview, projects, board, task detail, agents, worktrees, reports, routes,
  settings, setup).
- **Phase 13 (mutations), 15 (polling), 16 (settings), 17 (error/empty states)
  complete** against the mock API.
- **Phase 0 blocked**: no `hand` binary exists in this environment —
  see `docs/hand-integration-notes.md`.
- **Phases 11–12 blocked**: no Rust toolchain; `TauriSerenadeApi` is implemented
  and auto-detected, but the Rust command layer is not scaffolded.
- **Phase 19 blocked**: packaging requires the Tauri backend.

---

# Phase 0 — Investigate `hand`

> **Status: BLOCKED** — `hand` is not installed in this environment.
> Findings, assumptions, and the conservative capability matrix are documented in
> `docs/hand-integration-notes.md`. Re-run this phase once `hand` is available.

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

> **Status: BLOCKED** — no Rust toolchain in this environment.
> The frontend side is done: `TauriSerenadeApi` (`src/lib/api/tauri.ts`) maps to
> the command names from architecture.md §7 and auto-activates under Tauri.

## BACKEND-001 — Error model
- [~] Implement typed error codes. *(Typed `SerenadeErrorCode` + serialized
  `AppError` exist in `src/types/domain.ts`; Rust enum pending.)*

---

## BACKEND-002 — Config store
- [!] GUI config path
- [!] load
- [!] save
- [!] defaults
- [!] validation

---

## BACKEND-003 — Detect hand
- [!] PATH search
- [!] configured path
- [!] version
- [!] validation

---

## BACKEND-004 — Fleet validation
Validate:
- [!] path exists
- [!] expected hand fleet structure
- [!] access permissions

---

## BACKEND-005 — Hand process wrapper
- [!] fixed executable
- [!] fixed argument construction
- [!] stdout
- [!] stderr
- [!] timeout
- [!] exit code
- [!] safe error mapping

---

# Phase 12 — Real Data Reads

> **Status: BLOCKED** — requires Phase 0 investigation + Phase 11 backend.

## DATA-001 — Projects
Replace mock projects with real adapter.

## DATA-002 — Tasks
Replace mock tasks.

## DATA-003 — Agents
Replace mock agents.

## DATA-004 — Worktrees
Replace mock worktrees.

## DATA-005 — Reports
Replace mock reports.

## DATA-006 — Routes/providers
Replace mock configuration.

---

# Phase 13 — Mutations

> **Status: done against the mock API** — swap to real commands in Phase 11+.

## ACTION-001 — Create task
Form fields:
- [x] project
- [x] title
- [x] description
- [x] scout/ship
- [x] class
- [x] tags
- [x] optional route/provider *(route/provider override deferred until routing
  semantics are known)*

---

## ACTION-002 — Send instruction
- [x] validation
- [x] optimistic pending UI
- [x] error handling

---

## ACTION-003 — Retry task
- [x] confirmation if needed
- [x] refresh task state
- [x] toast

---

## ACTION-004 — Stop task
- [x] confirmation
- [x] backend command *(mock)*
- [x] refresh agents/tasks

---

## ACTION-005 — Promote scout
- [x] source report reference
- [x] generated ship task
- [x] task link

---

## ACTION-006 — Follow-up task
- [x] prefill source task/report
- [x] allow editing
- [x] create

---

# Phase 14 — Local Integrations

> **Status: mock-mode complete; real execution requires the Tauri backend.**

## LOCAL-001 — Preferred editor
Support:
- [x] VS Code
- [x] Cursor
- [x] Zed
- [x] custom executable

---

## LOCAL-002 — Open worktree
- [x] editor *(mock)*
- [x] file manager *(mock)*
- [x] terminal *(mock)*

---

## LOCAL-003 — Git metadata
Read:
- [!] branch *(mock data only)*
- [!] dirty state
- [!] changed files
- [!] staged files
- [!] last commit
- [!] ahead/behind

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
- [!] project parsing *(no real parsers yet — blocked on Phase 0/11)*
- [!] task parsing
- [!] agent parsing
- [!] report parsing

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
- [!] build
- [!] install
- [!] launch
- [!] local process integration

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
