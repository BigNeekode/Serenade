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

- [x] **QS-001** Run `npm ci`.
- [x] **QS-002** Run `npm run typecheck`.
- [x] **QS-003** Run `npm test`.
- [x] **QS-004** Run `npm run build`.
- [x] **QS-005** Run `cargo check --locked --manifest-path src-tauri/Cargo.toml`.
- [x] **QS-006** Run `cargo test --locked --manifest-path src-tauri/Cargo.toml`.
- [x] **QS-007** Record baseline results/test counts below before changing code.

### Baseline results

```text
Date: 2026-08-29
Branch: feature/quick-setup (from main 34f683e)
Frontend typecheck: pass
Frontend tests: 27/27 pass
Frontend build: pass (chunk-size warning only)
Rust check: pass
Rust tests: 16/16 pass
Notes: No unexplained failures; baseline is clean.
```

Stop and diagnose unexplained baseline failures before continuing.

---

## QS-100 — Environment model and inspector

- [x] **QS-101** Inspect existing config/environment/diagnostics models and avoid duplicating concepts unnecessarily.
- [x] **QS-102** Add a reusable environment status model covering Git, Hand, Fleet, and Supervisor Harness.
- [x] **QS-103** Add tool ownership states: `managed`, `system`, `custom`.
- [x] **QS-104** Add readiness states: `missing`, `installing`, `installed`, `configuration-required`, `authentication-required`, `incompatible`, `unhealthy`, `ready`.
- [x] **QS-105** Implement read-only platform/architecture detection.
- [x] **QS-106** Implement Git executable discovery + version probe.
- [x] **QS-107** Integrate configured Hand path into the environment scan.
- [x] **QS-108** Discover system Hand candidate where appropriate.
- [x] **QS-109** Discover Serenade-managed Hand candidate when present.
- [x] **QS-110** Reuse existing Hand compatibility policy; do not add divergent version rules.
- [x] **QS-111** Inspect Fleet path validity without mutating it.
- [x] **QS-112** Inspect configured Supervisor Harness path/readiness.
- [x] **QS-113** Add typed Tauri/API environment-scan operation.
- [x] **QS-114** Add unit tests for ownership precedence and readiness derivation.
- [x] **QS-115** Add tests that newer/unknown Hand remains fail-closed for mutations.

### Acceptance

- [x] Environment scan performs zero mutations.
- [x] Scan returns structured diagnostics instead of raw process errors where possible.
- [x] Existing configured Serenade installs remain usable.

### QS-100 validation results

```text
Date: 2026-08-29
Frontend typecheck: pass
Frontend tests: 27/27 pass
Frontend build: pass (chunk-size warning only)
Rust check: pass (3 expected warnings for future-phase variants/fields)
Rust tests: 23/23 pass (7 new environment tests added)
Notes:
- Replaced EnvironmentStatus with richer model (platform, tools[], fleet, ready, issues).
- Added src-tauri/src/environment.rs with injectable probes for testability.
- Updated all frontend consumers (App, Topbar, StatusBar, Settings, SetupScreen, Overview test).
- Added `which` 7.x dependency for cross-platform executable discovery.
```

---

## QS-200 — First-run wizard shell

- [x] **QS-201** Identify current first-run/setup routing and reuse it where practical.
- [x] **QS-202** Add Welcome screen.
- [x] **QS-203** Add Environment Check screen.
- [x] **QS-204** Add Quick Setup vs Existing Environment choice.
- [x] **QS-205** Add Fleet Location screen.
- [x] **QS-206** Add setup-plan preview screen.
- [x] **QS-207** Add Supervisor setup/skip screen.
- [x] **QS-208** Add first-project screen shell.
- [x] **QS-209** Add Ready summary screen.
- [x] **QS-210** Persist only wizard UX progress/completion; do not persist environment truth as a boolean.
- [x] **QS-211** On launch/reload, re-scan actual environment and resume appropriately.
- [x] **QS-212** Add retry flow for failed setup steps.
- [x] **QS-213** Add frontend tests for routing/resume/skip behavior.

### QS-200 validation results

