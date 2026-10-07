# Serenade — Architecture Document

> **Modern target:** Secondhand / `hand` 0.9+  
> **Migration model:** dual adapter — verified Hand 0.6 legacy support plus a new modern Hand gateway.

## 1. Purpose

Serenade is a local-first Tauri desktop client above Secondhand.

The architectural boundary is:

> **Hand owns canonical orchestration and interaction state. Serenade owns presentation, typed operator interaction and local desktop convenience.**

Modern Hand now includes a managed Supervisor, Decisions, Reports, Plans, Attempts, native worktrees, Luvus runtime management and event wakes. Serenade must consume those public contracts rather than duplicating them.

## 2. System context

```text
┌────────────────────────────── Serenade ──────────────────────────────┐
│                                                                      │
│ React presentation                                                   │
│   ├─ Overview / Needs                                                │
│   ├─ Supervisor                                                      │
│   ├─ Tasks / Plans / Attempts                                       │
│   ├─ Reports / Decisions                                             │
│   ├─ Profiles                                                        │
│   └─ local review/navigation                                        │
│               │                                                      │
│               ▼                                                      │
│         SerenadeApi                                                  │
│               │                                                      │
│         InteractionGateway                                           │
│               │                                                      │
│               ▼                                                      │
│         Tauri commands/events                                        │
│               │                                                      │
│   ┌───────────┴───────────────────────────────────┐                  │
│   │ Rust backend                                  │                  │
│   │                                               │                  │
│   │ HandGateway                                   │                  │
│   │  ├─ HandLegacyGateway  → Hand 0.6            │                  │
│   │  └─ HandModernGateway  → Hand 0.9+           │                  │
│   │                                               │                  │
│   │ HandTransport                                 │                  │
│   │  ├─ Native                                    │                  │
│   │  └─ WSL2                                      │                  │
│   │                                               │                  │
│   │ Modern event bridge                           │                  │
│   │ Git/local convenience adapters                │                  │
│   │ Config/environment service                    │                  │
│   └────────────────┬──────────────────────────────┘                  │
└────────────────────┼─────────────────────────────────────────────────┘
                     │ fixed argv / public TOON
                     ▼
              Secondhand / hand
         ┌───────────┼───────────────┐
         │           │               │
     hand.db     Supervisor       worktrees
     (private)   + Decisions      + Luvus
                 + Reports
```

Serenade does **not** read `hand.db` on the modern path.

## 3. Sources of truth

### Hand-owned canonical state

- Fleet identity/state;
- Projects;
- Tasks;
- Plans;
- Attempts;
- Reports and acknowledgement;
- Decisions and answers;
- Supervisor launches and queued inputs;
- routing profiles;
- worktree lifecycle;
- event sequence/cursor;
- runtime process state as projected by Hand.

### Serenade-owned state

Only UX/application state:

- selected fleet/project/task;
- layout/density;
- panel sizes;
- theme;
- window state;
- editor preferences;
- cached query data;
- local search state;
- feature flags;
- optional non-authoritative analytics cache.

Restarting or deleting Serenade-owned state must not lose Hand workflow truth.

## 4. Adapter architecture

Define one semantic boundary with adapter-specific implementations.

```text
HandGateway
  ├─ Legacy06Adapter
  │    legacy CLI/files only
  │
  └─ Modern09Adapter
       public Hand CLI/TOON only
```

Do not share commands merely because their names look similar. The Hand 0.8 redesign changed semantics substantially.

### Adapter selection

Selection uses parsed Hand build metadata and explicit qualification rules.

Inputs may include:

- version;
- channel;
- commit;
- state schema;
- tested Luvus.

Unknown/newer contracts default to read diagnostics with mutations blocked.

## 5. Backend module direction

Recommended structure:

```text
src-tauri/src/
├─ hand/
│  ├─ mod.rs
│  ├─ compatibility.rs
│  ├─ process.rs
│  ├─ transport.rs
│  ├─ legacy/
│  │  ├─ gateway.rs
│  │  ├─ model.rs
│  │  └─ toon.rs
│  └─ modern/
│     ├─ gateway.rs
│     ├─ model.rs
│     ├─ toon.rs
│     ├─ commands.rs
│     └─ events.rs
├─ adapter.rs
├─ environment.rs
├─ git.rs
├─ local.rs
├─ config.rs
├─ domain.rs
└─ error.rs
```

