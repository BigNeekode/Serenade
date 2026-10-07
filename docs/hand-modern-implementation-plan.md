# Serenade — Modern Hand 0.9+ Implementation Plan

> **Audience:** Codex / repository contributors  
> **Target branch family:** modern Hand integration  
> **Required reading:** `docs/design.md`, `docs/hand-modern-roadmap.md`, current Hand 0.9+ public README/spec/vocabulary  
> **Safety rule:** do not read/write `hand.db` directly and do not control Luvus directly.

## 1. Goal

Implement a modern Hand adapter without destabilizing the verified Hand 0.6 path.

The target end state is:

```text
React
  ↓
SerenadeApi
  ↓
InteractionGateway
  ↓
HandGateway
  ├─ HandLegacyGateway   → Hand 0.6.x
  └─ HandModernGateway   → Hand 0.9+
           ↓
       public hand CLI
           ↓
 canonical Hand workflow + interaction layer
```

The migration should be incremental. The application must compile and tests must remain green after each phase.

## 2. Non-negotiable constraints

1. Do not query or mutate Hand SQLite directly.
2. Do not scrape `hand board` HTML.
3. Do not import or depend on Hand's internal Go packages.
4. Do not invoke arbitrary shell strings.
5. Do not port legacy commands whose semantics disappeared.
6. Do not remove Hand 0.6 support until the modern path passes live qualification.
7. Do not infer Task lifecycle from Report/provider state.
8. Do not acknowledge Reports or answer Decisions during reads.
9. Do not automatically retarget stale refs/revisions.
10. Do not make edge builds mutation-safe by default.

## 3. Phase 0 — Contract capture

### Purpose

Freeze observed Hand 0.9 public behavior before changing adapters.

### Work

Create a fixture area, for example:

```text
src-tauri/tests/fixtures/hand-modern/
  version/
  orient/
  task/
  plan/
  attempt/
  report/
  decision/
  route/
  supervisor/
  events/
  errors/
```

Capture sanitized outputs from real Hand 0.9 stable for:

- `hand version`;
- `hand orient`;
- project list/show operations;
- Task list/show/add/start/done operations;
- Plan set/show/history operations;
- Attempt list/show/start/send/stop/clean operations;
- Report list/show/ack;
- Decision list/show/answer;
- `hand route list`;
- Supervisor show/start/resume/stop/send/switch;
- blocked worker screen;
- blocked Supervisor screen;
- event cursor/wait;
- common error/conflict/stale cases.

Capture exit codes and stderr separately.

### Tests

Add fixture loading helpers and a smoke test proving fixture files are valid UTF-8 and non-empty.

### Stop condition

Do not begin mutation implementation until the public command shapes used by the adapter exist as fixtures.

---

## 4. Phase 1 — Compatibility model

### Files likely affected

```text
src/lib/hand/compatibility.ts
src/lib/hand/gateway.ts
src/types/domain.ts
src-tauri/src/hand/compatibility.rs
src-tauri/src/hand/process.rs
src-tauri/src/hand/gateway.rs
src-tauri/src/environment.rs
```

### Work

Replace the single `v0.8-unadapted` family with explicit compatibility metadata.

Suggested frontend shape:

```ts
type HandAdapterKind =
  | "legacy-0.6"
  | "modern-0.9"
  | "modern-edge"
  | "unsupported";

interface HandBuildInfo {
  version?: string;
  channel?: "stable" | "edge" | "source" | string;
  commit?: string;
  schema?: number;
  luvus?: string;
}

interface HandCapabilities {
  modernWorkflow: boolean;
  managedSupervisor: boolean;
  decisions: boolean;
  reports: boolean;
  plans: boolean;
  attempts: boolean;
  screenRevision: boolean;
  eventCursor: boolean;
  updater: boolean;
}
```

Backend should parse `hand version` from public output.

Keep legacy `--version` fallback only where required for 0.6.

### Rules