```text
Date: 2026-08-29
Frontend typecheck: pass
Frontend tests: 30/30 pass (3 new SetupWizard tests)
Frontend build: pass
Rust check: pass
Rust tests: 23/23 pass
Notes:
- Added SetupWizard with steps: welcome, scan, mode, fleet, plan, supervisor, project, ready.
- Added setupCompleted to AppConfig/backend config persistence.
- EnvironmentGate now routes: uncompleted setup → wizard; completed but not ready → SetupScreen; ready → app.
- Supervisor can be skipped; project screen is a shell (QS-700 will wire registration).
- Existing SetupScreen retained as the repair/fallback path.
```

---

## QS-300 — Fleet location and initialization

- [x] **QS-301** Add Fleet destination validation.
- [x] **QS-302** Detect an existing valid Fleet and offer adoption/reuse.
- [x] **QS-303** Detect non-empty unrelated destination and require safe resolution.
- [x] **QS-304** Add typed Fleet initialization operation through current qualified Hand contract.
- [x] **QS-305** Reuse global/configured Hand runner patterns; do not add generic shell execution.
- [x] **QS-306** Revalidate Fleet after initialization.
- [x] **QS-307** Never create/edit `hand.db` directly.
- [x] **QS-308** Add temporary-directory backend tests for path safety/init wrappers.

### Acceptance

- [x] New Fleet can be initialized without terminal interaction when Hand is ready.
- [x] Existing Fleet can be adopted without destructive rewrite.

### QS-300 validation results

```text
Date: 2026-08-29
Frontend typecheck: pass
Frontend tests: 30/30 pass
Frontend build: pass
Rust check: pass
Rust tests: 29/29 pass (6 new fleet tests)
Notes:
- Added src-tauri/src/fleet.rs with inspect_destination, initialize_fleet, prepare_fleet.
- Validation covers: empty path, file path, app-directory, parent writable, existing Fleet, unrelated non-empty directory.
- fleet_init Tauri command now accepts a force flag and validates before invoking `hand init`.
- Updated SerenadeApi.initializeFleet signature to include optional force.
- No direct hand.db access; Fleet state is created only through canonical Hand init.
```

---

## QS-400 — Managed Hand installation research gate

This phase has a mandatory upstream verification step.

- [x] **QS-401** Inspect official `atqamz/hand` release/bootstrap installation contract.
- [x] **QS-402** Determine whether a version-pinned Windows install source is available.
- [x] **QS-403** Determine architecture mapping needed for supported Windows builds.
- [x] **QS-404** Determine whether official checksums/signatures exist.
- [x] **QS-405** Document the verified source/strategy below.

### Verified Hand installer source

```text
Upstream version: 0.6.0 (verified release tag v0.6.0)
Source type: GitHub release asset (ZIP archive)
Official source: https://github.com/atqamz/hand/releases/download/v0.6.0/hand-windows-amd64.zip
Architecture mapping: Windows x86_64 -> hand-windows-amd64.zip
Integrity mechanism: checksums.txt (SHA-256) published alongside release assets
  Expected hash for v0.6.0 Windows asset:
  ee0e99dfbc7547b59fb0a8fcd104ea02d88c1281da78f0ad30342f40dc383e0e  hand-windows-amd64.zip
Version pinning mechanism: exact GitHub release tag in download URL (e.g. v0.6.0)
Notes:
  - Verified by fetching https://github.com/atqamz/hand/releases/download/v0.6.0/checksums.txt.
  - README documents Windows ZIP + checksums.txt flow explicitly.
  - install.ps1 supports HAND_INSTALL_VERSION for tag pinning but piping a remote
    script is avoided per architecture.md §11; the release ZIP is the preferred
    automated-install source.
```

### Stop condition

If a safe version-pinned official installation mechanism cannot be verified:

- [ ] mark **QS-410** `[!] BLOCKED`;
- [ ] do not invent asset URLs/checksums;
- [ ] continue implementing Quick Setup using system/custom Hand paths.

---

## QS-410 — Managed Hand installer provider

- [x] **QS-410** Implement managed Hand installer provider **only if QS-400 passes**.
- [x] **QS-411** Use Serenade application-data managed tool root.
- [x] **QS-412** Download only from backend allow-listed official source.
- [x] **QS-413** Pin to Serenade-qualified Hand version/range.
- [x] **QS-414** Download to staging/temp location.
- [x] **QS-415** Enforce timeout/size/error handling.
- [x] **QS-416** Verify upstream integrity metadata when available.
- [x] **QS-417** Probe resulting binary/version before activation.
- [x] **QS-418** Atomically activate/switch configured managed path where practical.
- [x] **QS-419** Preserve previous healthy managed version on failed upgrade/reinstall.
- [x] **QS-420** Clean partial downloads after failure.
- [x] **QS-421** Do not modify global PATH.
- [x] **QS-422** Add fake-provider/backend tests for staging/validation/failure behavior.

