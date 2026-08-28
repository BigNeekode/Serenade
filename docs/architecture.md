# Serenade — Architecture Document

## 1. Purpose

This document defines the proposed software architecture for a local-first GUI built on top of `hand`.

The central architectural constraint is:

> The GUI is an adapter and observability layer. `hand` remains the orchestration source of truth.

---

## 2. System Context

```text
                     ┌─────────────────────────────┐
                     │        Serenade             │
                     │    Tauri Desktop App        │
                     └──────────────┬──────────────┘
                                    │
                     typed Tauri commands/events
                                    │
                     ┌──────────────▼──────────────┐
                     │        Rust Backend         │
                     │                             │
                     │  Hand Adapter               │
                     │  Git Adapter                │
                     │  Config Service             │
                     │  Filesystem Service         │
                     └───────┬─────────┬───────────┘
                             │         │
                       process exec    │ file/db reads
                             │         │
                    ┌────────▼───┐ ┌───▼────────────────┐
                    │ hand CLI   │ │ hand fleet/state   │
                    └────────────┘ │ repos/worktrees     │
                                   └────────────────────┘
```

---

## 3. Architectural Goals

- Keep frontend independent of CLI syntax.
- Keep CLI-specific parsing isolated.
- Avoid arbitrary shell execution.
- Prefer structured data over human-readable terminal output.
- Support a mock backend for UI development.
- Make error states typed and actionable.
- Make `hand` version differences containable.
- Keep the GUI functional if optional features are unavailable.

---

## 4. Frontend Architecture

Recommended structure:

```text
src/
├─ app/
│  ├─ App.tsx
│  ├─ router.tsx
│  ├─ query-client.ts
│  └─ providers.tsx
├─ components/
│  ├─ ui/
│  ├─ layout/
│  └─ common/
├─ features/
│  ├─ overview/
│  ├─ projects/
│  ├─ tasks/
│  ├─ agents/
│  ├─ worktrees/
│  ├─ reports/
│  ├─ routes/
│  └─ settings/
├─ hooks/
├─ lib/
│  ├─ api/
│  ├─ format/
│  └─ validation/
├─ types/
└─ main.tsx
```

---

## 5. Frontend Data Layer

Create a single frontend interface:

```ts
export interface SerenadeApi {
  getConfig(): Promise<AppConfig>;
  updateConfig(input: UpdateConfigInput): Promise<AppConfig>;

  listProjects(): Promise<Project[]>;
  getProject(projectId: string): Promise<Project>;

  listTasks(projectId?: string): Promise<Task[]>;
  getTask(taskId: string): Promise<Task>;

  listAgents(): Promise<AgentRun[]>;
  listWorktrees(projectId?: string): Promise<Worktree[]>;
  listReports(projectId?: string): Promise<Report[]>;

  createTask(input: CreateTaskInput): Promise<Task>;
  sendTaskMessage(taskId: string, message: string): Promise<void>;
  retryTask(taskId: string): Promise<void>;
  stopTask(taskId: string): Promise<void>;
}
```

Implementations:
- `MockSerenadeApi`
- `TauriSerenadeApi`

This allows UI work before backend integration is complete.

---

## 6. State Management

### Server/domain state
Use **TanStack Query**.

Examples:
- projects
- tasks
- agents
- worktrees
- reports
- routes
- config

### UI state
Keep local where possible.

Use Zustand only for app-wide UI state such as:
- selected project
- sidebar collapse
- panel width
- global filters
- command palette state

Do not mirror server state into Zustand.

---

## 7. Tauri Command Layer

Suggested commands:

```text
config_get
config_update
environment_validate

projects_list
project_get

tasks_list
task_get
task_create
task_update
task_retry
task_stop
task_send_message
task_promote

agents_list

worktrees_list
worktree_open_editor
worktree_open_folder
worktree_open_terminal
worktree_cleanup

reports_list
report_get

routes_list
routes_update

events_recent
task_logs_read
```

All commands should return serializable typed objects.

---

## 8. Backend Module Layout

```text
src-tauri/src/
├─ main.rs
├─ commands/
│  ├─ mod.rs
│  ├─ config.rs
│  ├─ projects.rs
│  ├─ tasks.rs
│  ├─ agents.rs
│  ├─ worktrees.rs
│  ├─ reports.rs
│  ├─ routes.rs
│  └─ diagnostics.rs
├─ domain/
│  ├─ project.rs
│  ├─ task.rs
│  ├─ agent.rs
│  ├─ worktree.rs
│  ├─ report.rs
│  └─ error.rs
├─ hand/
│  ├─ mod.rs
│  ├─ adapter.rs
│  ├─ commands.rs
│  ├─ parser.rs
│  ├─ repository.rs
│  └─ version.rs
├─ git/
│  ├─ mod.rs
│  ├─ status.rs
│  └─ repository.rs
├─ config/
│  ├─ mod.rs
│  └─ store.rs
├─ filesystem/
│  ├─ mod.rs
│  └─ paths.rs
└─ diagnostics/
```

---

## 9. Hand Adapter

The `hand` adapter is the most important backend abstraction.

```rust
pub trait HandAdapter {
    fn list_projects(&self) -> Result<Vec<Project>, SerenadeError>;
    fn list_tasks(&self, project_id: Option<&str>) -> Result<Vec<Task>, SerenadeError>;
    fn get_task(&self, task_id: &str) -> Result<Task, SerenadeError>;
    fn create_task(&self, input: CreateTaskInput) -> Result<Task, SerenadeError>;
    fn send_message(&self, task_id: &str, message: &str) -> Result<(), SerenadeError>;
    fn stop_task(&self, task_id: &str) -> Result<(), SerenadeError>;
}
```

