# Serenade — Modern Hand Alignment Roadmap

> **Target:** Secondhand / `hand` 0.9+  
> **Last reviewed:** 2026-10-07  
> **Current Serenade runtime baseline:** Hand 0.6.x legacy adapter  
> **Modern qualification baseline:** Hand 0.9.0 stable  
> **Current upstream edge:** newer than 0.9.0; useful for development observation, not automatically mutation-qualified  
> **Purpose:** migrate Serenade from its legacy Hand 0.6 compatibility layer to the modern Hand interaction model without duplicating Hand state, runtime or Supervisor responsibilities.

---

## 1. Outcome

The modernization is complete when Serenade is a first-class desktop client for modern Hand:

```text
Operator
  ↓
Serenade
  ├─ Overview / Needs
  ├─ Supervisor UI
  ├─ Task / Plan / Attempt UI
  ├─ Reports / Decisions
  ├─ Profiles
  └─ local Git/editor convenience
          ↓
     HandModernGateway
          ↓
        hand CLI
          ↓
  canonical Hand state
  + managed Supervisor
  + Luvus
  + worktrees
```

Serenade must not become a second board backend, Supervisor runtime or workflow database.

## 2. Upstream facts now considered stable enough to design against

The old Hand 0.8 roadmap treated the redesign as speculative. That is no longer true.

Modern Hand now publicly defines:

1. Fleet state in `hand.db`, owned exclusively by Hand.
2. Projects that reference repositories Hand uses in place.
3. goal-based Tasks (`tN`).
4. Plan revisions (`pN`).
5. Attempts (`aN`) with native Git worktrees.
6. Reports (`rN`) with `progress|done|stuck`.
7. Decisions (`dN`) for Supervisor → operator questions.
8. managed Supervisor launches (`sN`) and queued inputs (`iN`).
9. routing profiles in `routing.json`.
10. Luvus as the only runtime backend.
11. event cursors/wakes so Supervisor and clients do not need to poll continuously.
12. a canonical operator "Needs" model in Hand's board behavior.
13. revision-guarded blocked-screen interaction.
14. TOON as the CLI output format.
15. `hand version` metadata including version/channel/commit/schema/tested Luvus.
16. `hand update` for binary/fleet/Luvus update orchestration in 0.9+.

## 3. Architectural rules

These are non-negotiable during migration.

### HM-INV-01 — Hand owns truth

No modern Serenade code may read or write `hand.db` directly.

### HM-INV-02 — Public contract only

The modern adapter uses public Hand CLI/TOON behavior. Internal Go packages, board HTML structure and SQLite schema are not application APIs.

### HM-INV-03 — One Supervisor

Serenade must not launch or persist a separate canonical Supervisor session when using modern Hand.

### HM-INV-04 — Luvus stays below Hand

Serenade may display Luvus health reported by Hand, but it does not manipulate Luvus as the workflow runtime.

### HM-INV-05 — Exact refs

Mutations preserve the exact `tN/pN/aN/rN/dN/sN/iN` identity supplied by the current projection.

### HM-INV-06 — Fail stale

Revision/cursor/state conflicts trigger refresh. Serenade does not automatically retarget the operator action.

### HM-INV-07 — Reading is side-effect free

Refreshing Tasks, Needs, Reports or Decisions never acknowledges/answers/changes them.

### HM-INV-08 — Legacy and modern stay separated

Legacy commands whose semantics disappeared in modern Hand remain inside `HandLegacyGateway` and never leak into `HandModernGateway`.

---

## 4. Compatibility policy

### During migration

| Hand | Adapter | Reads | Mutations |
|---|---|---:|---:|
| `0.6.x` | Legacy06 | yes | yes — current verified baseline |
| `0.7.x` | none | diagnostics only | no |
| `0.8.x` | Modern experimental | contract probes only | no by default |
| `0.9.x stable` | Modern09 | yes | yes after qualification |
| `0.9.x edge` | Modern09Edge | yes when compatible | capability-gated |
| newer `0.x` | unknown modern | diagnostics | no until qualified |
| `1.x+` / unparsable | unknown | diagnostics | no |