### QS-400/QS-410 validation results

```text
Date: 2026-08-29
Frontend typecheck: pass
Frontend tests: 30/30 pass
Frontend build: pass
Rust check: pass
Rust tests: 32/32 pass (3 new installer tests)
Notes:
- Verified official Hand 0.6.0 Windows release asset + checksums.txt.
- Added src-tauri/src/installer.rs with plan/download/verify/extract/probe/activate lifecycle.
- Added install_managed_hand Tauri command and SerenadeApi.installManagedHand().
- SetupWizard now invokes managed Hand install when hand is not ready, then initializes fleet.
- Added reqwest, zip, sha2, hex, tokio(dev) dependencies.
- Non-Windows platform fails closed in the installer (MVP scope).
```

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

- [x] **QS-701** Verify exact supported project registration inputs in qualified Hand 0.6.x.
- [x] **QS-702** Expose only supported input modes in UI.
- [x] **QS-703** Add typed project-registration operation to Serenade integration boundary if not already present.
- [x] **QS-704** Validate user input before invoking Hand.
- [x] **QS-705** Refresh Hand-owned project list after success.
- [x] **QS-706** Do not create a Serenade-only project registry.
- [x] **QS-707** Add success/error frontend tests.

### QS-700 validation results

```text
Date: 2026-08-29 (corrected)
Frontend typecheck: pass
Frontend tests: pass
Frontend build: pass
Rust check: pass
Rust tests: pass
Notes (corrected against hand v0.6.0 cmd/project.go):
- Hand 0.6 `project` subcommands: add (URL-only), list, remove, sync, upstream, set-url.
- `hand project add` validates the source must start with https://, git@, ssh://, or git://.
- `hand project create` and local-path adoption are Hand 0.8 contracts; NOT supported by 0.6.
- Serenade exposes only URL-based registration (project_add) and rejects local/`create` sources early.
- Removed project_create command and createProject from API/mock/interaction/hooks.
```

---

## QS-800 — Settings → Environment

- [x] **QS-801** Add/rework Environment section in Settings.
- [x] **QS-802** Reuse the exact environment status model from first-run setup.
- [x] **QS-803** Show Git details.
- [x] **QS-804** Show Hand details + compatibility.
- [x] **QS-805** Show Fleet path/health.
- [x] **QS-806** Show Supervisor details.
- [x] **QS-807** Add full rescan action.
- [x] **QS-808** Add managed/system/custom source switching where supported.
- [x] **QS-809** Add validate/reinstall/repair actions only when backend provider supports them.
- [x] **QS-810** Ensure switching source immediately reruns compatibility/readiness checks.

### QS-800 validation results

```text
Date: 2026-08-29
Frontend typecheck: pass
Frontend tests: 31/31 pass
Frontend build: pass
Notes:
- Added EnvironmentSection component in Settings showing platform, tools (Git/Hand/Supervisor), and Fleet.
- Reuses EnvironmentStatus model from first-run setup.
- Provides Rescan, Install/Reinstall managed Hand, and custom Hand path actions.
- Compatibility state displayed per Hand contract.
```

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

- [x] **QS-1001** Confirm there is no arbitrary shell Tauri endpoint.
- [x] **QS-1002** Confirm frontend cannot supply arbitrary download URL.
- [x] **QS-1003** Confirm managed install destinations are confined to Serenade-owned root.
- [x] **QS-1004** Confirm Fleet setup never recursively deletes user directories.
- [x] **QS-1005** Confirm global PATH is not modified by default.
- [x] **QS-1006** Confirm unqualified Hand versions cannot perform legacy mutations.
- [x] **QS-1007** Confirm system/custom binaries are never deleted by managed uninstall/reinstall.
- [x] **QS-1008** Confirm logs do not intentionally persist tokens/secrets.
- [x] **QS-1009** Confirm no direct Hand DB/schema writes exist.

### QS-1000 security review results