- 0.6.x → legacy adapter.
- 0.7.x → unsupported.
- 0.8.x → diagnostics/experimental only unless explicitly qualified.
- 0.9.x stable → modern target.
- edge → separate capability-gated class.
- unknown/new major → mutations blocked.

### Tests

- version parser fixtures;
- stable vs edge classification;
- unknown fields tolerated;
- malformed output fails closed;
- 0.6 regression preserved.

### Exit criterion

The frontend and Rust backend agree on adapter family and mutation permission.

---

## 5. Phase 2 — Modern TOON parser and models

### Files

Prefer new modules rather than overloading legacy structures:

```text
src-tauri/src/hand/modern/
  mod.rs
  model.rs
  toon.rs
  gateway.rs
  commands.rs
```

Keep:

```text
src-tauri/src/hand/model.rs
src-tauri/src/hand/toon.rs
src-tauri/src/hand/gateway.rs
```

for legacy behavior until later cleanup.

### Work

Implement a small TOON parser sufficient for public Hand output:

- scalar `key: value`;
- tables such as `name[N]{field,...}:`;
- nested/multiline blocks only when fixtures prove required;
- help hints may be parsed or ignored safely;
- unknown fields retained/ignored without failure where possible.

Do not create a general-purpose shell-text parser from assumptions. Add parsing support only from captured fixtures.

Define modern backend models for:

- build/version;
- orient/fleet summary;
- project;
- task;
- plan;
- attempt;
- report;
- decision;
- routing profile;
- supervisor;
- blocked screen;
- event.

### Tests

Every model parser test uses captured fixture output.

### Exit criterion

All captured read-only fixtures parse into typed Rust models.

---

## 6. Phase 3 — `HandModernGateway` read path

### Files

```text
src-tauri/src/hand/modern/gateway.rs
src-tauri/src/hand/mod.rs
src-tauri/src/lib.rs
src-tauri/src/domain.rs
src/lib/api/tauri.ts
src/types/domain.ts
```

### Work

Add semantic methods such as:

```rust
trait ModernHandGateway {
    fn build_info(&self) -> Result<HandBuildInfo, SerenadeError>;
    fn orient(&self) -> Result<ModernOrient, SerenadeError>;
    fn projects(&self) -> Result<Vec<ModernProject>, SerenadeError>;
    fn tasks(&self, filter: TaskFilter) -> Result<Vec<ModernTask>, SerenadeError>;
    fn task(&self, task: TaskRef) -> Result<ModernTaskDetail, SerenadeError>;
    fn attempts(&self, task: Option<TaskRef>) -> Result<Vec<ModernAttempt>, SerenadeError>;
    fn reports(&self, filter: ReportFilter) -> Result<Vec<ModernReport>, SerenadeError>;
    fn decisions(&self, filter: DecisionFilter) -> Result<Vec<ModernDecision>, SerenadeError>;
    fn profiles(&self) -> Result<Vec<ModernProfile>, SerenadeError>;
    fn supervisor(&self) -> Result<ModernSupervisor, SerenadeError>;
}
```

Exact names may differ; preserve semantics.

Use fixed argv invocation in `HandRunner`.

### Important

Do not expose raw CLI output to React as the normal domain contract.

### Exit criterion

A read-only modern fleet can populate Serenade without using legacy fleet files/status files.

---

## 7. Phase 4 — Frontend domain split

### Files

```text
src/types/domain.ts
src/lib/api/index.ts
src/lib/api/tauri.ts
src/lib/api/mock.ts
src/hooks/
src/features/
```

### Work

Introduce canonical modern entities:

- Task;
- Plan;
- Attempt;
- Report;
- Decision;
- Supervisor;
- RoutingProfile;
- Need.

Do not force modern data into legacy fields.

A temporary strategy is acceptable:

```ts
type TaskProjection =
  | LegacyTaskProjection
  | ModernTaskProjection;
```

or an adapter-normalized common UI shape, provided modern semantics are not lost.

### Remove from modern projection

