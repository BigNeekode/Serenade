# Serenade — Hand 0.8 Alignment Roadmap

> **Purpose:** Track Serenade's adaptation to Secondhand / `hand` 0.8 without coupling the GUI to unfinished Hand internals.
>
> **Last reviewed:** 2026-08-29
> **Current Serenade baseline:** real Hand 0.6.0 integration
> **Hand 0.8 status:** architecture/spec work in progress; do not implement unfinished v19 persistence details in Serenade.

---

## 1. Direction

Serenade should become the **Presentation + Interaction layer** above Hand rather than a second orchestration/control plane.

Target topology:

```text
Operator
  ↓
Serenade Presentation
  ↓
Serenade Interaction
  ├─ reasoning-required input → Supervisor Harness / supervisor runtime ─┐
  └─ exact typed operator action ────────────────────────────────────────┤
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

Core rule:

```text
Serenade presentation state ≠ workflow truth
Serenade chat history       ≠ workflow truth
Supervisor session ID       ≠ workflow truth
Worker report claim         ≠ lifecycle completion

Hand canonical state + exact external evidence + Hand currentness validation
= workflow truth
```

Serenade may persist UI preferences, selected views, panel state, cached display data, and chat transcript for UX. None of those may authorize or redefine Hand workflow state.

---

## 2. Hand architecture sources to follow

Primary upstream tracking issues:

- `atqamz/hand#339` — canonical v19 implementation umbrella and Fleet → Project → Task → Plan → Attempt hierarchy.
- `atqamz/hand#344` — exact replacement v19 schema lock. **Do not code Serenade against guessed v19 persistence before this is locked.**
- `atqamz/hand#346` — capability/adapter boundaries, WorkerInput/WorkerWake, native Git worktree and Harness role separation.
- `atqamz/hand#347` — FleetSnapshot, Attention, SupervisorOrientation and read-model contract.
- `atqamz/hand#353` — Supervisor runtime lifecycle: `hand session start` once per runtime, `hand orient` every reasoning turn.
- `atqamz/hand#355` — concrete Supervisor host/wake qualification matrix.

### Current upstream facts

As of this review:

1. Hand's durable hierarchy is moving to:

   ```text
   Fleet → Project → Task → Plan → Attempt
   ```

2. Presentation owns **no durable workflow truth**.
3. Interaction has two paths:
   - reasoning-required input → Supervisor Harness;
   - already-exact typed operator action → canonical Hand service directly.
4. Supervisor Harness and Worker Harness are distinct semantic roles even if the same executable can provide both.
5. Supervisor runtime/session is ephemeral and is not a canonical Fleet workflow entity.
6. `hand session start` is runtime bootstrap only; `hand orient` reconstructs fresh current Supervisor truth every reasoning/wake turn.
7. `FleetSnapshot`, `Attention`, and `SupervisorOrientation` are intended as bounded Hand-owned projections for presentation/supervision.
8. WorkerReport state such as `done` is a Worker **claim**, not proof that Attempt/Plan/Task lifecycle has completed.
9. Fresh v19 execution replaces Treehouse with native Git `WorktreeBinding`.
10. Herdr/session/provider mechanics belong below Serenade. Serenade should display provider information but not own provider topology.
11. `#339` is currently blocked on the exact `#344` schema relock. Serenade must not build a private approximation of the v19 schema/read model while upstream is still changing.

---

## 3. Current Serenade mismatch inventory

These are not necessarily bugs against Hand 0.6; they are areas that must change before Serenade can cleanly target the 0.8 contract.

### S08-M01 — Supervisor context is manually assembled

Current Serenade Supervisor builds its own first-turn context from:

```text
hand session start
+ hand status / fleet JSON
+ project JSON
+ Serenade prompt protocol
+ provider conversation history
```

The 0.8 direction is instead:

```text
new Supervisor runtime
→ hand session start once

every reasoning turn
→ hand orient
→ fresh SupervisorOrientation
→ reason
```

**Required change:** chat history remains UX context only; fresh Hand orientation becomes authoritative Fleet context every reasoning turn.

### S08-M02 — Serenade derives/normalizes lifecycle-like UI state

Current adapters sometimes flatten Hand observations/report states into convenient UI statuses.

The 0.8 model keeps these separate:

