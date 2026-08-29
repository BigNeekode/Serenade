# Serenade — Hand 0.8 Alignment Roadmap

> **Purpose:** living tracker for adapting Serenade to Secondhand / `hand` 0.8 without coupling the GUI to unfinished Hand internals.
>
> **Last reviewed:** 2026-08-29  
> **Implementation branch:** `chore/post-hand-alignment-stabilization`  
> **Verified production baseline:** Hand 0.6.x  
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

Canonical rule:

```text
Serenade presentation state ≠ workflow truth
Serenade chat history       ≠ workflow truth
Supervisor provider session ≠ workflow truth
Worker/agent "done"         ≠ lifecycle completion

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
7. WorkerReport/agent/provider state is distinct from lifecycle/currentness.
8. Fresh v19 replaces Treehouse execution with native Git `WorktreeBinding`.
9. Session/provider mechanics remain below Serenade.
10. `#339` remains blocked on the exact `#344` relock; Serenade must not invent a private v19 model meanwhile.

---

## 3. Compatibility policy

Until each release line is explicitly qualified:

| Hand | Serenade mode | Workflow mutations |
|---|---|---|
| `0.6.x` | `legacy-0.6` | **enabled** — verified baseline |
| `0.7.x` | `transition-0.7` | **blocked** until released 0.7 is verified |
| `0.8.x+` | `v0.8-unadapted` | **blocked** until canonical adapter is verified |
| older / unparsable / unknown | `unknown` | **blocked** |

Read-only diagnostics should remain available where safe. Unknown/new contracts fail closed rather than silently issuing legacy mutations.

---

## 4. Current mismatch inventory

### M01 — Supervisor context/runtime ownership

Legacy Serenade assembled first-turn truth from `session start + status JSON + project JSON + chat history`. Target behavior is actual Supervisor runtime bootstrap plus fresh per-turn orientation.

**Branch progress:** private fleet/project JSON assembly and injection are gone. Serenade performs a read-only preflight through the configured Rust Hand gateway and the selected qualified Supervisor runtime is explicitly instructed to run its own `hand session start`/`hand orient` contract. A Serenade-collected first-turn `session start` bootstrap hint still exists for 0.6 compatibility; consider removing it after live runtime integration is verified.

### M02 — Lifecycle flattening

Legacy adapters collapse some provider/report signals into convenient statuses.

**Branch progress:** both adapter paths now keep `agent_state=done` distinct from Attempt completion. Terminal Task `done` follows delivery/merge/Attempt lifecycle rather than a report claim. Compact Task details also expose Attempt lifecycle separately through the lineage projection. The general Task status remains a convenience presentation label, so richer detail semantics are still desirable.

### M03 — Backend coupled to Hand 0.6 shapes

Rust currently parses Hand 0.6 JSON/files directly.

**Branch progress:** both frontend and Rust now have explicit Hand compatibility/gateway seams. `src-tauri/src/hand/gateway.rs` owns legacy Supervisor fallback behavior; `process.rs` and each mutation command entry fail closed on unqualified Hand contracts. Brief creation also checks compatibility before touching disk. General read commands still directly consume Hand 0.6 models, so the migration is not complete.

### M04 — Task-centric UI hides Plan/Attempt lineage

**Branch progress:** the Serenade Task domain now has an optional progressive `TaskLineage` projection. The legacy adapter exposes only real Attempt facts and deliberately leaves Plan absent. The compact Task detail panel shows Task → Plan → Attempt, with Plan explicitly unavailable on legacy Hand. Full history/Plan UI waits for canonical data.

### M05 — Attention inferred locally

**Branch progress:** Overview now has an Attention surface, but its current items are explicitly labeled `legacy-derived`. They are diagnostic/progression/retry presentation hints only; the component states that they do not acknowledge, authorize, or replace Hand state. Once Hand publishes canonical `Attention`, that projection should replace the local derivation.

---

## 5. Work we can do before v19 locks

### Architecture

  - [~] **S08-001 — Versioned HandGateway boundary**
    - [x] Add `src/lib/hand/gateway.ts` outside React feature code.
    - [x] Centralize frontend compatibility policy in `src/lib/hand/compatibility.ts`.
    - [x] Add Rust `HandLegacyGateway` in `src-tauri/src/hand/gateway.rs`.
    - [x] Move Supervisor legacy `orient`/`session start` fallback knowledge into the Rust gateway.
    - [x] Keep React features on Serenade domain/API contracts.
    - [x] Put the remaining Rust status/project/task reads behind the legacy gateway instead of general `lib.rs` command code.
    - [ ] Add `HandV08Gateway` only after the released 0.8 structured contract is stable.
    - [~] Remove direct Hand-shape knowledge from general Tauri command code over time (reads are now behind the gateway; exact legacy mutations still spell direct commands because they are already-exact typed actions).

