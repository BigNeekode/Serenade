# Serenade — Implementation Plan

## 1. Objective

Build a stable MVP desktop interface for `hand` that provides:

- fleet overview
- project/task management
- active worker monitoring
- worktree visibility
- report viewing
- essential task operations
- provider/route configuration

The GUI must treat `hand` as the orchestration source of truth.

---

## 2. Recommended Stack

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- TanStack Query
- React Router
- dnd-kit
- Zustand only if local UI state becomes complex

### Desktop
- Tauri

### Backend
- Rust through Tauri commands

### Testing
- Vitest
- React Testing Library
- Playwright for selected end-to-end flows
- Rust unit tests for parsers and command wrappers

---

## 3. Architectural Strategy

```text
React UI
    ↓
Feature hooks / query layer
    ↓
Typed frontend API wrapper
    ↓
Tauri commands
    ↓
Hand adapter layer
    ↓
hand CLI / fleet state / Git / filesystem
```

The frontend must not directly know CLI syntax.

The Tauri backend must not expose arbitrary shell execution.

---

## 4. Delivery Philosophy

Implement in this order:

1. UX shell
2. mock data
3. stable domain types
4. Tauri bridge
5. real `hand` integration
6. task actions
7. observability
8. hardening
9. packaging

This keeps UI development unblocked while integration behavior is investigated.

---

## 5. Milestone 0 — Repository Investigation

### Goal
Understand `hand` sufficiently before implementing the adapter.

### Tasks
- inspect `hand` commands
- inspect configuration format
- inspect project/task state
- inspect SQLite or other state storage if present
- inspect worktree lifecycle
- inspect structured output capabilities
- identify commands safe for GUI use
- identify commands requiring confirmation
- identify log/report paths
- document assumptions

### Deliverable
`docs/hand-integration-notes.md`

### Acceptance
No frontend integration code should depend on parsing unknown human-oriented CLI output without documentation.

---

## 6. Milestone 1 — Bootstrap

### Tasks
- create Tauri + React + TypeScript project
- configure Tailwind
- add shadcn/ui
- add React Router
- add TanStack Query
- configure ESLint
- configure Prettier
- configure Vitest
- establish app folder structure
- implement dark theme baseline

### Acceptance
`npm run tauri dev` launches a working desktop app.

---

## 7. Milestone 2 — App Shell

### Implement
- Sidebar
- Topbar
- Breadcrumbs
- ProjectSwitcher shell
- StatusBar
- CommandPalette shell
- reusable page container
- resizable detail panel

### Routes
- `/`
- `/projects`
- `/projects/:projectId`
- `/tasks`
- `/agents`
- `/worktrees`
- `/reports`
- `/routes`
- `/settings`

### Acceptance
All routes render inside a consistent shell.

---

## 8. Milestone 3 — Domain Types & Mock Repository

Create typed domain models for:
- Project
- Task
- AgentRun
- Worktree
- Report
- Route
- Provider
- Event
- AppConfig

Create an in-memory mock repository behind the same frontend API interface used by the real backend.

### Acceptance
No screen directly imports hard-coded mock arrays.

---

## 9. Milestone 4 — Design System

Implement reusable:
- Button
- IconButton
- Badge
- StatusBadge
- Card
- StatCard
- Tabs
- Dialog
- Sheet
- Dropdown
- Tooltip
- Toast
- DataTable
- EmptyState
- ErrorState
- Skeleton
- SearchInput
- Tag
- ProgressBar

### Acceptance
Feature screens should not duplicate visual primitives.

---

## 10. Milestone 5 — Fleet Overview

Implement:
- summary metrics
- project health list
- active agents summary
- recent activity
- recent failures
- provider usage panel

Use mock repository.

---

## 11. Milestone 6 — Project Dashboard

Implement:
- project header
- summary cards
- board/timeline tabs
- Kanban board
- task filtering
- task sorting
- context panel

Board columns:
- Backlog
- Scouting
- Ready to Ship
- In Progress
- Review
- Done
- Blocked

---

## 12. Milestone 7 — Task Detail

Implement:
- metadata
- description
- status
- worker association
- worktree association
- logs
- progress
- files
- commits
- report/result
- details

Actions are initially mocked.

---

## 13. Milestone 8 — Agents

Implement:
- active agents table
- historical agents
- status filters
- provider filters
- agent detail panel
- runtime formatting
- heartbeat warning

---

## 14. Milestone 9 — Worktrees

