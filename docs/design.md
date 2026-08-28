# Serenade — Product & UX Design Document

## 1. Overview

**Project name:** Serenade  
**Tagline:** *A control interface for Secondhand.*  
**Purpose:** A graphical desktop interface for **Secondhand / `hand`** that makes multi-agent coding orchestration easier to understand, operate, and monitor.

`hand` is powerful, but its CLI-first workflow can become cognitively expensive when several projects, tasks, workers, worktrees, reports, and providers are active at the same time.

Serenade should make `hand` feel like a **control room for an AI software team** rather than a collection of commands and terminals.

---

## 2. Product Vision

Create a **local-first desktop control center** where a user can:

1. connect to a local `hand` fleet
2. browse projects and tasks visually
3. create and manage `scout` and `ship` work
4. monitor active workers in real time
5. inspect worktrees, branches, logs, and changes
6. review reports and completed work before merging
7. send additional instructions to running workers
8. retry, stop, or reassign failed work
9. configure providers and routing without memorizing CLI syntax
10. understand system health at a glance

The GUI should preserve `hand` as the source of truth. It should not fork or reimplement orchestration logic unnecessarily.

---

## 3. Target Users

### 3.1 Solo developer
A developer running several AI coding agents in parallel and wanting a better operational view.

### 3.2 Technical lead
A project owner coordinating multiple features, investigations, and implementation streams.

### 3.3 AI-agent power user
A user experimenting with different providers, models, routes, and task classes who wants observability into the system.

---

## 4. Core Goals

### Product goals
- Make multi-agent work visible at a glance.
- Reduce the need to keep many terminals open.
- Make common operations discoverable.
- Improve task and worker observability.
- Make worktree isolation easy to understand.
- Expose failure states clearly.
- Make investigation output reusable.

### UX goals
- High information density without visual clutter.
- Fast navigation between projects, tasks, agents, and worktrees.
- Real-time operational feedback.
- Keyboard-friendly workflows.
- Developer-tool aesthetics rather than generic enterprise SaaS styling.
- Safe defaults for destructive actions.

---

## 5. Non-Goals

The MVP is not intended to:

- replace `hand`
- replace GitHub/GitLab
- replace VS Code or another IDE
- become Jira/Linear
- provide full source-code editing
- support large multi-user organizations
- expose the local orchestration system over the public internet

---

## 6. Design Principles

### 6.1 Local-first
The GUI operates against a local `hand` fleet, local repositories, local worktrees, and local processes.

### 6.2 Operational clarity
Users should always be able to answer:

- What is running?
- What is waiting?
- What failed?
- Which worker owns this task?
- Which branch/worktree contains the result?
- What changed recently?

### 6.3 Safe by default
Destructive actions require explicit confirmation.

Examples:
- stop agent
- cleanup worktree
- discard task attempt
- reset branch
- delete local artifact

### 6.4 Progressive complexity
The default view should be understandable without hiding technical detail from advanced users.

### 6.5 Agent transparency
Workers must not be represented as opaque “magic”.

Useful details include:
- provider
- model
- task
- run duration
- last heartbeat
- logs
- branch
- changed files
- commits
- status history

---

## 7. Recommended Platform

### Desktop
Use **Tauri + React + TypeScript**.

Why:
- lightweight desktop packaging
- direct local filesystem access
- controlled process execution
- good fit for Git/worktree tooling
- simpler local-first deployment than a separate web server
- native-feeling application lifecycle

---

## 8. Information Architecture

### Global navigation
- Overview
- Projects
- Tasks
- Agents
- Worktrees
- Reports
- Routes
- Settings

### Project navigation
- Board
- Timeline
- All Tasks
- Active Agents
- Worktrees
- Reports
- Project Settings

---