- [~] **S08-002 — Compatibility/version negotiation**
  - [x] Reuse existing `hand --version` environment probe.
  - [x] Classify 0.6 / 0.7-transition / 0.8-unadapted / unknown in frontend.
  - [x] Mirror the compatibility classifier in Rust.
  - [x] Show contract + mutation state in Settings/Diagnostics.
  - [x] Gate workflow mutations in `TauriSerenadeApi`.
  - [x] Gate every legacy mutation command again at Tauri/Rust command entry.
  - [x] Gate legacy Hand workflow commands inside `HandRunner` as a second process-boundary check.
  - [x] Guard pre-spawn brief creation before filesystem side effects.
  - [x] Add frontend and Rust unit tests for version classification.
  - [ ] Qualify Hand 0.7 after its actual release before enabling its mutations.

### Supervisor

- [~] **S08-010 — Align Supervisor runtime lifecycle**
  - [x] Preserve first-runtime bootstrap behavior.
  - [x] Best-effort preflight every turn; verified 0.6 goes directly to legacy `session start`, transition/newer contracts prefer `hand orient`.
  - [x] Instruct the **actual Supervisor Harness runtime** to run `hand session start` once and `hand orient` every reasoning turn itself.
  - [x] Explicitly treat provider session IDs as ephemeral runtime mechanics.
  - [x] Route preflight through the configured `HandRunner`/`HAND_HOME` instead of hardcoded `hand` on PATH.
  - [ ] Verify actual runtime command execution with integration tests.
  - [ ] Cover autonomous wake/re-entry once Serenade has a qualified wake path.

- [~] **S08-011 — Remove private Supervisor Fleet truth**
  - [x] Remove manually assembled fleet/project JSON from first-turn context.
  - [x] Fresh Hand context outranks remembered chat state.
  - [x] State that chat/session state is UX/runtime only.
  - [ ] Consider removing Serenade's externally collected first-turn `session start` hint entirely once actual Supervisor runtime execution is integration-tested.

- [~] **S08-012 — Provider-neutral Supervisor Harness**
  - [x] Add a Serenade-owned `supervisorHarness` setting separate from Hand Worker routes/profiles.
  - [x] Add an explicit qualified runtime dispatch boundary in `supervisor.rs`.
  - [x] Keep OpenCode as the only selectable/accepted adapter while it is the only Serenade-qualified headless/session path.
  - [x] Fail closed before spawning when an unqualified Harness value reaches the runtime adapter.
  - [x] Surface the qualified Supervisor Harness in Settings/Diagnostics.
  - [ ] Qualify Claude/Codex/Pi/other Supervisor Harness adapters only after their actual headless/session/resume/output contracts are verified.

### Interaction

- [~] **S08-020 — Explicit reasoning vs exact-action paths**
  - [x] Add `src/lib/interaction/gateway.ts`.
  - [x] Add shared `useInteraction()` feature hook.
  - [x] `sendReasoningInput(...)` goes to Supervisor chat/runtime.
  - [x] Task approval uses direct typed `createTask(...)`; no extra LLM turn.
  - [x] Task create/send/retry/stop/promote hooks route through InteractionGateway.
  - [x] Worktree cleanup routes through InteractionGateway; local-only open editor/folder/terminal remains outside workflow interaction.
  - [ ] Replace legacy exact-action payloads with canonical Hand 0.8 action/currentness contracts when released.

- [ ] **S08-021 — Preserve exact identity/currentness**
  - Never retarget stale UI actions to "whatever is current now".
  - Keep future currentness witnesses opaque above Hand-owned services.
  - Surface stale-action failure and refresh instead of guessing.

### Domain / Presentation

- [~] **S08-030 — Stop flattening report/observation/lifecycle semantics**
  - [x] Legacy `derive_task_status` no longer promotes provider `done` into review/completion.
  - [x] Terminal Task completion follows delivery/merge/Attempt lifecycle rather than WorkerReport `done`.
  - [x] Both Agent projection paths map `agent_state=done` to waiting while Attempt remains running.
  - [x] Compact detail exposes Attempt lifecycle separately from the convenience Task status.
  - [ ] Expand full Task detail to show report claim/provider activity/lifecycle as separate named facts.