The concrete implementation may combine:
- structured CLI output
- state database reads
- fleet file reads

The GUI should not assume one specific storage mechanism unless verified.

---

## 10. Version Compatibility

Create a version capability model:

```rust
struct HandCapabilities {
    supports_structured_task_output: bool,
    supports_pause: bool,
    supports_route_write: bool,
    supports_task_message: bool,
    supports_report_listing: bool,
}
```

At app start:
1. detect `hand`
2. query version
3. derive capabilities
4. disable unsupported UI actions

Avoid pretending unsupported actions exist.

---

## 11. Process Execution Safety

Never expose:

```text
invoke("run_shell", user_input)
```

Instead use fixed backend actions.

Bad:
```rust
run(format!("hand {}", user_input))
```

Preferred:
```rust
Command::new(hand_path)
    .arg("task")
    .arg("retry")
    .arg(validated_task_id)
```

Validate:
- IDs
- paths
- expected arguments
- executable paths

---

## 12. Path Safety

All filesystem paths must be normalized and validated.

For project/worktree operations:
- canonicalize when possible
- verify path exists
- verify path is within known project/fleet roots where appropriate
- do not silently follow dangerous paths for destructive operations

---

## 13. Git Adapter

The Git adapter should initially be read-focused.

Functions:
- current branch
- dirty state
- changed files
- staged files
- ahead/behind
- last commit
- repository root

Use Git commands with explicit arguments or a Rust Git library.

Avoid implementing merge/reset/rebase in MVP.

---

## 14. Polling Model

### Query intervals

```text
Overview        15s
Project board    5s
Task detail      3s
Agents           5s
Worktrees       10s
Reports          30s
Routes           manual / 60s
```

When window is unfocused:
- increase intervals
- keep agent/task failure checking active at a reduced cadence

---

## 15. Future Event Model

Later, replace some polling with events:

```text
task.created
task.updated
task.completed
task.failed
agent.started
agent.heartbeat
agent.completed
agent.failed
worktree.created
worktree.dirty
worktree.cleaned
report.created
```

The backend can emit Tauri events.

Frontend invalidates relevant TanStack Query caches.

---

## 16. Logging Architecture

Do not load entire huge log files repeatedly.

Use an incremental structure:

```ts
type LogChunkRequest = {
  taskId: string;
  cursor?: string;
  limit?: number;
};

type LogChunkResponse = {
  lines: LogLine[];
  nextCursor?: string;
};
```

This makes later streaming easier.

---

## 17. Error Architecture

Backend:

```rust
enum SerenadeErrorCode {
    HandNotFound,
    InvalidFleet,
    ProjectNotFound,
    TaskNotFound,
    WorktreeNotFound,
    CommandFailed,
    ParseFailed,
    PermissionDenied,
    UnsupportedCapability,
    GitFailed,
    InvalidPath,
}
```

Serialized error:

```json
{
  "code": "HAND_NOT_FOUND",
  "title": "Hand executable not found",
  "message": "Configure the hand binary path in Settings.",
  "recoverable": true
}
```

---

## 18. Diagnostics

Diagnostics page should expose:
- app version
- Tauri version
- detected `hand` path
- `hand` version
- fleet path
- fleet validity
- provider capability summary
- recent backend errors

Allow copying diagnostics.

Never include secrets.

---

## 19. Configuration Storage

GUI-owned config should be separate from `hand` config where possible.

Example:

```json
{
  "handBinaryPath": null,
  "fleetPath": null,
  "preferredEditor": "vscode",
  "refreshProfile": "default",
  "appearance": "dark"
}
```

Do not rewrite `hand` configuration unnecessarily.

---

## 20. First-Run Flow

```text
Launch
  ↓
Detect hand
  ├─ found
  │    ↓
  │  detect fleet
  │    ├─ valid → Overview
  │    └─ missing → Select Fleet
  │
  └─ not found
       ↓
     Setup Screen
```

Setup screen:
- detected path
- choose binary
- choose fleet
- validate
- open docs link

---

## 21. Security Boundary

The application is local-first.

MVP should not:
- bind a public HTTP port
- expose remote APIs
- auto-upload logs
- send telemetry containing code/task content

If telemetry is ever added, it must be opt-in and content-safe.

---

## 22. Testing Architecture

### Frontend
Mock `SerenadeApi`.

### Backend
Use fixture output for:
- CLI parsers
- state file parsers
- Git parser

### Integration
Create a fake `hand` executable for deterministic tests.

Example fake behavior:
- returns known version
- returns test project list
- returns test task states
- simulates failure

This avoids requiring live providers for most test coverage.

---

## 23. Dependency Rules

### `components/ui`
May not import feature modules.

### `features/*`
May import:
- UI components
- types
- API hooks

### `lib/api`
May not import feature UI.

### Rust command modules
May depend on adapters/services, not the other way around.

---

## 24. Recommended ADRs

Create architecture decision records for:

- ADR-001: Tauri instead of Electron
- ADR-002: `hand` remains source of truth
- ADR-003: polling before event streaming
- ADR-004: no arbitrary shell execution
- ADR-005: mockable frontend API layer
- ADR-006: read-only Git adapter for MVP
