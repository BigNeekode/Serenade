# Serenade — Hand 0.8 Alignment Roadmap

> **Purpose:** living tracker for adapting Serenade to Secondhand / `hand` 0.8 without coupling the GUI to unfinished Hand internals.
>
> **Last reviewed:** 2026-08-29  
> **Current integration state:** alignment + stabilization merged to `main`  
> **Verified production baseline:** Hand 0.6.x  
> **CI:** `.github/workflows/ci.yml` — frontend typecheck/tests/build + Rust check/tests  
> **Upstream 0.8 status:** architecture/spec work in progress; do not implement guessed v19 persistence/read-model details.

---

## 1. Product boundary

Serenade is the **Presentation + Interaction layer** above Hand, not a second orchestration/control plane.

```text
Operator
  ↓
Serenade Presentation
  ↓
Serenade Interaction
  ├─ reasoning-required input → Supervisor Harness / runtime ─┐
  └─ exact typed operator action ──────────────────────────────┤
                                                               ↓
                                                            Hand core
                                                               ↓
                                              Fleet → Project → Task
                                                        → Plan
                                                           ↓
                                                        Attempt
                                                           ↓
                                                     Worker Harness
```

Canonical invariants:

```text
Serenade presentation state ≠ workflow truth
Serenade chat history       ≠ workflow truth
Supervisor provider session ≠ workflow truth
Worker/agent "done"         ≠ lifecycle completion
WorkerReport "done"         ≠ lifecycle completion

Hand canonical state + exact external evidence + Hand currentness validation
= workflow truth
```

Serenade may persist UI preferences, cached presentation data, selected views, and chat transcript for UX. None of those may authorize or redefine Hand workflow state.

---

## 2. Upstream contracts to track

- `atqamz/hand#339` — v19 implementation umbrella; Fleet → Project → Task → Plan → Attempt.
- `atqamz/hand#344` — exact replacement v19 schema lock. **Do not code Serenade against guessed v19 persistence before this locks.**
- `atqamz/hand#346` — capability/adapter boundaries, WorkerInput/WorkerWake, native Git worktree, Harness role separation.
- `atqamz/hand#347` — FleetSnapshot, Attention, SupervisorOrientation/read-model contract.
- `atqamz/hand#353` — Supervisor lifecycle: `hand session start` once per actual runtime, `hand orient` every reasoning turn.
- `atqamz/hand#355` — concrete Supervisor host/wake qualification matrix.

Current architectural facts:

1. Presentation owns no durable workflow truth.
2. Reasoning-required input flows through a Supervisor Harness.
3. Already-exact typed input can call canonical Hand operations directly.
4. Supervisor Harness and Worker Harness are semantically distinct roles.
5. Supervisor runtime/session identity is ephemeral, not a Fleet workflow entity.
6. `hand orient` reconstructs fresh bounded Supervisor truth every reasoning/wake turn.
7. WorkerReport/provider state is distinct from lifecycle/currentness.
8. Fresh v19 replaces Treehouse execution with native Git `WorktreeBinding`.
9. Session/provider mechanics remain below Serenade.
10. Serenade must not invent private v19 workflow truth while upstream contracts are still moving.

---

## 3. Compatibility policy

Until each release line is explicitly qualified:

| Hand | Serenade mode | Workflow mutations |
|---|---|---|
| `0.6.x` | `legacy-0.6` | **enabled** — verified baseline |
| `0.7.x` | `transition-0.7` | **blocked** until released 0.7 is verified |
| `0.8.x+` | `v0.8-unadapted` | **blocked** until canonical adapter is verified |
| older / unparsable / unknown | `unknown` | **blocked** |

Read-only diagnostics remain available where safe. Unknown/new contracts fail closed rather than silently issuing legacy mutations.

Compatibility checks exist at multiple boundaries on purpose:

```text
frontend HandGateway
      ↓
Tauri mutation command entry
      ↓
filesystem side-effect guard where needed
      ↓
HandRunner process boundary
```

---

## 4. Current architecture

```text
React features
      ↓
SerenadeApi reads / local tooling
      │
      └─ operator workflow intent
             ↓
      InteractionGateway
       ├─ reasoning → Supervisor Harness
       └─ exact typed action
             ↓
      TauriSerenadeApi
             ↓
      frontend HandGateway (version policy)
             ↓
      Tauri commands
             ↓
      Rust HandLegacyGateway / HandRunner
             ↓
      legacy Hand 0.6 CLI contract
```