The adapter should prefer capability checks over simple numeric `>=` logic.

### Why 0.9 is the target baseline

Hand 0.8 introduced the redesign, but 0.9 adds the operational pieces Serenade should depend on for a production desktop integration:

- release binaries;
- edge/stable channels;
- `hand update`;
- `hand version` metadata;
- tested Luvus pin handling;
- macOS support;
- improved Supervisor/board behavior.

---

## 5. Migration workstreams

## HM-100 — Contract capture and test fixtures

**Status:** planned

Before implementing modern reads/mutations:

- [ ] Capture `hand version` output from 0.9 stable.
- [ ] Capture `hand orient` for empty, inbox, active, blocked, failed and clean fleets.
- [ ] Capture Task list/show outputs.
- [ ] Capture Plan list/show/current behavior.
- [ ] Capture Attempt list/show outputs for every lifecycle.
- [ ] Capture Report list/show/ack behavior.
- [ ] Capture Decision list/show/answer behavior.
- [ ] Capture `hand route list`.
- [ ] Capture Supervisor show/control outputs.
- [ ] Capture blocked-screen revision/digest behavior.
- [ ] Capture event/wait output and cursor behavior.
- [ ] Store sanitized fixtures in the Serenade test tree.
- [ ] Record exact exit-code behavior for success, invalid input, stale/conflict and runtime failures.

**Exit criterion:** modern parser/tests are based on observed public output, not guessed fields.

## HM-110 — Version and capability negotiation

**Status:** planned

- [ ] Replace the coarse `v0.8-unadapted` bucket with explicit adapter families.
- [ ] Parse `hand version` rather than depending only on `--version`.
- [ ] Track:
  - version;
  - channel;
  - commit;
  - state schema;
  - tested/pinned Luvus information where available.
- [ ] Add a modern capability object:
  - supervisor;
  - decisions;
  - reports;
  - plans;
  - attempts;
  - blocked-screen revision;
  - event wait/cursor;
  - updater;
  - native-Windows transport.
- [ ] Keep every mutation fail-closed until the selected adapter is qualified.

**Exit criterion:** Serenade can reliably classify 0.6 legacy, 0.9 stable modern, edge modern and unknown contracts.

## HM-120 — Rust `HandModernGateway`

**Status:** planned

Add a backend boundary parallel to `HandLegacyGateway`.

Target semantic reads:

- [ ] fleet/orient snapshot;
- [ ] projects;
- [ ] tasks;
- [ ] task detail;
- [ ] plan history/current plan;
- [ ] attempts;
- [ ] attempt detail;
- [ ] reports;
- [ ] decisions;
- [ ] routing profiles;
- [ ] supervisor state;
- [ ] events / wait cursor.

Requirements:

- fixed argv only;
- typed arguments;
- bounded output;
- timeout handling;
- TOON parser isolated in backend;
- no shell interpolation;
- no DB access;
- typed Serenade errors.

**Exit criterion:** modern Hand can populate a read-only Serenade UI.

## HM-130 — Modern mutations

**Status:** planned

Expose only public, exact Hand operations.

### Task / Plan

- [ ] add Task;
- [ ] start/activate Task when required by Hand contract;
- [ ] set/update Plan through canonical command;
- [ ] mark Task done only when Hand accepts it;
- [ ] abandon Task if public contract supports it.

### Attempt

- [ ] start Attempt with profile/model/effort options supported by Hand;
- [ ] send message/input to exact Attempt;
- [ ] stop exact Attempt;
- [ ] clean exact ended Attempt;
- [ ] continue/re-attempt where Hand supports it.

### Report

- [ ] acknowledge exact Report.