```text
WorkerReport Claim
!= provider/executor Observation
!= WorkerInput acknowledgement
!= Attempt lifecycle
!= Task/Plan completion
```

**Required change:** render the separate facts and derive display labels only as non-authoritative presentation, never as canonical state.

### S08-M03 — Backend is coupled to Hand 0.6 shapes/layout

Current Rust integration knows Hand-specific JSON/file conventions and maps them directly to Serenade domain objects.

**Required change:** introduce an explicit versioned Hand integration boundary so 0.8 can replace the adapter without rebuilding the React application.

### S08-M04 — Task-centric UI hides future Plan/Attempt lineage

Current daily UI is mostly Project → Task → Agent.

**Required change:** evolve detail/history views toward Task → Plan → Attempt, using progressive disclosure so the normal UI remains readable.

### S08-M05 — Attention is currently inferred by Serenade UI logic

**Required change:** when Hand exposes canonical `Attention`, prefer Hand's exact Attention/currentness projection over local heuristics such as guessed stale/failed/review states.

---

## 4. Work we should do now

These tasks are intentionally limited to boundaries and UX architecture that remain useful even if Hand 0.8 internals change.

### Architecture

- [ ] **S08-001 — Introduce a versioned `HandGateway` boundary**
  - Keep React dependent on Serenade domain/API contracts, not Hand CLI syntax.
  - Keep the existing 0.6/0.7 adapter working.
  - Reserve a separate 0.8 adapter implementation.
  - Do not expose Hand's SQLite schema directly to the frontend.

- [ ] **S08-002 — Add Hand compatibility/version negotiation**
  - Probe `hand --version` at startup.
  - Represent supported / compatibility-warning / unsupported modes.
  - Gate unsafe mutations when the Hand contract is unknown.
  - Keep read-only diagnostics available where safe.

### Supervisor

- [ ] **S08-010 — Align Supervisor lifecycle with Hand**
  - `hand session start` once for a new actual Supervisor runtime.
  - `hand orient` before every reasoning turn.
  - `hand orient` again after autonomous wake/re-entry before reasoning/action.
  - Treat provider session/conversation IDs as ephemeral runtime mechanics only.

- [ ] **S08-011 — Stop constructing private Fleet truth for the Supervisor**
  - Remove dependence on manually concatenated `hand status`/project state as authoritative reasoning context once `SupervisorOrientation` is available.
  - Keep bounded prompt/UI history only for conversational convenience.
  - A reset/restart of the Supervisor must lose zero canonical Fleet truth.

- [ ] **S08-012 — Make Supervisor Harness configurable/provider-neutral**
  - Do not permanently bind the Serenade Supervisor feature to OpenCode.
  - Model the supervisor provider as a Harness capability.
  - Do not confuse Supervisor Harness configuration with Worker Attempt routing.

### Interaction

- [ ] **S08-020 — Split interaction into two explicit paths**
  - `sendReasoningInput(...)` for requests requiring Supervisor judgment.
  - typed exact actions for operations that Hand already defines precisely.
  - Exact actions must not burn an LLM turn merely to translate a button click.

- [ ] **S08-021 — Preserve exact identities/currentness on actions**
  - Never retarget stale UI input to "whatever is current now".
  - Treat currentness witnesses/tokens as opaque above the Hand-owned service.
  - Surface stale-action errors explicitly and refresh.

### Domain / Presentation

- [ ] **S08-030 — Stop flattening report/observation/lifecycle semantics**
  - Worker `done` remains a claim unless Hand separately reports lifecycle/integration completion.
  - Keep executor health, report state, lifecycle, and review/actionability distinct.

- [ ] **S08-031 — Add Task → Plan → Attempt progressive-disclosure UX design**
  - Default cards remain compact.
  - Detail/history views expose exact lineage.
  - Do not invent Plan state in the 0.6 adapter; mark unavailable fields as unavailable.

- [ ] **S08-032 — Design Attention as a first-class Overview surface**
  - priority
  - reason/code
  - exact subject
  - available actions
  - safety/decision/progression/retry/cleanup classes
  - source will be Hand `Attention` when available.

### Provider / worktree abstraction

- [ ] **S08-040 — Remove Treehouse assumptions from Serenade domain vocabulary**
  - Treat a worktree as a Hand-owned resource/binding projection.
  - Treehouse details may exist only in the legacy adapter/diagnostics.