- scout/ship;
- execution class;
- legacy delivery state;
- Herdr refs;
- Treehouse identity;
- promote-scout action.

### Exit criterion

Modern mock/API data can render without fake legacy values.

---

## 8. Phase 5 — Overview / Needs

### Files

Likely:

```text
src/features/overview/
src/components/
src/hooks/
src/types/domain.ts
```

### Work

Replace modern-path Attention derivation with a `Need[]` projection.

Need types should include at least:

- supervisor_blocked;
- attempt_blocked;
- attempt_quiet;
- usage_limited;
- attempt_failed;
- attempt_exited;
- attempt_interrupted;
- supervisor_missing/stopped;
- decision_open;
- report_unread.

Prefer Hand-provided severity/order when publicly exposed. If Serenade must compose multiple public lists, document that the result is a **presentation projection**, while the underlying facts remain canonical.

### UI

- global Needs badge;
- Overview queue;
- All clear state;
- task/ref links;
- direct safe actions.

### Exit criterion

Modern Overview no longer shows `legacy-derived` Attention.

---

## 9. Phase 6 — Supervisor migration

### Existing legacy area

```text
src-tauri/src/supervisor.rs
src/features/supervisor/
```

### Work

For modern Hand:

- stop spawning OpenCode directly;
- stop owning provider session IDs;
- stop reconstructing Supervisor context;
- use Hand Supervisor commands exclusively;
- fetch/render Supervisor state from Hand;
- send text through Hand;
- support image inputs using Hand's public attachment/input behavior;
- support start/resume/stop;
- support switch model/effort/profile/harness;
- support blocked-screen display and revision-guarded key actions.

### Legacy handling

If 0.6 Supervisor functionality remains necessary, isolate it behind a legacy-only module such as:

```text
src-tauri/src/legacy_supervisor.rs
```

Do not make modern code depend on it.

### Exit criterion

Closing/restarting Serenade does not terminate or orphan the modern Hand Supervisor.

---

## 10. Phase 7 — Modern mutations

### Backend

Add typed Tauri commands mapped 1:1 to qualified Hand operations.

Suggested semantic API:

```ts
createTask(input)
startTask(taskId)
setPlan(taskId, body)

startAttempt(taskId, options)
sendAttempt(attemptId, text)
stopAttempt(attemptId)
cleanAttempt(attemptId, discard?)

ackReport(reportId)
answerDecision(decisionId, answer)

startSupervisor(options?)
resumeSupervisor()
stopSupervisor()
sendSupervisor(text, attachments?)
switchSupervisor(options)

sendScreenKeys(target, revision, keys, digest?)
```

### Do not implement on modern Hand

- `merge`;
- `deliver`;
- `teardown`;
- `promote scout`;
- legacy route edits.

### Safety

- validate refs;
- enforce adapter compatibility before every mutation;
- preserve exact IDs;
- surface conflict/stale errors distinctly;
- no automatic retry of destructive actions after state conflicts.

### Tests

For every operation:

- expected argv;
- invalid ref blocked before process spawn;
- wrong adapter blocked;
- non-zero exit mapped to typed error;
- stale/conflict preserved;
- legacy command never invoked under modern adapter.

---

## 11. Phase 8 — Task / Plan / Attempt UX

### Tasks

Change the modern board to lifecycle-centric groups:

- Inbox;
- Active;
- Done;
- Abandoned.

"Needs attention" may be a filter/badge, not a fake lifecycle.

### Task detail

Add:

- goal;
- current Plan;
- Plan revision history;
- Attempt history;
- Report list;
- Decision list;
- event/history panel.

### Attempts

Rename/rework `Agents` feature toward Attempts.

Show:

- exact `aN`;
- lifecycle;
- agent state;
- harness/model/effort;
- worktree/branch;
- timestamps;
- reason;
- last screen tail when exposed;
- Reports.

### Remove modern actions

Delete/hide:

- Merge into main;
- Mark delivered;
- Finalize task;
- Promote scout.