## 9. Main Application Layout

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Topbar: breadcrumbs | project switcher | global search | new task | status  │
├───────────────┬──────────────────────────────────────────┬───────────────────┤
│ Sidebar       │ Primary workspace                        │ Context panel     │
│               │                                          │                   │
│ Overview      │ Kanban / table / dashboard / report      │ Task detail       │
│ Projects      │                                          │ Agent detail      │
│ Tasks         │                                          │ Worktree detail   │
│ Agents        │                                          │                   │
│ Worktrees     │                                          │                   │
│ Reports       │                                          │                   │
│ Routes        │                                          │                   │
│ Settings      │                                          │                   │
├───────────────┴──────────────────────────────────────────┴───────────────────┤
│ Status bar: supervisor | total agents | tokens | cost | completed | errors  │
└──────────────────────────────────────────────────────────────────────────────┘
```

The right-side context panel is important: users should inspect a task or worker without leaving the main board.

---

## 10. Fleet Overview

### Purpose
Provide a cross-project operational summary.

### Content
- active projects
- running tasks
- waiting tasks
- failed tasks
- active agents
- workers by provider
- recent task completions
- recent failures
- activity timeline
- provider/model usage summary
- system warnings

### Primary questions
- Is the fleet healthy?
- Does anything require attention?
- Are too many workers active?
- Which project has failures?
- Which provider is currently handling work?

---

## 11. Project Dashboard

The project dashboard is the main daily workspace.

### Header
- project name
- repository
- active/paused state
- current branch or default branch
- project settings
- quick actions

### Summary cards
- Total Tasks
- Ships
- Scouts
- Success Rate
- Active Agents
- Pending Review
- Failed Tasks

### Main views
- Board
- Timeline

---

## 12. Kanban Board

### Default columns
1. Backlog
2. Scouting
3. Ready to Ship
4. In Progress
5. Review
6. Done
7. Blocked

### Task card content
- task ID
- title
- `SCOUT` / `SHIP`
- `mechanical` / `standard` / `deep`
- current status
- assigned worker
- provider icon
- tags
- last update
- optional progress indicator

### Interactions
- click card → open context panel
- keyboard focus
- filter
- sort
- group
- optional drag-and-drop if status mutation is supported safely

---

## 13. Task Detail Panel

### Header
- task ID
- title
- type
- execution class
- status
- assigned worker
- created/updated timestamps

### Tabs
- Chat / Logs
- Progress
- Files
- Commits
- Report / Result
- Details

### Actions
- send instruction
- pause worker
- stop worker
- retry task
- reassign worker
- promote scout to ship
- create follow-up task
- open worktree
- open terminal
- open in editor
- open branch/PR on Git host

---

## 14. Agents View

### Table columns
- Worker
- Provider
- Model
- Task
- Status
- Runtime
- Started
- Last heartbeat
- Branch
- Progress
- Token usage
- Cost estimate

### Worker statuses
- Starting
- Running
- Waiting
- Blocked
- Completed
- Failed
- Stopped
- Unknown

### Agent detail
- session metadata
- current task
- current branch/worktree
- recent logs
- recent commands/events
- status timeline
- result summary

---

## 15. Worktrees View

Worktree isolation is one of the most important concepts to expose visually.

### Columns
- Project
- Task
- Worker
- Path
- Branch
- Git Status
- Changed Files
- Ahead / Behind
- Created
- State

### Actions
- Open Folder
- Open Terminal
- Open in VS Code
- Inspect Diff
- Copy Path
- Cleanup Worktree

### Safety
Cleanup must never happen silently.

Confirmation should display:
- worktree path
- branch
- uncommitted files
- last commit
- affected task

---

## 16. Reports View

### Purpose
Make `scout` work useful beyond the worker session.

### Content types
- scout report
- run summary
- failure summary
- postmortem
- learning
- operator note

### Features
- Markdown rendering
- search
- project filtering
- task links
- copy result
- create follow-up task
- promote report into implementation task

---

## 17. Routes & Providers

### Provider list
Display:
- provider name
- enabled/disabled
- connection state
- default model
- recent usage
- recent errors

### Route rule example

```text
scout + deep       → Claude Opus
ship + mechanical  → Codex Mini
ship + standard    → Codex
fallback           → Claude Sonnet
```

### Route editor
Each rule should support:
- task type
- execution class
- provider
- model/profile
- priority
- enabled state
- fallback

---

## 18. Settings

### Fleet
- fleet path
- `hand` binary path
- auto-discovery
- refresh interval

### Git
- preferred Git host
- default branch behavior
- cleanup preferences

### Editor
- VS Code
- Cursor
- Zed
- custom executable

### UI
- appearance
- density
- sidebar state
- panel size
- reduced motion

### Notifications
- worker failed
- task completed
- report ready
- approval required

### Advanced
- debug logs
- local database inspection
- raw command output
- diagnostics export

---

## 19. Command Palette

Suggested commands:

```text
New Task
Open Project
Open Task
Open Worktree
Open Active Agent
Retry Task
Stop Task
Create Scout
Create Ship
Show Failed Tasks
Show Active Agents
Refresh Fleet
Open Settings
```

Keyboard-first interaction should be considered a first-class UX path.

---

## 20. Search

Global search should include:
- projects
- tasks
- task IDs
- reports
- workers
- branch names
- worktree paths

Later:
- semantic report search
- log search
- commit search

---

## 21. Visual Design Direction

### Theme
Dark mode first.

### Aesthetic
Blend characteristics of:
- Linear
- GitHub Projects
- Vercel
- Raycast
- GitKraken
- observability dashboards

### Visual language
- charcoal/near-black background
- subtle borders
- restrained gradients
- violet/blue primary accent
- green for healthy/running
- amber for waiting/warnings
- red for failures
- rounded cards
- compact tables
- clear monospace usage for technical identifiers

### Avoid
- oversized cards
- excessive glassmorphism
- generic admin-template look
- bright saturated colors everywhere
- hiding important system state behind menus

---

## 22. Component Inventory

### Layout
- AppShell
- Sidebar
- Topbar
- StatusBar
- ResizablePanel
- ContextDrawer

### Navigation
- ProjectSwitcher
- Breadcrumbs
- CommandPalette
- GlobalSearch

### Dashboard
- SummaryStatCard
- ActivityFeed
- HealthIndicator
- ProviderUsageCard

### Tasks
- KanbanBoard
- KanbanColumn
- TaskCard
- TaskList
- TaskDetailPanel
- TaskCreateDialog
- TaskActionMenu

### Agents
- AgentTable
- AgentRow
- AgentStatusBadge
- AgentDetailPanel

### Worktrees
- WorktreeTable
- GitStatusBadge
- DiffSummary

### Reports
- ReportList
- ReportViewer
- MarkdownRenderer

### Generic
- Badge
- Button
- Tabs
- Dialog
- Sheet
- Dropdown
- Tooltip
- Toast
- Skeleton
- EmptyState
- ErrorState

---

## 23. Domain Model

### Project

```ts
type Project = {
  id: string;
  name: string;
  repoPath?: string;
  repoUrl?: string;
  status: "active" | "paused" | "unknown";
  createdAt?: string;
  updatedAt?: string;
};
```

### Task

```ts
type Task = {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  type: "scout" | "ship";
  executionClass: "mechanical" | "standard" | "deep";
  status: TaskStatus;
  tags: string[];
  assignedAgentId?: string;
  worktreeId?: string;
  reportId?: string;
  createdAt?: string;
  updatedAt?: string;
};
```

### AgentRun

```ts
type AgentRun = {
  id: string;
  taskId?: string;
  provider: string;
  model?: string;
  status: AgentStatus;
  startedAt?: string;
  endedAt?: string;
  heartbeatAt?: string;
  tokenUsage?: number;
  costEstimate?: number;
  logPath?: string;
};
```

### Worktree

```ts
type Worktree = {
  id: string;
  projectId: string;
  taskId?: string;
  path: string;
  branch: string;
  gitStatus?: string;
  changedFiles?: number;
  createdAt?: string;
};
```

### Report

```ts
type Report = {
  id: string;
  taskId: string;
  kind: string;
  path?: string;
  summary?: string;
  createdAt?: string;
};
```

---

## 24. Real-Time UX

For MVP:
- use polling for most data
- use faster polling for active task detail
- support manual refresh
- show “last updated”
- never make stale state look authoritative

Suggested defaults:
- Overview: 15 seconds
- Project board: 5 seconds
- Active task: 2–3 seconds
- Agents: 5 seconds
- Worktrees: 10 seconds

Future:
- event streaming
- filesystem watchers
- incremental log streaming

---

## 25. Failure UX

Failures should be concrete.

Bad:
> Something went wrong.

Good:
> `hand` could not start worker `agent-codex-3`. The configured Codex executable was not found.

Good:
> Worktree exists but its branch no longer exists.

Good:
> `hand` returned an unsupported output format. Open Diagnostics to inspect the raw response.

Every error should provide:
- what failed
- likely reason
- affected task/worker
- next useful action

---

## 26. MVP Scope

### Included
- fleet overview
- project list
- project dashboard
- board
- task detail
- active agents
- worktrees
- reports
- settings
- provider/route viewer
- create task
- send instruction
- retry/stop task
- open worktree in editor

### Deferred
- multi-user auth
- cloud sync
- mobile
- embedded full terminal
- embedded IDE
- PR review workflow
- advanced analytics
- complex cost optimization

---

## 27. Success Criteria

The MVP is successful when a user can manage ordinary `hand` operations without keeping several terminals open and can quickly answer:

- What are my agents doing?
- Which tasks are blocked?
- What changed?
- Where is the worktree?
- What did the scout discover?
- Which task needs my attention?