### Decision

- [ ] answer exact open Decision.

### Supervisor

- [ ] start;
- [ ] resume;
- [ ] stop;
- [ ] send input;
- [ ] switch model/effort/profile/harness;
- [ ] blocked-screen keys using exact revision/digest.

Legacy-only operations must not be ported:

- merge;
- deliver;
- teardown;
- scout promotion;
- legacy task route mutation.

**Exit criterion:** all modern UI actions map 1:1 onto qualified Hand operations and preserve refs/currentness.

## HM-140 — Domain model modernization

**Status:** planned

Replace modern-path presentation assumptions.

- [ ] Task loses `type: scout|ship`.
- [ ] Task loses `executionClass`.
- [ ] Add Plan entity/projection.
- [ ] Make Attempt first-class.
- [ ] Make Report first-class with acknowledgement state.
- [ ] Make Decision first-class.
- [ ] Add Supervisor projection.
- [ ] Add routing Profile.
- [ ] Add canonical Need projection.
- [ ] Keep provider/agent state as Attempt metadata, not a replacement lifecycle.
- [ ] Maintain a legacy mapper for Hand 0.6.

**Exit criterion:** React features no longer need legacy fake fields on modern Hand.

## HM-150 — Overview / Needs

**Status:** planned

- [ ] Replace modern-path `legacy-derived Attention` with canonical operator needs.
- [ ] Prioritize blocked screens/failures/decisions/unread reports consistently with Hand.
- [ ] Add **All clear** state.
- [ ] Add exact action affordances.
- [ ] Never acknowledge on render.
- [ ] Make Needs badge global in app shell.

**Exit criterion:** the Overview answers "what needs me?" from Hand-owned state.

## HM-160 — Supervisor migration

**Status:** planned

Retire the modern-path Serenade Supervisor runtime.

- [ ] Replace `supervisor.rs` provider process management with Hand Supervisor commands.
- [ ] Remove OpenCode-only modern restriction.
- [ ] Treat Hand harness/model/effort as canonical Supervisor configuration.
- [ ] Render public conversation/session projection only.
- [ ] Send operator text/images through Hand.
- [ ] Surface start/resume/stop/switch lifecycle.
- [ ] Surface blocked Supervisor screens.
- [ ] Preserve legacy Serenade Supervisor only while the 0.6 adapter remains supported, if needed.

**Exit criterion:** restarting Serenade loses no Supervisor workflow state and no agent process is owned by Serenade.

## HM-170 — Task / Plan / Attempt UX

**Status:** planned

- [ ] Replace legacy scout/ship Kanban.
- [ ] Group Tasks by real lifecycle.
- [ ] Show Plan history.
- [ ] Show Attempt history.
- [ ] Separate:
  - Task lifecycle;
  - Attempt lifecycle;
  - provider/agent state;
  - latest Report;
  - open Decision state.
- [ ] Add active Attempt controls.
- [ ] Add attempt screen tail when public Hand output exposes it.
- [ ] Remove modern merge/deliver/finalize actions.

**Exit criterion:** one task view can explain the entire modern Hand lineage without inferred lifecycle shortcuts.

## HM-180 — Reports and Decisions

**Status:** planned

- [ ] Dedicated Reports view.
- [ ] unread filter;
- [ ] acknowledge action;
- [ ] Task/Attempt backlinks;
- [ ] Report Markdown rendering;
- [ ] Report status chips: progress/done/stuck.
- [ ] Dedicated Decisions view/Needs card.
- [ ] numbered option quick-fill;
- [ ] exact answer mutation;
- [ ] answered/withdrawn history.

**Exit criterion:** operator interaction channels are first-class instead of being inferred from logs/status strings.

## HM-190 — Profiles

**Status:** planned