Supervisor is a sibling capability rather than a Worker route:

```text
Serenade Supervisor setting
      ↓
qualified Supervisor Harness adapter
      └─ OpenCode (qualified today)

Hand Worker routes/profiles
      ↓
Worker Harness selection per Attempt
```

Target after released Hand 0.8 contracts stabilize:

```text
React features
      ↓
Serenade presentation/read models
      ↓
Interaction + HandGateway
   ├─ HandLegacyGateway   // legacy compatibility
   └─ HandV08Gateway      // released canonical projections/actions
      ↓
hand
```

---

## 5. Completed / in-progress work

### Architecture

- [~] **S08-001 — Versioned HandGateway boundary**
  - [x] Frontend `src/lib/hand/gateway.ts`.
  - [x] Frontend compatibility policy in `src/lib/hand/compatibility.ts`.
  - [x] Rust `HandLegacyGateway` in `src-tauri/src/hand/gateway.rs`.
  - [x] Legacy `fleet_status`, `task_status`, `projects`, `config_document`, and `session_start_hint` command vocabulary lives behind the Rust gateway.
  - [x] Supervisor `orient` / legacy `session start` fallback lives behind the Rust gateway.
  - [x] General Tauri read code no longer spells legacy read CLI commands directly.
  - [x] Legacy `task_status` preserves task-ID validation and task-not-found normalization.
  - [ ] Add `HandV08Gateway` only after the released 0.8 structured contract is stable.
  - [~] Legacy Hand model structs are still consumed by the compatibility adapter/presentation mapper; that is acceptable until a canonical 0.8 adapter exists.

- [~] **S08-002 — Compatibility/version negotiation**
  - [x] Reuse `hand --version` environment probe.
  - [x] Classify 0.6 / 0.7-transition / 0.8-unadapted / unknown in frontend.
  - [x] Mirror compatibility classification in Rust.
  - [x] Show contract + mutation state in Settings/Diagnostics.
  - [x] Gate workflow mutations in `TauriSerenadeApi`.
  - [x] Gate every legacy mutation again at Tauri/Rust command entry.
  - [x] Gate legacy workflow commands inside `HandRunner`.
  - [x] Guard pre-spawn brief creation before filesystem side effects.
  - [x] Frontend and Rust regression tests exist for version policy.
  - [ ] Qualify Hand 0.7 only after testing its actual released contract.

### Supervisor

- [~] **S08-010 — Align Supervisor runtime lifecycle**
  - [x] Provider session identity is explicitly runtime-only.
  - [x] Best-effort fresh Hand preflight occurs per turn.
  - [x] Verified 0.6 uses legacy `session start` context rather than probing known-missing `orient` first.
  - [x] Actual Supervisor Harness is instructed to bootstrap itself and refresh Hand context before reasoning/action.
  - [x] Configured Hand binary and `HAND_HOME` are used; no hardcoded `hand` path assumption in preflight.
  - [ ] Live integration-test the actual OpenCode runtime behavior against Hand 0.6.
  - [ ] Cover autonomous wake/re-entry after Hand exposes a qualified wake contract.

- [~] **S08-011 — Remove private Supervisor Fleet truth**
  - [x] Removed manually assembled fleet/project JSON from Supervisor prompt context.
  - [x] Fresh Hand context outranks remembered chat state.
  - [x] Chat/session state is documented as UX/runtime state only.
  - [ ] Re-evaluate the Serenade-collected first-turn `session start` compatibility hint after live runtime testing.

- [~] **S08-012 — Provider-neutral Supervisor Harness**
  - [x] `supervisorHarness` config is separate from Hand Worker routes/profiles.
  - [x] Qualified runtime dispatch boundary exists in `supervisor.rs`.
  - [x] OpenCode is the only currently qualified/selectable adapter.
  - [x] Unqualified adapters fail closed before spawn.
  - [x] Settings/Diagnostics expose the selected Supervisor Harness.
  - [ ] Qualify Claude/Codex/Pi/other Supervisor adapters only after their headless/session/resume/output contracts are verified.

