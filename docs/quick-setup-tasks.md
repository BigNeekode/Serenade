# Serenade Quick Setup — OpenCode Execution Checklist

> Use this file as the live implementation tracker.  
> Read in order: `quick-setup-design.md` → `quick-setup-architecture.md` → `quick-setup-implementation-plan.md` → this file.

Legend:

```text
[ ] not started
[~] in progress
[x] complete
[!] blocked
```

---

## QS-000 — Baseline verification

- [ ] **QS-001** Run `npm ci`.
- [ ] **QS-002** Run `npm run typecheck`.
- [ ] **QS-003** Run `npm test`.
- [ ] **QS-004** Run `npm run build`.
- [ ] **QS-005** Run `cargo check --locked --manifest-path src-tauri/Cargo.toml`.
- [ ] **QS-006** Run `cargo test --locked --manifest-path src-tauri/Cargo.toml`.
- [ ] **QS-007** Record baseline results/test counts below before changing code.

### Baseline results

```text
Date:
Branch:
Frontend typecheck:
Frontend tests:
Frontend build:
Rust check:
Rust tests:
Notes:
```

Stop and diagnose unexplained baseline failures before continuing.

---

## QS-100 — Environment model and inspector

- [ ] **QS-101** Inspect existing config/environment/diagnostics models and avoid duplicating concepts unnecessarily.
- [ ] **QS-102** Add a reusable environment status model covering Git, Hand, Fleet, and Supervisor Harness.
- [ ] **QS-103** Add tool ownership states: `managed`, `system`, `custom`.
- [ ] **QS-104** Add readiness states: `missing`, `installing`, `installed`, `configuration-required`, `authentication-required`, `incompatible`, `unhealthy`, `ready`.
- [ ] **QS-105** Implement read-only platform/architecture detection.
- [ ] **QS-106** Implement Git executable discovery + version probe.
- [ ] **QS-107** Integrate configured Hand path into the environment scan.
- [ ] **QS-108** Discover system Hand candidate where appropriate.
- [ ] **QS-109** Discover Serenade-managed Hand candidate when present.
- [ ] **QS-110** Reuse existing Hand compatibility policy; do not add divergent version rules.
- [ ] **QS-111** Inspect Fleet path validity without mutating it.
- [ ] **QS-112** Inspect configured Supervisor Harness path/readiness.
- [ ] **QS-113** Add typed Tauri/API environment-scan operation.
- [ ] **QS-114** Add unit tests for ownership precedence and readiness derivation.
- [ ] **QS-115** Add tests that newer/unknown Hand remains fail-closed for mutations.

### Acceptance

- [ ] Environment scan performs zero mutations.
- [ ] Scan returns structured diagnostics instead of raw process errors where possible.
- [ ] Existing configured Serenade installs remain usable.

---

## QS-200 — First-run wizard shell

- [ ] **QS-201** Identify current first-run/setup routing and reuse it where practical.
- [ ] **QS-202** Add Welcome screen.
- [ ] **QS-203** Add Environment Check screen.
- [ ] **QS-204** Add Quick Setup vs Existing Environment choice.
- [ ] **QS-205** Add Fleet Location screen.
- [ ] **QS-206** Add setup-plan preview screen.
- [ ] **QS-207** Add Supervisor setup/skip screen.
- [ ] **QS-208** Add first-project screen shell.
- [ ] **QS-209** Add Ready summary screen.
- [ ] **QS-210** Persist only wizard UX progress/completion; do not persist environment truth as a boolean.
- [ ] **QS-211** On launch/reload, re-scan actual environment and resume appropriately.
- [ ] **QS-212** Add retry flow for failed setup steps.
- [ ] **QS-213** Add frontend tests for routing/resume/skip behavior.

---

## QS-300 — Fleet location and initialization

- [ ] **QS-301** Add Fleet destination validation.
- [ ] **QS-302** Detect an existing valid Fleet and offer adoption/reuse.
- [ ] **QS-303** Detect non-empty unrelated destination and require safe resolution.
- [ ] **QS-304** Add typed Fleet initialization operation through current qualified Hand contract.
- [ ] **QS-305** Reuse global/configured Hand runner patterns; do not add generic shell execution.
- [ ] **QS-306** Revalidate Fleet after initialization.
- [ ] **QS-307** Never create/edit `hand.db` directly.
- [ ] **QS-308** Add temporary-directory backend tests for path safety/init wrappers.

