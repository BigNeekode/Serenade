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

# Phase 0 — Investigate `hand`

## HAND-001 — Inspect repository structure
- [ ] Identify packages/modules.
- [ ] Find CLI entrypoints.
- [ ] Find state storage.
- [ ] Find config storage.
- [ ] Find task model.
- [ ] Find agent/worker model.
- [ ] Find worktree logic.

**Output:** `docs/hand-integration-notes.md`

---

## HAND-002 — Catalog commands
- [ ] List commands relevant to GUI.
- [ ] Record arguments.
- [ ] Record outputs.
- [ ] Determine whether structured output exists.
- [ ] Mark destructive commands.
- [ ] Mark long-running commands.

---

## HAND-003 — Identify persistent data
- [ ] Determine whether SQLite is used.
- [ ] Document DB/schema ownership.
- [ ] Document files under `data/`.
- [ ] Document report format.
- [ ] Document operator/learnings storage.
- [ ] Determine which files are safe for read-only GUI access.

---

## HAND-004 — Define capability matrix
Create capability flags for:
- [ ] task list
- [ ] task detail
- [ ] create task
- [ ] stop task
- [ ] retry task
- [ ] send worker message
- [ ] pause worker
- [ ] promote scout
- [ ] routes read
- [ ] routes write
- [ ] reports
- [ ] structured logs

---

# Phase 1 — Project Bootstrap

## APP-001 — Create Tauri app
- [ ] Tauri
- [ ] React
- [ ] TypeScript
- [ ] Vite

---

## APP-002 — Configure frontend tooling
- [ ] Tailwind CSS
- [ ] shadcn/ui
- [ ] ESLint
- [ ] Prettier
- [ ] Vitest
- [ ] React Testing Library

---

## APP-003 — Add core libraries
- [ ] React Router
- [ ] TanStack Query
- [ ] dnd-kit
- [ ] Lucide icons
- [ ] Markdown renderer

---

## APP-004 — Create folder structure
Create:
- [ ] `src/app`
- [ ] `src/components`
- [ ] `src/features`
- [ ] `src/hooks`
- [ ] `src/lib`
- [ ] `src/types`
- [ ] Rust backend module structure

---

# Phase 2 — App Shell

## UI-001 — AppShell
Implement:
- [ ] sidebar
- [ ] topbar
- [ ] main workspace
- [ ] context panel region
- [ ] bottom status bar

---

## UI-002 — Sidebar
Sections:
- [ ] Overview
- [ ] Projects
- [ ] Tasks
- [ ] Agents
- [ ] Worktrees
- [ ] Reports
- [ ] Routes
- [ ] Settings

---

## UI-003 — Topbar
Implement:
- [ ] breadcrumbs
- [ ] project switcher
- [ ] global search trigger
- [ ] New Task button
- [ ] settings shortcut
- [ ] app status indicator

---

## UI-004 — Command palette
Implement commands:
- [ ] New Task
- [ ] Open Project
- [ ] Open Task
- [ ] Active Agents
- [ ] Failed Tasks
- [ ] Refresh
- [ ] Settings

---

## UI-005 — Resizable context panel
- [ ] right-side panel
- [ ] open/close
- [ ] width resize
- [ ] persisted width
- [ ] selected entity state

---

# Phase 3 — Domain & API Foundation

## CORE-001 — Domain types
Implement:
- [ ] Project
- [ ] Task
- [ ] AgentRun
- [ ] Worktree
- [ ] Report
- [ ] Provider
- [ ] RouteRule
- [ ] Event
- [ ] AppConfig
- [ ] AppError

---

## CORE-002 — API interface
Create `SerenadeApi`.

---

## CORE-003 — Mock API
Create realistic mock:
- [ ] 3 projects
- [ ] 20+ tasks
- [ ] active scout tasks
- [ ] active ship tasks
- [ ] 5+ agents
- [ ] worktrees
- [ ] reports
- [ ] activity events

---

## CORE-004 — Query hooks
Create:
- [ ] `useProjects`
- [ ] `useProject`
- [ ] `useTasks`
- [ ] `useTask`
- [ ] `useAgents`
- [ ] `useWorktrees`
- [ ] `useReports`
- [ ] `useRoutes`
- [ ] `useAppConfig`

---

# Phase 4 — Design System

## DS-001 — Core controls
- [ ] Button
- [ ] IconButton
- [ ] Input
- [ ] Textarea
- [ ] Select
- [ ] Checkbox
- [ ] Switch

---

## DS-002 — Display
- [ ] Badge
- [ ] StatusBadge
- [ ] Tag
- [ ] ProgressBar
- [ ] Avatar/provider icon
- [ ] Code/monospace label

---

## DS-003 — Containers
- [ ] Card
- [ ] StatCard
- [ ] Panel
- [ ] Tabs
- [ ] Sheet
- [ ] Dialog

---

## DS-004 — Feedback
- [ ] Toast
- [ ] Skeleton
- [ ] EmptyState
- [ ] ErrorState
- [ ] ConfirmDialog