- [ ] **S08-041 — Keep Session/Executor/provider mechanics informational**
  - Serenade must not implement Herdr, tmux, or other session-provider lifecycle itself.
  - Display provider/session/executor metadata supplied by Hand.

---

## 5. Work intentionally blocked until Hand 0.8 stabilizes

- [!] **S08-100 — Implement v19 persistence/schema assumptions**
  - Blocked on upstream `#344` lock and `#339` implementation.
  - Serenade must not query or reproduce the v19 DB schema directly.

- [!] **S08-101 — Implement canonical FleetSnapshot parser/adapter**
  - Wait for the final released structured contract.

- [!] **S08-102 — Implement canonical Attention adapter/actions**
  - Wait for Hand's final action/currentness representation.

- [!] **S08-103 — Implement canonical SupervisorOrientation adapter**
  - We can align runtime behavior now, but final structured model parsing waits for the released contract.

- [!] **S08-104 — Implement WorkerInput / WorkerWake UI semantics**
  - Do not map old `send` semantics onto guessed v19 concepts.
  - Wait for final Hand commands/read models.

- [!] **S08-105 — Remove the 0.6/0.7 compatibility adapter**
  - Keep it until Serenade's minimum supported Hand version is intentionally raised.

---

## 6. Proposed Serenade integration shape

Conceptual only; names may change during implementation.

```text
React features
      ↓
SerenadeApi
      ↓
Serenade domain/read models
      ↓
HandGateway
   ├─ HandLegacyGateway     // 0.6 / 0.7 compatibility
   └─ HandV08Gateway        // future canonical projections/actions
      ↓
hand
```

Possible capability-oriented API direction:

```text
Queries
- getFleetSnapshot()
- getAttention()
- getTaskHistory()
- getSupervisorOrientation()

Interaction
- sendReasoningInput(...)
- executeExactAction(...)
```

Do **not** lock these function names until Hand 0.8's public contract is stable. The important decision is the separation of responsibilities.

---

## 7. UX invariants for the 0.8 migration

1. The user can still understand the common case without seeing every canonical noun.
2. Exact semantics are available in detail/history views.
3. Presentation refresh performs no acknowledgement or mutation.
4. A Worker report is rendered as a report/claim, not silently promoted to lifecycle truth.
5. Destructive/exact actions display stale/currentness failures instead of retargeting.
6. Supervisor restart/reset never implies Task/Plan/Attempt reset.
7. Provider-specific topology must not leak into core navigation concepts.
8. Missing 0.8 data in a legacy Hand version is shown as unavailable, not guessed.

---

## 8. Next-update procedure

When the Secondhand creator sends another architecture/release update, review this file first and update it rather than creating a new disconnected plan.

### Check upstream

Review at minimum:

```text
hand release/version
#339 implementation status
#344 schema lock status
#346 capability boundaries
#347 read-model / Attention / SupervisorOrientation contract
#353 Supervisor lifecycle contract
#355 Supervisor host support matrix
```

Then record:

1. what upstream changed;
2. whether any Serenade assumption became invalid;
3. which blocked `S08-*` tasks can be unblocked;
4. whether legacy compatibility still matters;
5. any new exact public command/read-model contracts;
6. changes needed to Supervisor behavior;
7. changes needed to Presentation/Interaction UX.

### Update log

Append one entry below for every meaningful upstream review.

---

## 9. Update log

### 2026-08-29 — Initial 0.8 architecture alignment review

**Upstream reviewed:** `#339`, `#346`, `#347`, `#353`, creator architecture clarification.

**Decision:**

- Serenade formally targets the Presentation + Interaction role.
- Do not rewrite against unfinished v19 persistence.
- Preserve Hand as the only workflow authority.
- Prepare a versioned Hand integration boundary.
- Align Supervisor with `session start once → orient every reasoning turn`.
- Stop treating Worker report/agent-state convenience mappings as canonical lifecycle truth.
- Plan Task → Plan → Attempt progressive-disclosure UI.
- Plan first-class Attention UI.
- Keep Herdr/Treehouse/session-provider mechanics below Serenade.

**Next checkpoint:** re-review when Hand 0.7 releases or when `#344/#339` materially changes/locks.