The exact migration may happen incrementally; this is the intended ownership boundary.

## 6. Hand process boundary

All Hand calls use:

- executable + explicit argv array;
- explicit cwd/home;
- bounded output;
- timeout/cancellation;
- captured stdout/stderr;
- typed exit/error mapping.

Never build a shell command string from frontend input.

### Modern transport

Introduce:

```rust
trait HandTransport {
    fn run(
        &self,
        executable: &Path,
        args: &[String],
        cwd: Option<&Path>,
        env: &[(String, String)],
        timeout: Duration,
    ) -> Result<ProcessOutput, SerenadeError>;
}
```

Implementations may include:

- native process execution;
- WSL2 bridge for Windows when using Linux Hand.

Transport does not change Hand semantics.

## 7. Public data contract

Modern Hand command output is TOON.

Serenade should parse TOON in Rust and return typed Tauri payloads.

The frontend must not parse raw Hand text during normal operation.

### Parser rules

- fixture-driven;
- tolerate additive unknown fields;
- fail clearly when required identity/state fields are absent;
- preserve exact refs;
- never infer missing records from unrelated output;
- keep parser code versioned with the modern adapter if formats diverge later.

## 8. Modern gateway responsibilities

`HandModernGateway` owns semantic Hand operations.

### Reads

- build/version;
- orient/fleet snapshot;
- projects;
- tasks;
- task detail;
- Plan history;
- Attempts;
- Attempt detail;
- Reports;
- Decisions;
- Profiles;
- Supervisor;
- events/wait cursor;
- blocked screens.

### Mutations

Only qualified public actions:

- create/start/complete/abandon Task where supported;
- set Plan;
- start/send/stop/clean Attempt;
- acknowledge Report;
- answer Decision;
- start/resume/stop/send/switch Supervisor;
- revision-guarded blocked-screen keys.

Legacy merge/deliver/teardown/promote operations do not exist in the modern adapter.

## 9. Frontend data layer

Keep the single `SerenadeApi` boundary.

The frontend should consume domain objects, not Hand CLI syntax.

Example modern API:

```ts
interface SerenadeApi {
  getEnvironment(): Promise<EnvironmentStatus>;
  getFleetOverview(): Promise<FleetOverview>;

  listProjects(): Promise<Project[]>;
  listTasks(projectId?: string): Promise<Task[]>;
  getTask(taskId: string): Promise<TaskDetail>;

  listAttempts(taskId?: string): Promise<Attempt[]>;
  getAttempt(attemptId: string): Promise<AttemptDetail>;

  listReports(filter?: ReportFilter): Promise<Report[]>;
  ackReport(reportId: string): Promise<void>;

  listDecisions(filter?: DecisionFilter): Promise<Decision[]>;
  answerDecision(decisionId: string, answer: string): Promise<void>;

  getSupervisor(): Promise<SupervisorState>;
  sendSupervisor(input: SupervisorInput): Promise<void>;

  listProfiles(): Promise<RoutingProfile[]>;
}
```

Exact methods may remain split into feature APIs, but the semantic boundary should remain typed.

## 10. InteractionGateway

The old distinction between "reasoning" and "exact action" still matters, but modern Hand changes where reasoning goes.

### Reasoning-required intent

```text
Operator prose
  ↓
Serenade Supervisor UI
  ↓
hand supervisor send
  ↓
Hand-managed Supervisor
```

### Exact operator action

```text
button / form
  ↓
typed Serenade mutation
  ↓
HandModernGateway
  ↓
exact Hand command + ref
```

Serenade no longer runs its own Supervisor provider for modern Hand.

## 11. Supervisor architecture

### Modern

Hand owns:

- harness process;
- session/conversation;
- model/effort;
- start/resume/stop;
- wakes;
- event orientation;
- blocked screen;
- switching.

Serenade owns:

- rendering;
- message composer;
- attachment selection;
- safe controls;
- context navigation.

### Legacy

Any Serenade-owned OpenCode Supervisor required for 0.6 must be isolated as legacy compatibility code.

It must not be reused by the modern adapter.

## 12. Needs architecture

Serenade's previous Attention layer was a compatibility projection.

Modern Overview should represent facts from Hand:

- blocked Supervisor/Attempts;
- quiet/failed/exited/interrupted Attempts;
- limits;
- missing Supervisor when work waits;
- open Decisions;
- unread Reports.