### Exit criterion

No modern task UI uses scout/ship/execution-class semantics.

---

## 12. Phase 9 — Reports and Decisions

### Reports

Implement:

- list;
- unread filter;
- detail;
- task/attempt links;
- acknowledge;
- Markdown rendering;
- progress/done/stuck statuses.

### Decisions

Implement:

- Needs card;
- dedicated detail;
- numbered choice quick-fill;
- free-form answer;
- answered/withdrawn state;
- exact ref preservation.

### Exit criterion

All operator questions flow through Decisions and all worker summaries flow through Reports.

---

## 13. Phase 10 — Blocked-screen UX

### Work

Implement a reusable component:

```text
BlockedScreenCard
  target: supervisor | attempt
  targetRef
  sanitizedScreen
  revision
  digest?
  allowedKeys/options
```

On submit:

1. send exact revision/digest;
2. if accepted, refresh;
3. if stale/conflict, show "Screen changed";
4. refetch;
5. require a new explicit operator action.

### Exit criterion

Serenade cannot accidentally type an answer into a changed permission/trust screen.

---

## 14. Phase 11 — Profiles

### Rename

Modern:

```text
Routes → Profiles
```

### Work

Use `hand route list` as the read contract.

Show:

- name;
- harness;
- model;
- effort;
- validity;
- Hand-provided performance/track record fields when present.

Feed profile selections into Attempt/Supervisor start/switch actions.

### Editing

Do not add direct `routing.json` mutation in this phase.

Treat profile editing as a separate design decision unless Hand exposes an explicit safe command.

---

## 15. Phase 12 — Event bridge

### Backend design

Create a modern event service, e.g.:

```text
src-tauri/src/hand/modern/events.rs
```

Responsibilities:

- maintain last known Hand event cursor per connected fleet;
- invoke the qualified wait/events command;
- parse events;
- emit typed Tauri events;
- recover after process failure;
- request full refetch after cursor uncertainty.

### Frontend

Map event kinds to TanStack Query invalidation:

- Task events → task/task-list;
- Attempt events → attempt/task/Needs;
- Report events → reports/task/Needs;
- Decision events → decisions/task/Needs;
- Supervisor events → supervisor/chat/Needs.

Keep periodic low-frequency safety refresh.

### Exit criterion

Active fleet state updates promptly without 2–5 second global polling.

---

## 16. Phase 13 — Worktree / local review

### Keep Serenade conveniences

- open editor;
- open folder;
- open terminal;
- inspect local Git status;
- inspect diff;
- list commits;
- copy path.

### Lifecycle boundary

- worktree source path comes from Hand Attempt;
- cleanup invokes Hand only;
- do not call filesystem remove for modern Hand worktrees;
- do not call Treehouse.

### Exit criterion

Serenade offers better review ergonomics while Hand remains lifecycle owner.

---

## 17. Phase 14 — Setup / updates

### Modern environment UI

Show:

- Hand path;
- version;
- channel;
- commit;
- schema;
- Luvus version/pin;
- watcher;
- harnesses;
- profile validity;
- Fleet home.

### Setup

Modern path:

1. qualify/install Hand stable;
2. run `hand init`;
3. verify `hand version`;
4. inspect profiles/harness readiness;
5. register/open Fleet;
6. optionally start Supervisor.

### Update

- `hand update --check` first;
- show the plan;
- require confirmation;
- run `hand update`;
- rescan build/fleet status.

### Remove from modern setup

- Treehouse installer;
- Herdr installer;
- Herdr server controls.

Keep those only in clearly legacy 0.6 code until legacy retirement.

---

## 18. Phase 15 — Platform transports

Separate Hand semantics from executable transport.

### Linux / macOS

Native process runner.

### Windows + WSL2

Add a transport abstraction rather than sprinkling `wsl.exe` calls:

```rust
trait HandTransport {
    fn run(&self, argv: &[String], cwd: Option<&Path>) -> Result<Output, SerenadeError>;
}
```