- [~] **S08-031 — Task → Plan → Attempt progressive disclosure**
  - [x] Add optional TaskLineage / PlanProjection / AttemptProjection types.
  - [x] Legacy adapter fills real Attempt ordinal/lifecycle/Harness/model only.
  - [x] Legacy Plan remains absent; Serenade explicitly displays `unavailable on legacy Hand` rather than guessing.
  - [x] Compact Task detail shows the lineage slot with source provenance.
  - [ ] Add full history/Plan detail after canonical Hand projections exist.

- [~] **S08-032 — First-class Attention surface**
  - [x] Add Overview Attention panel.
  - [x] Label current items `legacy-derived` and explain that rendering does not acknowledge/authorize Hand state.
  - [x] Keep legacy classes limited to diagnostic/progression/retry indicators rather than pretending to expose canonical priority/currentness.
  - [ ] Replace derivation with Hand canonical `Attention` when released.
  - [ ] Render canonical priority/code/exact subject/available actions/currentness once those contracts stabilize.

### Provider / worktree abstraction

- [~] **S08-040 — Keep Treehouse out of Serenade domain vocabulary**
  - Current frontend Worktree domain is provider-neutral.
  - Treehouse references remain legacy Hand 0.6 integration/prerequisite documentation only.
  - Future v19 UI should consume Hand WorktreeBinding projections rather than provider concepts.

- [~] **S08-041 — Session/Executor mechanics remain informational**
  - Serenade does not own Herdr/tmux/provider lifecycle.
  - Legacy raw Hand models still expose Herdr references and should be confined to the legacy adapter as Rust is refactored.

---

## 6. Intentionally blocked until Hand 0.8 stabilizes

- [!] **S08-100 — v19 persistence/schema assumptions** — blocked on `#344/#339`; never query/reproduce guessed v19 schema.
- [!] **S08-101 — canonical FleetSnapshot adapter** — wait for final released structured contract.
- [!] **S08-102 — canonical Attention actions** — wait for final action/currentness representation.
- [!] **S08-103 — canonical SupervisorOrientation parser** — runtime behavior can align now; typed parsing waits for release contract.
- [!] **S08-104 — WorkerInput / WorkerWake UI** — do not rename old `send` into guessed v19 semantics.
- [!] **S08-105 — remove 0.6 compatibility** — only after minimum supported Hand version is intentionally raised.

---

## 7. Integration shape

Current transition:

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

Target:

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

Do not lock future API names or v19 data shapes before Hand publishes the stable contract.

---

## 8. UX invariants

1. Common-case UI remains understandable without exposing every canonical noun.
2. Exact semantics are available in detail/history views.
3. Presentation refresh performs no acknowledgement/mutation.
4. Worker/provider/report `done` is never silently promoted to lifecycle truth.
5. Exact/destructive actions fail stale instead of retargeting.
6. Supervisor reset/replacement loses zero canonical Fleet truth.
7. Provider topology does not become core navigation ontology.
8. Missing data on legacy Hand is shown as unavailable, not fabricated.
9. Locally-derived compatibility indicators must be labeled as such and never presented as canonical Hand Attention.

---

## 9. Next-update procedure

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
7. Presentation/Interaction UX changes.

---

## 10. Update log

### 2026-08-29 — Initial architecture alignment review

Reviewed `#339`, `#346`, `#347`, `#353` and creator clarification.

Decisions:

- Serenade formally targets Presentation + Interaction.
- Hand remains the sole workflow authority.
- Do not implement unfinished v19 persistence.
- Prepare versioned integration boundary.
- Move Supervisor toward `session start once → orient every turn`.
- Stop treating report/provider convenience states as lifecycle truth.
- Plan Task → Plan → Attempt and first-class Attention UI.

### 2026-08-29 — First implementation slice

- Frontend Hand compatibility classifier and `HandGateway` seam.
- Frontend fail-closed workflow mutation gating; **only verified 0.6 is mutation-enabled for now**.
- Settings/Diagnostics compatibility visibility and tests.
- Supervisor prompt stops consuming private fleet/project JSON as authoritative truth.
- Read-only per-turn Hand preflight plus explicit actual-Harness bootstrap/orient instructions.
- `InteractionGateway` splits reasoning-required prose from direct typed actions.
- Legacy adapter stops promoting provider `done` into Task review/Agent completion.

### 2026-08-29 — Rust gateway / fail-closed slice