- [ ] Rename modern `Routes` UI to `Profiles`.
- [ ] Render `hand route list`.
- [ ] Show validity and harness/model/effort.
- [ ] Show Hand-provided track record when available.
- [ ] Feed profiles into Attempt/Supervisor start and switch dialogs.
- [ ] Do not directly edit `routing.json` unless a dedicated safe design is approved.

**Exit criterion:** modern Serenade contains no scout/ship route matrix.

## HM-200 — Real-time event bridge

**Status:** planned

- [ ] Use Hand cursor/event wait instead of aggressive polling where qualified.
- [ ] Backend owns long-running wait process/lifecycle.
- [ ] Emit typed Tauri events to frontend.
- [ ] Invalidate query keys by event subject/kind.
- [ ] Reconnect from last safe cursor.
- [ ] Fall back to bounded polling on failure.
- [ ] Never treat a missed frontend event as lost canonical state; refetch from Hand.

**Exit criterion:** active UI feels live without polling every screen every few seconds.

## HM-210 — Worktree and local Git integration

**Status:** planned

- [ ] Worktree location comes from Hand Attempt data.
- [ ] Local Git adapter may compute diff/status/commits for presentation.
- [ ] Opening editor/folder/terminal remains a Serenade local convenience.
- [ ] Cleanup always calls Hand Attempt clean.
- [ ] Never delete modern Hand worktrees directly.
- [ ] Remove Treehouse vocabulary from modern UI.

**Exit criterion:** local review UX is richer than `hand board` without owning lifecycle.

## HM-220 — Setup and environment modernization

**Status:** planned

- [ ] Modern environment scan understands `hand version`.
- [ ] Remove Treehouse/Herdr requirements for modern Hand.
- [ ] Show Hand-managed Luvus state.
- [ ] Use `hand init`.
- [ ] Use `hand update --check` for update plan.
- [ ] Invoke `hand update` only after explicit confirmation.
- [ ] Preserve legacy 0.6 setup behind legacy mode until retirement.
- [ ] Distinguish stable vs edge clearly.

**Exit criterion:** a modern setup never asks the user to install legacy runtime dependencies.

## HM-230 — Platform transports

**Status:** planned

### Linux

- [ ] native executable qualification.

### macOS

- [ ] native executable qualification;
- [ ] account for current launchd limitations in Hand where relevant.

### Windows

- [ ] WSL2 transport design:
  - command invocation;
  - fleet path;
  - repository/worktree path translation;
  - editor open behavior;
  - environment variables;
  - cancellation/timeouts.
- [ ] native Windows edge transport behind experimental flag only.
- [ ] move native Windows to qualified stable when upstream ships it and E2E passes.

**Exit criterion:** Hand contract support is not conflated with host process/path transport support.

## HM-240 — Legacy isolation and retirement

**Status:** planned

- [ ] Keep `HandLegacyGateway` compiling and tested while modern work lands.
- [ ] Move 0.6-specific files/status parsing behind legacy modules.
- [ ] Label legacy-only UI/actions explicitly in adapter mapping.
- [ ] Remove cross-adapter shared code that assumes identical command semantics.
- [ ] After modern E2E proves stable, decide whether 0.6 support is still worth carrying.

**Exit criterion:** removing legacy support later is a module deletion, not another architecture rewrite.

---

## 6. UX removals / renames

| Legacy Serenade | Modern Serenade |
|---|---|
| Attention | Needs You |
| Agents | Attempts |
| Routes | Profiles |
| Scout / Ship | Task goal + Plan/Attempt |
| Execution class | Routing profile / effort |
| OpenCode Supervisor | Hand Supervisor |
| Treehouse runtime | Hand native worktree |
| Herdr runtime | Hand → Luvus |
| Promote scout | create/update normal Hand Task/Plan |
| Merge / Deliver / Finalize | removed from Hand workflow |
| status-file report | canonical Report |
| prompt question inferred from logs | Decision |

---

## 7. Validation matrix

Every phase touching Hand must add fixture + live validation.

### Automated