If Serenade composes multiple public Hand reads into one `Need[]`, the ordering/projection logic is presentation logic only. The underlying state remains Hand-owned.

## 13. Event-driven refresh

Modern Hand has event sequence/cursor semantics.

Preferred backend loop:

```text
fresh projection
   ↓
remember cursor
   ↓
wait after cursor
   ↓
parse event(s)
   ↓
emit Tauri event
   ↓
invalidate relevant TanStack queries
   ↓
refetch canonical projection
```

### Recovery

If the wait process dies or cursor continuity is uncertain:

1. mark live state as reconnecting/stale;
2. obtain a new canonical projection/orientation;
3. replace cursor;
4. resume waiting.

The event stream is an invalidation mechanism, not the sole state store.

## 14. State management

### Canonical/server state

TanStack Query.

### UI state

Small local store for:

- selection;
- open panel;
- filters;
- density;
- command palette;
- temporary draft input.

Never store authoritative Task/Decision/Report lifecycle in local UI state.

## 15. Local Git adapter

Serenade may use Git directly for operator convenience:

- status;
- diff;
- commits;
- branch info;
- open repository/worktree.

It must not use Git operations to impersonate Hand lifecycle changes.

For example:

- showing a diff: okay;
- opening a worktree: okay;
- deleting a modern Hand worktree directly: not okay;
- silently merging because old Serenade had a merge action: not okay.

## 16. Setup architecture

Environment inspection should detect capabilities, not just executable existence.

Modern scan:

```text
Hand
  version/channel/commit/schema

Fleet
  initialized/healthy

Luvus
  reported through Hand / pin status

Harnesses
  availability

Profiles
  validity

Watcher
  state
```

Modern setup delegates runtime ownership to Hand.

Do not install Treehouse/Herdr for modern Hand.

## 17. Update architecture

Serenade does not implement a second modern Hand updater.

Flow:

```text
hand update --check
      ↓
Serenade renders plan
      ↓
operator confirms
      ↓
hand update
      ↓
environment rescan
```

Stable/edge switching must be explicit.

## 18. Blocked-screen safety

Blocked screen actions carry exact currentness information.

Tauri command input should include:

- target type;
- target ref when applicable;
- revision;
- digest when Hand requires/supports it;
- allowed keys.

If Hand rejects stale input, return a distinct conflict error. The frontend must refresh and require a new explicit action.

## 19. Error model

Map Hand failures into typed application errors:

- invalid input/ref;
- not found;
- conflict/stale;
- unsupported capability;
- runtime unavailable;
- harness unavailable;
- permission;
- timeout;
- process failure;
- parse/contract mismatch;
- transport/path failure.

Every error exposed to UI should include:

- concise title;
- actionable message;
- exact affected ref when known;
- recoverability;
- suggested next action.

## 20. Platform architecture

Contract support and transport support are separate axes.

### Native

Linux/macOS invoke Hand directly.

### Windows + WSL2

A WSL transport handles:

- `wsl.exe` invocation;
- path conversion;
- fleet cwd;
- repository/worktree path conversion;
- environment;
- output/cancellation.

Local editor actions may need WSL → Windows path translation.

### Native Windows

Treat current upstream native Windows edge behavior as experimental until a stable Hand release is explicitly qualified.

## 21. Security boundaries

Frontend may call only named Tauri commands.

No generic:

- shell exec;
- arbitrary path deletion;
- arbitrary HTTP fetch;
- arbitrary DB query;
- arbitrary Luvus call.

Download/update operations must be constrained to qualified Hand mechanisms and explicit user actions.

## 22. Testing architecture

### Unit

- version/capability parsing;
- TOON parsing;
- adapter mapping;
- ref validation;
- Need projection;
- error mapping;
- transport path conversion.

### Contract fixture

Captured Hand 0.9 public outputs.

### Integration

A fake process runner verifies exact argv and exit mapping.

### Live E2E

A real modern Fleet verifies:

- Tasks;
- Plans;
- Attempts;
- Reports;
- Decisions;
- Supervisor;
- blocked screens;
- events;
- update check;
- restart/recovery.

## 23. Migration rule

Do not perform a flag-day rewrite.

Each frontend feature should be able to receive either:

- legacy projection from Hand 0.6; or
- modern projection from Hand 0.9+.

Where the concepts truly differ, render adapter-specific UX rather than fabricating equivalence.

The final architecture should make eventual Hand 0.6 retirement a contained removal of legacy modules.