---

## DS-005 — DataTable
- [ ] sorting
- [ ] filtering
- [ ] row selection
- [ ] loading
- [ ] empty state

---

# Phase 5 — Fleet Overview

## OVERVIEW-001 — Metrics
Cards:
- [ ] Active Projects
- [ ] Active Agents
- [ ] Running Tasks
- [ ] Failed Tasks
- [ ] Success Rate

---

## OVERVIEW-002 — Recent Activity
- [ ] task events
- [ ] agent events
- [ ] report events
- [ ] project links

---

## OVERVIEW-003 — Project Health
Show:
- [ ] running
- [ ] blocked
- [ ] failed
- [ ] waiting review

---

## OVERVIEW-004 — Provider Usage
- [ ] provider
- [ ] active workers
- [ ] tasks completed
- [ ] token/cost placeholder if unavailable

---

# Phase 6 — Projects & Board

## PROJECT-001 — Project list
- [ ] project cards/table
- [ ] active/paused
- [ ] repo info
- [ ] task counts
- [ ] last activity

---

## PROJECT-002 — Project dashboard header
- [ ] breadcrumbs
- [ ] project title
- [ ] repo subtitle
- [ ] state
- [ ] settings button

---

## PROJECT-003 — Summary cards
- [ ] Total Tasks
- [ ] Ships
- [ ] Scouts
- [ ] Success
- [ ] Active Agents
- [ ] Failed

---

## PROJECT-004 — Kanban board
Columns:
- [ ] Backlog
- [ ] Scouting
- [ ] Ready to Ship
- [ ] In Progress
- [ ] Review
- [ ] Done
- [ ] Blocked

---

## PROJECT-005 — Task card
Display:
- [ ] task id
- [ ] title
- [ ] type
- [ ] class
- [ ] agent
- [ ] provider
- [ ] tags
- [ ] progress
- [ ] last update

---

## PROJECT-006 — Board controls
- [ ] filter
- [ ] group
- [ ] sort
- [ ] search
- [ ] refresh

---

# Phase 7 — Task Detail

## TASK-001 — Detail shell
- [ ] title
- [ ] metadata
- [ ] status
- [ ] actions
- [ ] tab navigation

---

## TASK-002 — Chat/log tab
- [ ] log list
- [ ] supervisor messages
- [ ] worker messages
- [ ] send instruction box
- [ ] timestamps
- [ ] auto-scroll

---

## TASK-003 — Progress tab
- [ ] task status timeline
- [ ] attempt status
- [ ] progress checklist if available

---

## TASK-004 — Files tab
- [ ] changed files
- [ ] added/deleted line counts
- [ ] file path actions

---

## TASK-005 — Commits tab
- [ ] recent commits
- [ ] author/worker
- [ ] timestamp
- [ ] commit subject

---

## TASK-006 — Report tab
- [ ] Markdown report
- [ ] copy report
- [ ] create follow-up
- [ ] promote scout

---

## TASK-007 — Details tab
- [ ] IDs
- [ ] branch
- [ ] worktree
- [ ] provider
- [ ] model
- [ ] timestamps
- [ ] raw metadata

---

# Phase 8 — Agents

## AGENT-001 — Agent table
Columns:
- [ ] agent
- [ ] provider
- [ ] model
- [ ] task
- [ ] status
- [ ] runtime
- [ ] heartbeat
- [ ] branch
- [ ] progress

---

## AGENT-002 — Agent detail
- [ ] metadata
- [ ] task link
- [ ] worktree link
- [ ] logs
- [ ] status timeline

---

## AGENT-003 — Agent health
- [ ] stale heartbeat indicator
- [ ] failed state
- [ ] unknown state
- [ ] warning tooltip

---

# Phase 9 — Worktrees

## WT-001 — Worktree table
Columns:
- [ ] project
- [ ] task
- [ ] worker
- [ ] path
- [ ] branch
- [ ] changed files
- [ ] git state
- [ ] created

---

## WT-002 — Worktree actions
- [ ] open in editor
- [ ] open folder
- [ ] open terminal
- [ ] copy path
- [ ] inspect Git status

---

## WT-003 — Cleanup dialog
Display:
- [ ] path
- [ ] branch
- [ ] uncommitted changes
- [ ] last commit
- [ ] task
- [ ] confirmation

---

# Phase 10 — Reports

## REPORT-001 — Report list
- [ ] project filter
- [ ] type filter
- [ ] search
- [ ] created date
- [ ] task link

---

## REPORT-002 — Report viewer
- [ ] Markdown
- [ ] code blocks
- [ ] links
- [ ] headings
- [ ] copy

---

## REPORT-003 — Report actions
- [ ] create task from report
- [ ] promote scout
- [ ] copy path
- [ ] open source file

---

# Phase 11 — Tauri Backend

## BACKEND-001 — Error model
Implement typed error codes.

---

## BACKEND-002 — Config store
- [ ] GUI config path
- [ ] load
- [ ] save
- [ ] defaults
- [ ] validation