### Interaction

- [~] **S08-020 — Explicit reasoning vs exact-action paths**
  - [x] `InteractionGateway` exists.
  - [x] Shared `useInteraction()` hook exists.
  - [x] Reasoning-required prose goes to Supervisor chat/runtime.
  - [x] Supervisor task approval is a direct typed task-create operation; no extra LLM turn.
  - [x] Task create/send/retry/stop/promote hooks route through InteractionGateway.
  - [x] Worktree cleanup routes through InteractionGateway.
  - [x] Local-only open editor/folder/terminal stays outside workflow interaction.
  - [ ] Replace legacy exact-action payloads with canonical Hand 0.8 action/currentness contracts when released.

- [ ] **S08-021 — Preserve exact identity/currentness**
  - Never retarget stale UI actions to "whatever is current now".
  - Keep future currentness witnesses opaque above Hand-owned services.
  - Surface stale-action failure and refresh instead of guessing.

### Domain / presentation

- [~] **S08-030 — Stop flattening report/observation/lifecycle semantics**
  - [x] Provider `done` does not become Task review/completion while Attempt is running.
  - [x] Provider `done` maps to waiting for a still-running Attempt.
  - [x] WorkerReport `done` alone does not complete a running Attempt/Task.
  - [x] Terminal success follows stronger Hand lifecycle/delivery facts.
  - [x] Duplicate lifecycle derivation in `agents_list` was consolidated into tested adapter logic.
  - [x] Compact detail exposes Attempt lifecycle separately from convenience Task status.
  - [ ] Expand full Task detail to separately name report Claim, provider activity, and Attempt lifecycle.

- [~] **S08-031 — Task → Plan → Attempt progressive disclosure**
  - [x] `TaskLineage`, `PlanProjection`, and `AttemptProjection` presentation types exist.
  - [x] Legacy adapter fills only real Attempt facts.
  - [x] Legacy Plan remains absent and is displayed as `unavailable on legacy Hand`.
  - [x] Regression test locks the no-fabricated-Plan invariant.
  - [x] Compact Task detail shows lineage provenance.
  - [ ] Add full Plan/history UI after canonical Hand projections exist.

- [~] **S08-032 — First-class Attention surface**
  - [x] Overview has an Attention panel.
  - [x] Current items are explicitly `legacy-derived`.
  - [x] Rendering does not acknowledge/authorize/mutate Hand state.
  - [x] Regression coverage locks Attention provenance behavior.
  - [ ] Replace local derivation with canonical Hand `Attention` when released.
  - [ ] Render canonical priority/code/exact subject/actions/currentness only after those contracts stabilize.

### Provider / worktree abstraction

- [~] **S08-040 — Keep Treehouse out of Serenade domain vocabulary**
  - Frontend Worktree domain is provider-neutral.
  - Treehouse references remain legacy Hand 0.6 runtime documentation only.
  - Future v19 UI should consume Hand `WorktreeBinding` projections rather than provider concepts.

- [~] **S08-041 — Session/Executor mechanics remain informational**
  - Serenade does not own Herdr/tmux/provider lifecycle.
  - Current Herdr/Treehouse details remain legacy runtime concerns below Serenade.

---

## 6. Intentionally blocked until Hand 0.8 stabilizes

- [!] **S08-100 — v19 persistence/schema assumptions** — blocked on `#344/#339`; never query or reproduce a guessed v19 schema.
- [!] **S08-101 — canonical FleetSnapshot adapter** — wait for final released structured contract.
- [!] **S08-102 — canonical Attention actions** — wait for final action/currentness representation.
- [!] **S08-103 — canonical SupervisorOrientation parser** — runtime behavior can align now; typed parsing waits for release contract.
- [!] **S08-104 — WorkerInput / WorkerWake UI** — do not rename old `send` into guessed v19 semantics.
- [!] **S08-105 — native WorktreeBinding adapter** — wait for the released Hand contract rather than duplicating Treehouse/native-Git decisions in Serenade.
- [!] **S08-106 — remove 0.6 compatibility** — only after Serenade intentionally raises its minimum supported Hand version.

---

## 7. Validation baseline

Post-alignment stabilization was validated locally with:

