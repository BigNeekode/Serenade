# Serenade — Hand 0.8 Alignment Roadmap

> **Purpose:** living tracker for adapting Serenade to Secondhand / `hand` 0.8 without coupling the GUI to unfinished Hand internals.
>
> **Last reviewed:** 2026-08-29  
> **Implementation branch:** `feat/hand-0.8-alignment`  
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

**Branch progress:** private fleet/project JSON is no longer injected into the Supervisor prompt. Serenade performs a read-only preflight and the actual OpenCode Supervisor runtime is explicitly instructed to run its own `hand session start`/`hand orient` contract. The Tauri caller still computes unused legacy JSON and preflight currently assumes `hand` is on PATH.

### M02 — Lifecycle flattening

Legacy adapters collapse some provider/report signals into convenient statuses.

**Branch progress:** `adapter.rs` no longer turns `agent_state=done` into Task review or Agent completion, and terminal Task `done` now follows delivery/merge/Attempt lifecycle rather than a report claim. A duplicate per-attempt mapping still exists in `lib.rs`, so this remains partial.

### M03 — Backend coupled to Hand 0.6 shapes

Rust currently parses Hand 0.6 JSON/files directly.

**Branch progress:** a frontend `HandGateway` now centralizes compatibility policy and mutation gating. Rust still needs its own explicit legacy/future adapter boundary.

### M04 — Task-centric UI hides Plan/Attempt lineage

Current common UI is mostly Project → Task → Agent. Future detail/history should expose Task → Plan → Attempt progressively, without inventing unavailable legacy Plan state.

### M05 — Attention inferred locally

Current Overview uses local heuristics. Once Hand publishes canonical `Attention`, Serenade should render Hand's exact actionable projection/currentness rather than reconstructing a competing inbox.

---

## 5. Work we can do before v19 locks

### Architecture

- [~] **S08-001 — Versioned HandGateway boundary**
  - [x] Add `src/lib/hand/gateway.ts` outside React feature code.
  - [x] Centralize compatibility policy in `src/lib/hand/compatibility.ts`.
  - [x] Keep React features on Serenade domain/API contracts.
  - [ ] Put Rust reads/mutations behind `HandLegacyGateway` / future `HandV08Gateway` equivalents.
  - [ ] Remove direct Hand-shape knowledge from general Tauri command code over time.

- [~] **S08-002 — Compatibility/version negotiation**
  - [x] Reuse existing `hand --version` environment probe.
  - [x] Classify 0.6 / 0.7-transition / 0.8-unadapted / unknown.
  - [x] Show contract + mutation state in Settings/Diagnostics.
  - [x] Gate workflow mutations in `TauriSerenadeApi`.
  - [x] Add unit tests for version classification.
  - [ ] Enforce the same gate inside Rust mutation commands so raw `invoke(...)` cannot bypass policy.
  - [ ] Qualify Hand 0.7 after its actual release before enabling its mutations.

### Supervisor

- [~] **S08-010 — Align Supervisor runtime lifecycle**
  - [x] Preserve first-runtime bootstrap behavior.
  - [x] Best-effort preflight `hand orient` every turn; legacy 0.6 falls back to `hand session start`.
  - [x] Instruct the **actual Supervisor Harness runtime** to run `hand session start` once and `hand orient` every reasoning turn itself.
  - [x] Explicitly treat provider session IDs as ephemeral runtime mechanics.
  - [ ] Route preflight/bootstrap through configured `HandRunner` instead of hardcoded `hand` on PATH.
  - [ ] Verify actual runtime command execution with integration tests.
  - [ ] Cover autonomous wake/re-entry once Serenade has a qualified wake path.

- [~] **S08-011 — Remove private Supervisor Fleet truth**
  - [x] Ignore manually assembled fleet/project JSON in first-turn prompt.
  - [x] Fresh Hand context outranks remembered chat state.
  - [x] State that chat/session state is UX/runtime only.
  - [ ] Remove wasted fleet/project JSON assembly from `lib.rs` after Rust gateway refactor.