Potential implementations:

- `NativeHandTransport`;
- `WslHandTransport`.

Validate:

- path translation;
- fleet home;
- repo/worktree paths;
- editor launch mapping;
- environment;
- cancellation;
- output encoding.

### Native Windows edge

Keep behind explicit experimental capability until upstream stable native Windows is released and live-qualified.

---

## 19. Phase 16 — Legacy isolation

Move Hand 0.6-only concepts into clearly named legacy modules.

Candidates:

```text
src-tauri/src/hand/legacy/
src/lib/hand/legacy/
```

Legacy-only concerns:

- Treehouse;
- Herdr;
- status files;
- legacy brief format;
- scout/ship;
- execution class;
- merge/deliver/teardown;
- Serenade-owned Supervisor runtime if still required.

Do not remove working legacy behavior in the same commit that introduces modern equivalents.

### Exit criterion

Modern code can be understood without reading legacy implementation.

---

## 20. Phase 17 — Qualification

### Automated matrix

Run on every modern integration PR:

```text
npm ci
npm run typecheck
npm run test
npm run build
cargo check --locked --manifest-path src-tauri/Cargo.toml
cargo test --locked --manifest-path src-tauri/Cargo.toml
```

Add modern fixture suites.

### Live E2E checklist

At minimum:

1. launch Serenade against a fresh Hand 0.9 Fleet;
2. create/register project;
3. create Task;
4. add Plan;
5. start Supervisor;
6. chat;
7. start Attempt;
8. receive progress Report;
9. receive done Report;
10. acknowledge Report;
11. create/answer Decision;
12. trigger/handle blocked worker screen;
13. trigger/handle blocked Supervisor screen;
14. stop/clean Attempt;
15. complete Task;
16. restart Serenade;
17. verify all canonical state survives;
18. run update check;
19. verify unknown/edge mutation blocking policy.

### Production gate

Do not mark `modern-0.9` mutations as generally supported until E2E passes on at least one supported transport and all fixture tests are green.

---

## 21. Suggested commit sequence

Keep commits narrow enough to review/revert:

1. `test: add Hand 0.9 public contract fixtures`
2. `refactor: add modern Hand build capability model`
3. `feat: add modern Hand TOON parser`
4. `feat: add read-only HandModernGateway`
5. `refactor: add modern domain projections`
6. `feat: add canonical Needs surface`
7. `feat: route Supervisor through modern Hand`
8. `feat: add modern task and attempt mutations`
9. `feat: add Reports and Decisions`
10. `feat: add blocked-screen revision flow`
11. `refactor: replace Routes with Profiles on modern Hand`
12. `feat: add Hand event cursor bridge`
13. `refactor: modernize setup and Hand update flow`
14. `refactor: isolate legacy Hand 0.6 runtime`
15. `test: qualify Hand 0.9 live workflow`

Do not squash all modernization into one implementation commit while developing; the integration crosses too many safety boundaries.

## 22. Codex execution rules

When Codex implements this plan:

- inspect the installed/target Hand public CLI before adding each command;
- prefer a fixture/test before parser code;
- stop and document the mismatch if the real public output differs from these docs;
- do not compensate for a changed Hand contract by reading internal DB files;
- keep feature flags/compatibility gates conservative;
- preserve legacy tests;
- update `docs/hand-modern-roadmap.md` checkboxes as phases land;
- record any upstream Hand version/schema/command assumptions in test fixtures or adapter comments, not scattered UI code.

## 23. First implementation slice

The recommended first Codex task is intentionally read-only:

> Implement Phase 0 through Phase 3: capture Hand 0.9 fixtures, add build/capability negotiation, implement a fixture-tested modern TOON parser, and add a read-only `HandModernGateway` for version/orient/projects/tasks/attempts/reports/decisions/profiles/supervisor. Do not add modern mutations yet.

That slice creates the foundation needed to safely replace the UI incrementally.
