# Serenade Quick Setup — Implementation Plan

> **Read first:** `quick-setup-design.md`, `quick-setup-architecture.md`, `hand-0.8-roadmap.md`.
>
> **Execution rule:** implement only verified current contracts. Do not guess Hand 0.8 setup/runtime behavior.

---

## Phase 0 — Repository verification

Before implementation:

1. Run current frontend and Rust validation.
2. Confirm current config/environment code paths.
3. Locate existing first-run/setup UI and Settings environment diagnostics.
4. Locate existing Hand compatibility classification and `HandRunner`/`HandLegacyGateway` usage.
5. Record baseline test counts/results in `quick-setup-tasks.md`.

Expected validation:

```text
npm ci
npm run typecheck
npm test
npm run build
cargo check --locked --manifest-path src-tauri/Cargo.toml
cargo test --locked --manifest-path src-tauri/Cargo.toml
```

Do not start feature work on top of unexplained failures.

---

## Phase 1 — Environment domain + inspector

### Goal

Create one reusable environment model used by both first-run setup and Settings.

### Backend

Add/refactor a read-only environment inspector that can report:

- platform/architecture;
- Git path/version/readiness;
- configured Hand path/version/compatibility/ownership;
- discovered system Hand candidate where appropriate;
- managed Hand candidate where appropriate;
- Fleet path validity;
- configured Supervisor Harness path/readiness;
- optional advanced diagnostics.

Do not perform installation in this phase.

### Frontend

Add typed environment status models and cards.

Required states:

```text
missing
installed
configuration-required
authentication-required
incompatible
unhealthy
ready
```

Required ownership:

```text
managed
system
custom
```

### Acceptance criteria

- Environment scan is read-only.
- Existing Serenade configuration still works.
- Hand 0.6.x remains qualified; newer/unknown versions remain fail-closed for mutation.
- Settings can display precise path/version/ownership/readiness.
- Tests cover precedence and compatibility.

---

## Phase 2 — First-run wizard shell

### Goal

Introduce resumable onboarding without automatic downloads yet.

Implement screens/states for:

1. Welcome.
2. Environment scan.
3. Quick setup vs existing environment.
4. Fleet location.
5. Setup plan preview.
6. Optional Supervisor setup.
7. First project.
8. Ready summary.

### Behavior

- If a valid configured Fleet/environment already exists, do not force the wizard.
- Allow the user to reopen setup/environment management later.
- Persist only UX completion state; derive actual readiness from scans.
- Support retry without restarting the wizard.

### Acceptance criteria

- User can complete an "existing environment" path entirely through UI.
- Missing dependencies show actionable states.
- Supervisor can be skipped.
- Wizard survives app restart without assuming stale readiness.

---

## Phase 3 — Fleet setup

### Goal

Allow the user to choose/adopt/initialize a Fleet without terminal commands.

### Backend

Add typed operations for:

- Fleet path validation;
- adopting an existing valid Fleet;
- initializing a new Fleet through canonical Hand setup/init command;
- post-init environment validation.

Reuse existing Hand runner/gateway patterns.

### Safety

- never create/edit Hand DB directly;
- never recursively clear a destination;
- reject/confirm unrelated non-empty destination directories;
- revalidate after initialization.

### Acceptance criteria

- Clean supported path can become a valid Fleet using UI only.
- Existing Fleet can be selected without reinitialization.
- Invalid path failures are actionable.
- Tests use temporary directories/fakes rather than real user state.

---

## Phase 4 — Managed Hand installer provider

### Goal

Install a Serenade-qualified Hand version under Serenade-owned application data.

### Mandatory research gate

Before coding download/install behavior, inspect official Secondhand release/bootstrap behavior and determine a verified, version-pinned installation strategy.

Do not invent asset URLs.

### Implementation

Add a Hand installer provider supporting:

- plan/install/validate lifecycle;
- platform/architecture selection;
- pinned qualified version;
- staging directory;
- HTTPS official source allow-list;
- integrity verification when upstream provides it;
- activation to managed tools directory;
- absolute path configuration;
- cleanup on failure;
- structured progress/errors.

If no safe verified automated source exists, mark this phase BLOCKED and keep the rest of Quick Setup usable with system/custom Hand.

### Acceptance criteria

- Installer never downloads arbitrary frontend-supplied URLs.
- Installer never installs unqualified latest Hand.
- Resulting binary is version-checked before becoming active.
- Failed install does not destroy a previous healthy managed version.
- No global PATH modification is required.

---

## Phase 5 — Setup coordinator + operation plan

### Goal