- [ ] **S08-012 — Provider-neutral Supervisor Harness**
  - Replace hardcoded OpenCode with explicit Supervisor Harness capability/config.
  - Keep Supervisor Harness config distinct from Worker Attempt routing.

### Interaction

- [~] **S08-020 — Explicit reasoning vs exact-action paths**
  - [x] Add `src/lib/interaction/gateway.ts`.
  - [x] `sendReasoningInput(...)` goes to Supervisor chat/runtime.
  - [x] Task approval uses direct typed `createTask(...)`; no extra LLM turn.
  - [x] SupervisorPage now uses this explicit split.
  - [ ] Migrate remaining feature mutations through the interaction gateway for one consistent entry point.
  - [ ] Replace legacy exact-action payloads with canonical Hand 0.8 action/currentness contracts when released.

- [ ] **S08-021 — Preserve exact identity/currentness**
  - Never retarget stale UI actions to "whatever is current now".
  - Keep future currentness witnesses opaque above Hand-owned services.
  - Surface stale-action failure and refresh instead of guessing.

### Domain / Presentation

- [~] **S08-030 — Stop flattening report/observation/lifecycle semantics**
  - [x] Legacy `derive_task_status` no longer promotes provider `done` into review/completion.
  - [x] Terminal Task completion follows delivery/merge/Attempt lifecycle rather than WorkerReport `done`.
  - [x] Legacy `derive_agent_status` maps `agent_state=done` to waiting while Attempt remains running.
  - [ ] Remove equivalent duplicate `agent_state=done → completed` mapping in `lib.rs` during Rust gateway refactor.
  - [ ] Expose separate activity/report/lifecycle facts in detail UI instead of one overloaded status field.

- [ ] **S08-031 — Task → Plan → Attempt progressive disclosure**
  - Compact default cards.
  - Exact lineage in detail/history.
  - Legacy adapter shows unavailable Plan data as unavailable, never guessed.

- [ ] **S08-032 — First-class Attention surface**
  - priority/class
  - reason/code
  - exact subject
  - available actions
  - source becomes Hand `Attention` once released.

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
SerenadeApi
      ↓
InteractionGateway (reasoning vs exact action)
      ↓
TauriSerenadeApi
      ↓
HandGateway (version policy / fail-closed mutation guard)
      ↓
legacy Rust Hand integration
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

Branch: `feat/hand-0.8-alignment`

Implemented:

- Hand compatibility classifier and `HandGateway` seam.
- Fail-closed workflow mutation gating; **only verified 0.6 is mutation-enabled for now**.
- Settings/Diagnostics compatibility visibility.
- Compatibility unit tests.
- Supervisor prompt no longer consumes private fleet/project JSON as authoritative truth.
- Read-only per-turn Hand preflight plus explicit actual-Harness bootstrap/orient instructions.
- Explicit `InteractionGateway` splitting reasoning-required prose from direct typed actions.
- Supervisor task approval remains an exact direct action with no extra LLM turn.
- Legacy adapter no longer promotes `agent_state=done` into Task review/Agent completion; terminal completion uses stronger lifecycle/delivery facts.

Known debt:

- Rust commands can still bypass the frontend compatibility gate.
- Rust integration is still structurally Hand-0.6-shaped.
- Supervisor preflight uses `hand` from PATH and Tauri still computes now-unused legacy JSON.
- OpenCode remains hardcoded as Supervisor Harness.
- `lib.rs` still has a duplicate per-attempt `agent_state=done → completed` mapping.
- No runtime CI/build verification was available from this environment; run `npm run typecheck`, `npm test`, and `cargo test` before merge.

Next implementation candidates before v19 lock:

1. Rust-side compatibility guard + legacy gateway wrapper.
2. Move Supervisor reads through configured `HandRunner` and delete unused JSON assembly.
3. Migrate remaining exact mutation call sites through `InteractionGateway`.
4. Remove remaining lifecycle/report/provider flattening.
5. Add progressive Task → Plan → Attempt presentation scaffolding with explicit unavailable legacy fields.

**Next upstream checkpoint:** Hand 0.7 release or material `#344/#339` lock/implementation change.