- Added Rust Hand compatibility policy/tests and `HandLegacyGateway`.
- Added configured-cwd Hand execution while preserving `HAND_HOME`.
- Added process-boundary and Tauri command-entry mutation compatibility checks.
- Added pre-filesystem brief compatibility check.
- Supervisor preflight uses configured Hand binary/gateway and version-aware orientation fallback.

### 2026-08-29 — Supervisor Harness qualification seam

- Added `supervisorHarness` config, separate from Worker routes/profiles.
- Added qualified runtime adapter dispatch.
- OpenCode remains the only qualified/selectable adapter.
- Unqualified adapters fail closed before spawn.
- Settings/Diagnostics explain and expose the active Supervisor Harness.

### 2026-08-29 — Presentation + interaction consolidation

- Removed unused first-turn fleet/project JSON assembly from Tauri Supervisor chat.
- Removed duplicate active-Attempt `agent_state=done → completed` mapping.
- Added progressive TaskLineage domain projection; legacy exposes real Attempt facts and no fabricated Plan.
- Added Task → Plan → Attempt compact detail UI with provenance.
- Added provenance-aware Overview Attention shell using explicitly `legacy-derived` indicators until Hand canonical Attention is available.
- Added shared `useInteraction()` and routed Task workflow mutations/worktree cleanup through the exact-action path.

### 2026-08-29 — Post-alignment stabilization pass

- Created branch `chore/post-hand-alignment-stabilization`.
- Verified merged repository:
  - `npm install` succeeded.
  - `npm run typecheck` passed.
  - `npm run test` passed (27/27 frontend tests) after updating one stale OverviewPage assertion that expected pre-Attention-panel copy.
  - `npm run build` passed (production build, chunk-size warning only).
  - `cargo check` passed cleanly.
  - `cargo test` passed (15/15 Rust tests).
- Finished legacy read gateway refactor:
  - Routed `fleet_status`, `task_status`, `projects`, `config_document`, and `session_start_hint` through `HandLegacyGateway`.
  - `src-tauri/src/lib.rs` no longer directly spells legacy read CLI commands.
  - Preserved the TTL fleet-status cache and per-render process efficiency.
  - Removed the unused `assert_workflow_mutation_compatible` wrapper from `HandLegacyGateway`.
- Reviewed Supervisor bootstrap: no changes required. Runtime remains ephemeral, first-turn `session start` is a labeled 0.6 compatibility hint, and every turn is instructed to run `hand orient` (or legacy fallback). No private Fleet/project snapshot injection remains.
- Audited lifecycle semantics:
  - Consolidated `agents_list` active-Attempt status mapping to reuse `adapter::derive_agent_status`, removing duplicate `agent_state=done → completed` logic.
  - Added regression test: WorkerReport `done` on a running Attempt does not complete the Task.
  - Added regression test: legacy Task lineage does not synthesize a Plan.
- Interaction boundary audit: confirmed all workflow-changing hooks route through `InteractionGateway`; local-only `openWorktree` stays on `SerenadeApi`.
- Presentation safety: confirmed Task lineage and Attention UI remain explicitly legacy-derived and do not present canonical Hand state.
- Updated this roadmap.

Remaining transition debt:

- [x] General Rust read commands still parse Hand 0.6 shapes directly instead of going through `HandLegacyGateway`. **Resolved:** all Rust read commands now route through `HandLegacyGateway`; `lib.rs` no longer spells legacy read CLI commands.
- [~] Serenade still collects a first-turn `session start` hint outside the actual Supervisor runtime for 0.6 compatibility; validate whether it can be removed after live integration testing.
- [ ] Full Task detail still needs separately named report/provider/lifecycle facts.
- [ ] OpenCode is the only **qualified** Supervisor Harness; other Hand-capable Harnesses require separate runtime qualification before being exposed.
- [ ] Canonical FleetSnapshot, Attention, SupervisorOrientation, currentness-aware exact actions, WorkerInput, and WorkerWake remain blocked on released Hand 0.8 contracts.
- [ ] No repository CI workflow file is present in the working tree (a prior commit message references CI, but `.github/workflows/` is empty). Validation was run locally on this branch (see update log).

Next safe work before v19 lock:

1. [x] Move remaining legacy read parsing behind `HandLegacyGateway`. **Done.**
2. Expand full Task detail to separate report Claim, provider activity, and Attempt lifecycle.
3. [x] Add tests for legacy lineage and Attention derivation. **Done.**
4. Live-test the actual OpenCode Supervisor runtime contract against Hand 0.6, then later Hand 0.7 when released.

**Next upstream checkpoint:** Hand 0.7 release or material `#344/#339` lock/implementation change.