---

## BACKEND-003 — Detect hand
- [ ] PATH search
- [ ] configured path
- [ ] version
- [ ] validation

---

## BACKEND-004 — Fleet validation
Validate:
- [ ] path exists
- [ ] expected hand fleet structure
- [ ] access permissions

---

## BACKEND-005 — Hand process wrapper
- [ ] fixed executable
- [ ] fixed argument construction
- [ ] stdout
- [ ] stderr
- [ ] timeout
- [ ] exit code
- [ ] safe error mapping

---

# Phase 12 — Real Data Reads

## DATA-001 — Projects
Replace mock projects with real adapter.

---

## DATA-002 — Tasks
Replace mock tasks.

---

## DATA-003 — Agents
Replace mock agents.

---

## DATA-004 — Worktrees
Replace mock worktrees.

---

## DATA-005 — Reports
Replace mock reports.

---

## DATA-006 — Routes/providers
Replace mock configuration.

---

# Phase 13 — Mutations

## ACTION-001 — Create task
Form fields:
- [ ] project
- [ ] title
- [ ] description
- [ ] scout/ship
- [ ] class
- [ ] tags
- [ ] optional route/provider

---

## ACTION-002 — Send instruction
- [ ] validation
- [ ] optimistic pending UI
- [ ] error handling

---

## ACTION-003 — Retry task
- [ ] confirmation if needed
- [ ] refresh task state
- [ ] toast

---

## ACTION-004 — Stop task
- [ ] confirmation
- [ ] backend command
- [ ] refresh agents/tasks

---

## ACTION-005 — Promote scout
- [ ] source report reference
- [ ] generated ship task
- [ ] task link

---

## ACTION-006 — Follow-up task
- [ ] prefill source task/report
- [ ] allow editing
- [ ] create

---

# Phase 14 — Local Integrations

## LOCAL-001 — Preferred editor
Support:
- [ ] VS Code
- [ ] Cursor
- [ ] Zed
- [ ] custom executable

---

## LOCAL-002 — Open worktree
- [ ] editor
- [ ] file manager
- [ ] terminal

---

## LOCAL-003 — Git metadata
Read:
- [ ] branch
- [ ] dirty state
- [ ] changed files
- [ ] staged files
- [ ] last commit
- [ ] ahead/behind

---

# Phase 15 — Polling & Activity

## LIVE-001 — Query intervals
Implement appropriate refresh intervals.

---

## LIVE-002 — Stale state
Show:
- [ ] last updated
- [ ] refreshing
- [ ] stale
- [ ] manual refresh

---

## LIVE-003 — Incremental logs
- [ ] cursor
- [ ] load newer
- [ ] load older if needed
- [ ] pause
- [ ] search

---

# Phase 16 — Routes & Settings

## SETTINGS-001 — Fleet settings
- [ ] hand path
- [ ] fleet path
- [ ] validate
- [ ] save

---

## SETTINGS-002 — Editor settings
- [ ] preferred editor
- [ ] custom path
- [ ] test open

---

## SETTINGS-003 — Route viewer
- [ ] task type
- [ ] class
- [ ] provider
- [ ] model/profile
- [ ] fallback

---

## SETTINGS-004 — Route editing
Only implement if confirmed safe by HAND-004.

---

# Phase 17 — Error & Empty States

## UX-ERROR-001 — Hand not installed
- [ ] setup screen
- [ ] choose path
- [ ] validate

---

## UX-ERROR-002 — Invalid fleet
- [ ] explanation
- [ ] change path
- [ ] diagnostics

---

## UX-ERROR-003 — Command failed
- [ ] command context
- [ ] stderr summary
- [ ] retry if safe
- [ ] copy diagnostics

---

## UX-ERROR-004 — Unsupported feature
- [ ] disable control
- [ ] capability explanation

---

# Phase 18 — Tests

## TEST-001 — Parser fixtures
- [ ] project parsing
- [ ] task parsing
- [ ] agent parsing
- [ ] report parsing

---

## TEST-002 — UI tests
- [ ] board
- [ ] task detail
- [ ] agents
- [ ] worktrees
- [ ] setup
- [ ] error states

---

## TEST-003 — Mutation tests
- [ ] create task
- [ ] stop
- [ ] retry
- [ ] send instruction

---

## TEST-004 — Fake hand executable
Build a deterministic fake binary for integration tests.

---

## TEST-005 — E2E smoke
Flow:
- [ ] first launch
- [ ] configure fleet
- [ ] open project
- [ ] open task
- [ ] create scout
- [ ] send message
- [ ] inspect worktree
- [ ] read report

---

# Phase 19 — Packaging

## PACK-001 — App metadata
- [ ] name
- [ ] version
- [ ] icons
- [ ] package identifiers

---

## PACK-002 — Windows build
- [ ] build
- [ ] install
- [ ] launch
- [ ] local process integration

---

## PACK-003 — Linux build
- [ ] build
- [ ] install
- [ ] launch
- [ ] editor integration

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