```text
npm install                 succeeded
npm run typecheck           passed
npm run test                passed (27/27 at stabilization time)
npm run build               passed (chunk-size warning only)
cargo check                 passed
cargo test                  passed (15/15 at stabilization time)
```

Repository CI now exists at `.github/workflows/ci.yml` and runs:

```text
npm ci
npm run typecheck
npm test
npm run build
cargo check --locked --manifest-path src-tauri/Cargo.toml
cargo test --locked --manifest-path src-tauri/Cargo.toml
```

The stabilization merge on `main` passed CI. The post-merge task-status gateway validation fix also passed CI.

---

## 8. Remaining transition debt / next safe work

1. **Expand full Task detail** so these are separate named facts rather than one overloaded status:
   - Attempt lifecycle
   - provider/agent activity
   - latest WorkerReport claim
   - delivery/integration state
2. **Live-test OpenCode Supervisor runtime** against the verified Hand 0.6 environment:
   - first-runtime bootstrap
   - per-turn context refresh
   - project-scoped cwd
   - session resume/reset
3. **Keep compatibility policy current** when Hand 0.7 is actually released.
4. **Qualify additional Supervisor Harnesses** only when their real runtime/session contracts are known.
5. Continue ordinary Serenade UX/product work that does not depend on unfinished Hand 0.8 semantics.

**Next upstream checkpoint:** Hand 0.7 release or material `#344/#339` lock/implementation change.

---

## 9. UX / architecture invariants

1. Common-case UI remains understandable without exposing every canonical noun.
2. Exact semantics are available in detail/history views.
3. Presentation refresh performs no acknowledgement/mutation.
4. Worker/provider/report `done` is never silently promoted to lifecycle truth.
5. Exact/destructive actions fail stale instead of retargeting.
6. Supervisor reset/replacement loses zero canonical Fleet truth.
7. Provider topology does not become core navigation ontology.
8. Missing data on legacy Hand is shown as unavailable, not fabricated.
9. Locally-derived compatibility indicators are visibly labeled and never presented as canonical Hand Attention.
10. New Hand versions do not inherit mutation permission merely because their CLI still looks similar.

---

## 10. Next-update procedure

On every meaningful Secondhand update, review at minimum:

```text
latest Hand release/version
#339 implementation status
#344 schema lock
#346 capability boundaries
#347 read models / Attention / SupervisorOrientation
#353 Supervisor lifecycle
#355 Supervisor host support matrix
```

Record:

1. upstream changes;
2. invalidated Serenade assumptions;
3. newly unblocked `S08-*` work;
4. compatibility policy changes;
5. new public structured contracts;
6. Supervisor behavior changes;
7. Presentation/Interaction UX changes;
8. validation/CI results after adaptation.

---

## 11. Update log

### 2026-08-29 — Architecture alignment

- Serenade formally became Presentation + Interaction above Hand.
- Added frontend/Rust compatibility and gateway seams.
- Added fail-closed workflow mutation policy.
- Split reasoning-required input from exact typed actions.
- Aligned Supervisor lifecycle semantics without inventing v19 persistence.
- Stopped treating provider/report `done` as lifecycle truth.
- Added Task → Plan → Attempt presentation scaffolding and provenance-aware Attention shell.

### 2026-08-29 — Stabilization

- Finished legacy read routing through `HandLegacyGateway`.
- Consolidated duplicate lifecycle derivation.
- Added WorkerReport/lifecycle and no-fabricated-Plan regression tests.
- Verified frontend and Rust builds/tests locally.
- Merged stabilization work to `main`.
- GitHub Actions CI passed on the stabilization merge.

### 2026-08-29 — Post-merge review

- Reviewed stabilization changes on `main`.
- Confirmed current `main` CI was green.
- Restored task-ID validation and empty-result normalization inside `HandLegacyGateway::task_status`, preserving the semantic behavior of the helper replaced by the refactor.
- Added a regression test proving invalid task IDs are rejected before launching Hand.
- Post-fix CI passed.
- Refreshed the public README to document:
  - Hand 0.6.x as the verified mutation contract;
  - fail-closed 0.7/0.8 policy;
  - Presentation + Interaction architecture;
  - Supervisor/Worker Harness separation;
  - Task lineage and legacy-derived Attention semantics;
  - current CI/development workflow.