Turn individual capabilities into a deterministic Quick Setup plan.

Example plan:

```text
1. Reuse system Git
2. Install managed qualified Hand
3. Initialize Fleet at selected path
4. Validate Fleet
5. Detect/skip Supervisor
```

### Requirements

- Plan is visible before execution.
- Each step has state: pending/running/succeeded/failed/skipped.
- Retrying starts from actual environment state, not blindly from step 1.
- Every mutation is followed by validation.
- Long operations expose structured progress.

### Acceptance criteria

- Partial success is resumable.
- One failed optional step does not invalidate ready required capabilities.
- Required failure blocks Ready screen.

---

## Phase 6 — Supervisor setup

### Goal

Make current Serenade Supervisor readiness understandable and optionally manageable.

Current qualified Supervisor Harness: OpenCode.

### First implementation

- detect configured/custom/system OpenCode;
- report version/path/readiness;
- distinguish executable existence from authentication/config readiness when detectable;
- allow custom executable path;
- allow skip.

### Automatic install

Only add managed OpenCode installation after verifying an official safe versioned install contract using the same provider rules as Hand.

### Acceptance criteria

- Core Serenade remains usable with Supervisor skipped.
- Unqualified Supervisor Harness values fail closed.
- No secrets are persisted in normal Serenade config.

---

## Phase 7 — First project onboarding

### Goal

Register the first project from the wizard using Hand's canonical project registration contract.

### Requirements

- inspect current qualified Hand 0.6 project-add inputs;
- expose only supported forms;
- validate URL/path input;
- invoke through a typed Hand integration operation;
- refresh canonical project list afterward.

### Acceptance criteria

- Project registration requires no terminal for supported input form.
- Serenade does not create private project truth.
- Unsupported local/remote modes are hidden or explicitly marked unavailable.

---

## Phase 8 — Environment Manager

### Goal

Reuse the same environment model after onboarding.

Add **Settings → Environment** with:

- tool cards;
- ownership/path/version/readiness;
- validate/full scan;
- switch managed/system/custom source;
- reinstall/repair where provider supports it;
- Fleet location/health;
- Supervisor state;
- technical diagnostics.

### Acceptance criteria

- No duplicate setup-only dependency logic.
- First-run wizard and Environment Manager consume the same backend status model.
- Changing a tool source reruns validation immediately.

---

## Phase 9 — Repair flows

### Goal

Recover from common environment breakage without exposing raw terminal errors as the primary UX.

Candidate repair actions:

- managed binary missing → reinstall managed version;
- custom path missing → choose another executable;
- Fleet path moved → select/adopt Fleet;
- incompatible Hand → switch to qualified managed/system/custom version;
- optional Supervisor missing → reinstall/select/skip;
- Hand doctor/health failure → offer typed diagnostic/repair action only where current Hand provides a canonical operation.

Do not implement DB-level repair.

---

## Phase 10 — Documentation + packaging

Update README to split:

```text
End-user / packaged runtime requirements
Building from source
```

Document:

- Quick Setup behavior;
- managed tool directory;
- compatibility policy;
- privacy/security behavior;
- how to use an existing environment;
- how to reset/re-run setup;
- how to inspect logs.

Ensure packaged Tauri builds do not imply Node/Rust are runtime dependencies.

---

## Recommended implementation order

```text
P0 verification
 ↓
P1 environment model/scan
 ↓
P2 wizard shell
 ↓
P3 Fleet setup
 ↓
P4 managed Hand installer (or mark blocked)
 ↓
P5 coordinator/progress/resume
 ↓
P6 Supervisor setup
 ↓
P7 first project
 ↓
P8 Environment Manager
 ↓
P9 repair flows
 ↓
P10 docs/packaging
```

Phases 1–3 can proceed even if automatic Hand download is blocked.

---

## Definition of done for Windows MVP

The feature is ready when:

- clean packaged Serenade first launch opens setup;
- environment scan is accurate and read-only;
- user can select an existing environment OR Quick setup;
- user can choose Fleet location;
- Hand 0.6.x compatibility is enforced;
- a verified managed Hand installer works, or the product clearly falls back to system/custom Hand if that provider is blocked;
- Fleet init/adoption works through Hand;
- Supervisor is optional;
- first supported project can be registered from UI;
- setup is resumable/reopenable;
- Settings → Environment uses the same status model;
- no global PATH modification is necessary;
- no arbitrary shell/download endpoint exists;
- no Hand DB/schema manipulation exists;
- frontend/Rust test suites and CI pass;
- `quick-setup-tasks.md` is updated with actual results/blockers.