### Acceptance

- [ ] New Fleet can be initialized without terminal interaction when Hand is ready.
- [ ] Existing Fleet can be adopted without destructive rewrite.

---

## QS-400 — Managed Hand installation research gate

This phase has a mandatory upstream verification step.

- [ ] **QS-401** Inspect official `atqamz/hand` release/bootstrap installation contract.
- [ ] **QS-402** Determine whether a version-pinned Windows install source is available.
- [ ] **QS-403** Determine architecture mapping needed for supported Windows builds.
- [ ] **QS-404** Determine whether official checksums/signatures exist.
- [ ] **QS-405** Document the verified source/strategy below.

### Verified Hand installer source

```text
Upstream version:
Source type:
Official source:
Architecture mapping:
Integrity mechanism:
Version pinning mechanism:
Notes:
```

### Stop condition

If a safe version-pinned official installation mechanism cannot be verified:

- [ ] mark **QS-410** `[!] BLOCKED`;
- [ ] do not invent asset URLs/checksums;
- [ ] continue implementing Quick Setup using system/custom Hand paths.

---

## QS-410 — Managed Hand installer provider

- [ ] **QS-410** Implement managed Hand installer provider **only if QS-400 passes**.
- [ ] **QS-411** Use Serenade application-data managed tool root.
- [ ] **QS-412** Download only from backend allow-listed official source.
- [ ] **QS-413** Pin to Serenade-qualified Hand version/range.
- [ ] **QS-414** Download to staging/temp location.
- [ ] **QS-415** Enforce timeout/size/error handling.
- [ ] **QS-416** Verify upstream integrity metadata when available.
- [ ] **QS-417** Probe resulting binary/version before activation.
- [ ] **QS-418** Atomically activate/switch configured managed path where practical.
- [ ] **QS-419** Preserve previous healthy managed version on failed upgrade/reinstall.
- [ ] **QS-420** Clean partial downloads after failure.
- [ ] **QS-421** Do not modify global PATH.
- [ ] **QS-422** Add fake-provider/backend tests for staging/validation/failure behavior.

---

## QS-500 — Setup coordinator and progress

- [ ] **QS-501** Add setup-plan data model.
- [ ] **QS-502** Generate plan from current environment + user choices.
- [ ] **QS-503** Present plan before mutation.
- [ ] **QS-504** Execute approved steps sequentially/safely.
- [ ] **QS-505** Add step states: pending/running/succeeded/failed/skipped.
- [ ] **QS-506** Add structured progress events for long-running operations.
- [ ] **QS-507** Revalidate after every mutation.
- [ ] **QS-508** Resume from actual environment after failure/restart.
- [ ] **QS-509** Required capability failure blocks Ready screen.
- [ ] **QS-510** Optional Supervisor failure/skip does not block core Serenade readiness.
- [ ] **QS-511** Add coordinator state-transition tests.

---

## QS-600 — Supervisor environment setup

Current qualified Serenade Supervisor Harness: OpenCode.

- [ ] **QS-601** Detect configured OpenCode path.
- [ ] **QS-602** Detect system OpenCode where appropriate.
- [ ] **QS-603** Show ownership/path/version/readiness.
- [ ] **QS-604** Allow custom executable selection.
- [ ] **QS-605** Distinguish missing vs authentication/configuration required when reliably detectable.
- [ ] **QS-606** Allow Supervisor setup to be skipped.
- [ ] **QS-607** Preserve fail-closed behavior for unqualified Supervisor Harness values.
- [ ] **QS-608** Do not persist provider secrets in normal Serenade config.

### Optional managed OpenCode installer

- [ ] **QS-620** Research official versioned OpenCode installation source before implementing auto-install.
- [ ] **QS-621** Apply the same source/integrity/staging rules as managed Hand.
- [ ] **QS-622** Mark blocked instead of inventing unsupported installer behavior.

---

## QS-700 — First project onboarding

- [ ] **QS-701** Verify exact supported project registration inputs in qualified Hand 0.6.x.
- [ ] **QS-702** Expose only supported input modes in UI.
- [ ] **QS-703** Add typed project-registration operation to Serenade integration boundary if not already present.
- [ ] **QS-704** Validate user input before invoking Hand.
- [ ] **QS-705** Refresh Hand-owned project list after success.
- [ ] **QS-706** Do not create a Serenade-only project registry.
- [ ] **QS-707** Add success/error frontend tests.