```text
npm run typecheck
npm run test
npm run build
cargo check --locked --manifest-path src-tauri/Cargo.toml
cargo test --locked --manifest-path src-tauri/Cargo.toml
```

Add:

- TOON fixture parser tests;
- adapter compatibility tests;
- mutation argv tests;
- stale/ref preservation tests;
- no-side-effect read tests;
- modern/legacy isolation tests.

### Live Hand 0.9 baseline scenarios

1. initialize fleet;
2. register project;
3. add inbox Task;
4. set Plan;
5. start Supervisor;
6. send Supervisor input;
7. Supervisor creates/updates workflow;
8. start Attempt;
9. receive progress Report;
10. receive done/stuck Report;
11. answer Decision;
12. handle blocked worker screen;
13. handle blocked Supervisor screen;
14. stop Attempt;
15. clean Attempt;
16. mark Task done;
17. update Hand using `--check` then explicit update;
18. restart Serenade and prove state is preserved entirely by Hand.

---

## 8. Definition of done for the modern adapter

The modern adapter is **not** considered production-qualified until:

- no workflow feature depends on direct database/filesystem state from Hand internals;
- Supervisor is fully Hand-owned;
- Needs, Decisions and Reports are canonical;
- Plan/Attempt history renders correctly;
- modern destructive actions preserve exact refs;
- blocked-screen stale protection is tested;
- event reconnect/refetch behavior is tested;
- stable 0.9 contract fixtures pass;
- at least one real Linux/macOS/WSL2 environment passes E2E for its supported transport;
- edge builds remain explicitly separate from stable support;
- legacy 0.6 regression tests remain green.

---

## 9. Recommended implementation order

```text
HM-100 fixtures
   ↓
HM-110 version/capabilities
   ↓
HM-120 modern reads
   ↓
HM-140 domain model
   ↓
HM-150 Needs
   ↓
HM-160 Supervisor
   ↓
HM-130 mutations
   ↓
HM-170 Task/Plan/Attempt
   ↓
HM-180 Reports/Decisions
   ↓
HM-190 Profiles
   ↓
HM-200 event bridge
   ↓
HM-210 Worktree UX
   ↓
HM-220 setup/update
   ↓
HM-230 platform transports
   ↓
HM-240 legacy retirement decision
```

Some phases may overlap, but **fixtures/version negotiation must land before modern mutations**.

---

## 10. Upstream review procedure

For each new Hand stable release:

1. inspect release notes;
2. inspect `hand version` metadata;
3. diff public README/spec/vocabulary/CLI behavior;
4. update captured fixtures;
5. run parser/adapter regression tests;
6. run live read-only smoke tests;
7. only then expand mutation qualification;
8. record platform changes, especially Windows/macOS runtime support.

For edge:

- use for observation and forward-compatibility testing;
- never silently upgrade stable users;
- never grant mutation permission just because the edge version is newer.

---

## 11. Roadmap status log

### 2026-08-29 — pre-release 0.8 architecture alignment

Serenade introduced versioned Hand gateway boundaries, fail-closed compatibility, reasoning vs exact-action separation and provisional Task → Plan → Attempt presentation.

That work remains valuable as migration scaffolding.

### 2026-10-07 — modern Hand reset

The earlier roadmap assumption that Hand 0.8 contracts were unfinished is retired.

Key changes now accepted:

- Hand 0.8 shipped the redesign.
- Hand 0.9 is the stable modernization target.
- Luvus replaced Herdr/Treehouse.
- Hand owns the managed Supervisor.
- Decisions, Reports, Plans and Attempts are canonical records.
- routing profiles replaced the legacy route matrix.
- event cursor/wakes provide an event-driven integration path.
- `hand update` replaces Serenade's need to own modern runtime updating.
- modern Hand removed merge/deliver/teardown workflow concepts.

This roadmap supersedes the old speculative 0.8 tracker.