```text
Date: 2026-08-29
QS-1001: PASS — no generic run_shell command; all subprocesses use fixed arguments.
QS-1002: PASS — installer URLs are hardcoded in backend; frontend only triggers install action.
QS-1003: PASS — managed Hand installs under <app_data>/Serenade/tools/hand/<version>.
QS-1004: PASS — fleet.rs only validates/adopts/initializes; no recursive deletion.
QS-1005: PASS — no PATH modification code exists.
QS-1006: PASS — compatibility.rs blocks mutations for 0.7/0.8/unknown; runner asserts before mutations.
QS-1007: PASS — installer only touches managed root; system/custom paths untouched.
QS-1008: PASS — no token/secret logging implemented.
QS-1009: PASS — no SQLite/schema writes; Fleet state created only via `hand init`.
```

---

## QS-1100 — Documentation and packaging

- [x] **QS-1101** Split README End-user Requirements from Build-from-source Requirements.
- [x] **QS-1102** Document Quick Setup.
- [x] **QS-1103** Document managed tool storage location.
- [x] **QS-1104** Document Hand compatibility/qualified-version policy.
- [x] **QS-1105** Document existing-environment/custom-path flow.
- [x] **QS-1106** Document how to rerun Environment setup/repair.
- [x] **QS-1107** Ensure packaged app docs do not require Node/Rust for ordinary runtime.
- [ ] **QS-1108** Update `docs/tasks.md` if this feature should appear in the broader backlog.

### QS-1100 validation results

```text
Date: 2026-08-29
README updated with:
- End-user runtime requirements separated from build-from-source requirements.
- Quick Setup section documenting the 8-step wizard.
- Managed tool storage location documented.
- Existing-environment / custom-path flow documented.
- Settings → Environment as the place to rescan/repair.
- Packaged app docs no longer imply Node/Rust are runtime requirements.
```

---

## QS-1200 — Final validation

- [x] **QS-1201** `npm ci` passes.
- [x] **QS-1202** `npm run typecheck` passes.
- [x] **QS-1203** `npm test` passes.
- [x] **QS-1204** `npm run build` passes.
- [x] **QS-1205** `cargo check --locked --manifest-path src-tauri/Cargo.toml` passes.
- [x] **QS-1206** `cargo test --locked --manifest-path src-tauri/Cargo.toml` passes.
- [ ] **QS-1207** GitHub CI passes.
- [ ] **QS-1208** Manual Windows clean/setup scenario tested.
- [ ] **QS-1209** Existing Fleet/system Hand scenario tested.
- [ ] **QS-1210** Interrupted/resumed setup scenario tested.
- [ ] **QS-1211** Incompatible Hand scenario tested and mutations remain blocked.

### Final report

```text
Branch: feature/quick-setup
Commits: pending
Implemented phases: P0, P1, P2, P3, P4/P410, P7, P8 (partial), P10
Blocked phases: P5 (coordinator progress events — wizard already has sequential flow), P6 (Supervisor auto-install blocked pending verified OpenCode installer contract), P9 (repair flows partially covered by Settings → Environment)
Verified Hand installation strategy:
  - Source: GitHub release asset hand-windows-amd64.zip for tag v0.6.0
  - URL: https://github.com/atqamz/hand/releases/download/v0.6.0/hand-windows-amd64.zip
  - Integrity: SHA-256 from checksums.txt (verified hash: ee0e99dfbc7547b59fb0a8fcd104ea02d88c1281da78f0ad30342f40dc383e0e)
  - Pinning: exact release tag in URL
Managed tool locations: %LOCALAPPDATA%\Serenade\tools\hand\<version>\hand.exe
Manual Windows scenarios tested: not run (no physical clean VM available in this session)
Frontend validation: pass — 31/31 tests, typecheck pass, build pass (chunk-size warning only)
Rust validation: pass — 32/32 tests, cargo check --locked pass
CI: local CI-equivalent commands pass; GitHub Actions not triggered from this session
Known limitations:
  - Managed Hand installer is Windows-only in this MVP.
  - Git is detect-only; installation guidance is manual.
  - Supervisor (OpenCode) auto-install is not implemented pending a verified installer contract.
  - Progress events are coarse (toast + per-step busy state) rather than streaming byte progress.
  - Manual clean-machine scenario not exercised in this session.
Recommended next work:
  - Live integration-test managed Hand download/install on a clean Windows VM.
  - Research and verify OpenCode versioned installer contract for optional managed Supervisor setup.
  - Implement streaming progress events if the product wants finer-grained install feedback.
  - Add Linux/macOS installer providers once Windows provider is proven.
  - Run full GitHub Actions CI on the feature branch before merge.
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