---

## QS-800 — Settings → Environment

- [ ] **QS-801** Add/rework Environment section in Settings.
- [ ] **QS-802** Reuse the exact environment status model from first-run setup.
- [ ] **QS-803** Show Git details.
- [ ] **QS-804** Show Hand details + compatibility.
- [ ] **QS-805** Show Fleet path/health.
- [ ] **QS-806** Show Supervisor details.
- [ ] **QS-807** Add full rescan action.
- [ ] **QS-808** Add managed/system/custom source switching where supported.
- [ ] **QS-809** Add validate/reinstall/repair actions only when backend provider supports them.
- [ ] **QS-810** Ensure switching source immediately reruns compatibility/readiness checks.

---

## QS-900 — Repair flows

- [ ] **QS-901** Managed Hand missing → offer reinstall.
- [ ] **QS-902** Custom executable missing → choose another path.
- [ ] **QS-903** Incompatible Hand → choose/switch to a qualified source.
- [ ] **QS-904** Fleet moved/invalid → choose/adopt another Fleet.
- [ ] **QS-905** Supervisor missing → reinstall/select/skip.
- [ ] **QS-906** Add typed diagnostic/doctor action only if current Hand exposes a canonical safe command.
- [ ] **QS-907** Never implement DB-level "repair".
- [ ] **QS-908** Never claim repair success before revalidation passes.

---

## QS-1000 — Security review

- [ ] **QS-1001** Confirm there is no arbitrary shell Tauri endpoint.
- [ ] **QS-1002** Confirm frontend cannot supply arbitrary download URL.
- [ ] **QS-1003** Confirm managed install destinations are confined to Serenade-owned root.
- [ ] **QS-1004** Confirm Fleet setup never recursively deletes user directories.
- [ ] **QS-1005** Confirm global PATH is not modified by default.
- [ ] **QS-1006** Confirm unqualified Hand versions cannot perform legacy mutations.
- [ ] **QS-1007** Confirm system/custom binaries are never deleted by managed uninstall/reinstall.
- [ ] **QS-1008** Confirm logs do not intentionally persist tokens/secrets.
- [ ] **QS-1009** Confirm no direct Hand DB/schema writes exist.

---

## QS-1100 — Documentation and packaging

- [ ] **QS-1101** Split README End-user Requirements from Build-from-source Requirements.
- [ ] **QS-1102** Document Quick Setup.
- [ ] **QS-1103** Document managed tool storage location.
- [ ] **QS-1104** Document Hand compatibility/qualified-version policy.
- [ ] **QS-1105** Document existing-environment/custom-path flow.
- [ ] **QS-1106** Document how to rerun Environment setup/repair.
- [ ] **QS-1107** Ensure packaged app docs do not require Node/Rust for ordinary runtime.
- [ ] **QS-1108** Update `docs/tasks.md` if this feature should appear in the broader backlog.

---

## QS-1200 — Final validation

- [ ] **QS-1201** `npm ci` passes.
- [ ] **QS-1202** `npm run typecheck` passes.
- [ ] **QS-1203** `npm test` passes.
- [ ] **QS-1204** `npm run build` passes.
- [ ] **QS-1205** `cargo check --locked --manifest-path src-tauri/Cargo.toml` passes.
- [ ] **QS-1206** `cargo test --locked --manifest-path src-tauri/Cargo.toml` passes.
- [ ] **QS-1207** GitHub CI passes.
- [ ] **QS-1208** Manual Windows clean/setup scenario tested.
- [ ] **QS-1209** Existing Fleet/system Hand scenario tested.
- [ ] **QS-1210** Interrupted/resumed setup scenario tested.
- [ ] **QS-1211** Incompatible Hand scenario tested and mutations remain blocked.

### Final report

When the implementation pass is complete, record:

```text
Branch:
Commits:
Implemented phases:
Blocked phases:
Verified Hand installation strategy:
Managed tool locations:
Manual Windows scenarios tested:
Frontend validation:
Rust validation:
CI:
Known limitations:
Recommended next work:
```

---

## Current intentional blockers

Do not solve these by guessing:

- canonical Hand 0.8 setup/read/action contracts;
- canonical v19 persistence/schema;
- canonical Hand 0.8 Attention/SupervisorOrientation/WorkerWake;
- unverified automatic installers for Hand/OpenCode;
- unsupported project registration modes;
- hidden privilege escalation;
- insecure authentication/token storage.