Implement:
- worktree table
- path
- branch
- task
- worker
- changed file count
- Git status
- actions menu
- cleanup confirmation

---

## 15. Milestone 10 — Reports

Implement:
- reports list
- report search
- report detail
- Markdown renderer
- links back to task
- create follow-up task action
- promote scout result action

---

## 16. Milestone 11 — Backend Bridge

Create Tauri command modules:

```text
src-tauri/src/
├─ commands/
│  ├─ config.rs
│  ├─ projects.rs
│  ├─ tasks.rs
│  ├─ agents.rs
│  ├─ worktrees.rs
│  ├─ reports.rs
│  └─ actions.rs
├─ hand/
│  ├─ mod.rs
│  ├─ process.rs
│  ├─ repository.rs
│  ├─ parser.rs
│  └─ errors.rs
├─ git/
├─ models/
└─ main.rs
```

---

## 17. Milestone 12 — Configuration

Implement:
- discover `hand`
- validate binary
- set fleet path
- validate fleet
- persist UI config
- select preferred editor

Frontend should provide a first-run setup state when no valid environment exists.

---

## 18. Milestone 13 — Read Integration

Implement typed reads:
- list projects
- get project
- list tasks
- get task
- list agents
- list worktrees
- list reports
- get report content
- list routes/providers
- recent events

### Acceptance
Core views function against a real local fleet.

---

## 19. Milestone 14 — Task Actions

Implement:
- create scout
- create ship
- edit task
- send instruction
- retry task
- stop task
- pause task if supported
- promote scout to ship
- create follow-up task

All mutation responses must return structured success/error values.

---

## 20. Milestone 15 — Local Tooling Actions

Implement:
- open worktree in editor
- open worktree in file manager
- open terminal at worktree
- copy worktree path
- open Git host branch if URL is known

Do not expose a generic shell command box.

---

## 21. Milestone 16 — Git Metadata

Implement a local Git helper to read:
- current branch
- changed files
- staged files
- ahead/behind
- last commit
- dirty state

Avoid implementing Git mutation unless required by `hand`.

---

## 22. Milestone 17 — Polling & Activity

Use TanStack Query refresh intervals.

Suggested:
- Overview: 15s
- Board: 5s
- Task detail: 3s
- Agents: 5s
- Worktrees: 10s

Add:
- last refresh timestamp
- manual refresh
- stale indicator
- paused refresh when window is unfocused where appropriate

---

## 23. Milestone 18 — Log Handling

Implement:
- incremental task logs
- auto-scroll toggle
- pause log stream
- copy selected text
- search logs
- log severity highlighting where reliable

Avoid trying to semantically interpret logs in MVP.

---

## 24. Milestone 19 — Routes & Providers

Implement:
- provider cards
- route table
- route rule editor
- validation
- enable/disable
- fallback route display

If writing route configuration is unsafe or undocumented, make the initial UI read-only.

---

## 25. Milestone 20 — Error Handling

Create a shared error model:

```ts
type AppError = {
  code: string;
  title: string;
  message: string;
  detail?: string;
  recoverable: boolean;
  suggestedAction?: string;
};
```

Rust adapter should map backend errors into equivalent structured output.

---

## 26. Milestone 21 — Safety

Require confirmation for:
- stopping a worker
- cleaning worktree
- deleting local state
- retry operations that discard a previous attempt
- any destructive Git operation

Display enough technical context for users to understand the impact.

---

## 27. Milestone 22 — Testing

### Frontend unit/integration
Test:
- task card rendering
- task panel
- filters
- first-run setup
- command error display
- destructive confirmation flows

### Rust
Test:
- output parsers
- configuration validation
- path validation
- Git status parser
- CLI error mapping

### E2E
Selected flows:
1. open app
2. configure fleet
3. open project
4. inspect task
5. create scout
6. send worker instruction
7. open worktree
8. inspect completed report

---

## 28. Milestone 23 — Packaging

Implement:
- application metadata
- icons
- Windows packaging
- Linux packaging
- optional macOS packaging
- version display
- diagnostics export

---

## 29. Definition of Done

MVP is complete when a user can:

- configure a local fleet
- browse projects
- view task board
- create `scout` and `ship` tasks
- inspect a task
- see active workers
- inspect worktrees
- view scout reports
- send a worker instruction
- stop/retry work
- open worktrees in an editor
- understand failures without opening a raw terminal for normal operations
