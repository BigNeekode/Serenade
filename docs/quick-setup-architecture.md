# Serenade Quick Setup — Architecture & Safety Contract

> **Purpose:** define the technical boundaries for automatic environment setup without turning Serenade into another package manager or another Hand control plane.

---

## 1. Architectural position

Quick Setup belongs to Serenade's **local environment/tooling layer**, not its workflow model.

```text
                    Serenade
                       │
              SetupCoordinator
                       │
       ┌───────────────┼────────────────┐
       ▼               ▼                ▼
EnvironmentInspector ToolManager     FleetSetup
       │               │                │
       │               │                ▼
       │               │            HandGateway
       │               │                │
       │               └───────────────►Hand
       │
       └── read-only host/tool checks
```

The following remains unchanged:

```text
Serenade Presentation/Interaction
            ↓
         HandGateway
            ↓
           Hand

Hand = workflow authority
```

Quick Setup may discover/install tools and invoke Hand's canonical setup/configuration commands. It must not become a workflow persistence layer.

---

## 2. New domain concepts

Names below are architectural concepts. OpenCode may adapt exact Rust/TypeScript filenames/names to fit the existing codebase, but must preserve the boundaries.

### Tool ownership

```ts
type ToolOwnership = "managed" | "system" | "custom";
```

- `managed`: executable is installed inside Serenade-owned application data.
- `system`: executable is discovered from PATH/standard host locations.
- `custom`: operator selected an explicit executable path.

### Tool readiness

```ts
type ToolState =
  | "missing"
  | "installing"
  | "installed"
  | "configuration-required"
  | "authentication-required"
  | "incompatible"
  | "unhealthy"
  | "ready";
```

### Tool descriptor

Conceptual shape:

```ts
interface ToolStatus {
  id: string;
  label: string;
  required: boolean;
  ownership?: ToolOwnership;
  path?: string;
  version?: string;
  state: ToolState;
  compatible?: boolean;
  message?: string;
  suggestedAction?: string;
  capabilities: string[];
}
```

Do not force this exact schema if the existing domain model already has a better equivalent.

---

## 3. SetupCoordinator

`SetupCoordinator` orchestrates onboarding operations, but does not execute arbitrary shell commands itself.

Responsibilities:

- request environment scan;
- build a setup plan;
- execute approved install/configure steps in order;
- expose progress/events;
- support retry/resume;
- stop on unsafe/unknown conditions;
- rerun validation after each mutation;
- persist only Serenade-owned setup preferences/status.

Non-responsibilities:

- Hand workflow lifecycle;
- direct Hand database access;
- arbitrary package execution;
- storing secret tokens/passwords;
- deciding Worker routing policy on behalf of Hand.

---

## 4. EnvironmentInspector

Read-only service.

Responsibilities:

- detect OS/platform/architecture;
- locate Git;
- locate configured Hand path;
- discover system Hand when appropriate;
- inspect Serenade-managed Hand install;
- classify Hand compatibility using the existing compatibility policy;
- detect configured Supervisor Harness executable;
- validate Fleet path using the existing Hand/Fleet validation mechanisms;
- surface capability readiness rather than only executable existence.

Rules:

1. Scan must not modify files or configuration.
2. Scan failures must be represented as structured diagnostics, not panics.
3. Discovery order must be deterministic and visible to the user.
4. Custom paths outrank system discovery when explicitly configured.
5. A managed tool should be preferred only when the operator selected managed ownership or no valid explicit/system choice exists during Quick Setup.

---

## 5. ToolManager

ToolManager owns installation/discovery metadata for Serenade-managed tools.

Conceptual filesystem layout on Windows:

```text
%LOCALAPPDATA%\Serenade\
├─ config\
├─ cache\
├─ logs\
└─ tools\
   ├─ hand\
   │  └─ <qualified-version>\
   │     └─ ...
   └─ supervisor\
      └─ opencode\
         └─ ...
```

Do not require exact nested names if Tauri's application-data APIs suggest a better platform-native location.

### Rules

- use absolute executable paths after resolution;
- do not rely on restarting the app to inherit modified PATH;
- do not globally edit PATH by default;
- installation is version-pinned;
- every install is followed by version/capability validation;
- managed files must stay under Serenade-owned directories;
- uninstall/reinstall of managed tools must never delete system/custom tools;
- user-facing logs must redact secrets/tokens if commands emit them.

---

## 6. Compatibility manifest

Serenade needs a small versioned manifest/policy describing **qualified** tool contracts.

Do not use GitHub `latest` as the compatibility policy.

Conceptual shape:

```json
{
  "hand": {
    "qualifiedRange": ">=0.6.0 <0.7.0",
    "recommendedVersion": "0.6.x"
  },
  "supervisorHarnesses": {
    "opencode": {
      "qualified": true
    }
  }
}
```

The implementation should reuse the existing frontend/Rust Hand compatibility classifiers rather than creating a third incompatible interpretation.

### Installation source policy

Before implementing an automatic download for Hand or OpenCode, OpenCode must inspect the official upstream release/install contract.

Allowed strategies, in preference order:

1. official versioned release asset with known architecture + integrity verification;
2. official installer/package command that supports explicit version pinning and non-destructive installation;
3. official bootstrap only with explicit user consent and only if its behavior/version result can be validated afterward.

Forbidden:

- inventing release asset URLs;
- downloading `latest` and assuming compatibility;
- silently piping arbitrary remote script content into a shell;
- accepting an incompatible resulting version and marking setup ready.

### Integrity

If upstream publishes checksums/signatures, verify them.

If no integrity metadata exists for a candidate automated installation path, stop implementation of that installer provider and document the blocker rather than inventing trust metadata.

---

## 7. Installer provider boundary

Use provider-specific installers behind a narrow interface.

Conceptual Rust shape:

```rust
trait ToolInstaller {
    fn inspect(&self) -> Result<ToolStatus, SetupError>;
    fn plan_install(&self) -> Result<InstallPlan, SetupError>;
    fn install(&self, plan: &InstallPlan) -> Result<InstallResult, SetupError>;
    fn validate(&self) -> Result<ToolStatus, SetupError>;
}
```

This is conceptual, not a requirement to implement a Rust trait literally.

Separate providers are expected for things such as:

- Hand;
- optional Supervisor Harness;
- possibly Git installation later.

For the first Windows MVP, Git may initially be **detect-only** if reliable privilege-safe installation is not yet implemented. The UI must then give a clear install/manual resolution action rather than pretending Serenade installed it.

---

## 8. FleetSetup

FleetSetup owns only Fleet onboarding operations exposed by the qualified Hand contract.

Allowed behavior:

```text
choose Fleet path
  ↓
validate destination
  ↓
invoke canonical Hand init/setup operation
  ↓
validate resulting Fleet
```

Forbidden behavior:

```text
create state/hand.db manually
write Hand schema/tables
fabricate projects/tasks/plans/attempts
edit canonical Fleet DB to "repair" setup
```

If Hand provides a canonical repair/doctor command, Serenade may invoke it through a typed integration method after user approval.

---

## 9. Project onboarding boundary

Project onboarding must use canonical Hand registration commands/services.

Serenade may provide a friendly UI, but it does not own the registered-project source of truth.

Only support input modes confirmed by the qualified Hand version.

Do not add an "existing local repo" path simply because the UI design mentions it unless Hand 0.6 actually supports registering one canonically.

---

## 10. Interaction with existing HandGateway

Quick Setup should reuse, not bypass, existing integration seams.

Expected high-level flow:

```text
Setup UI
   ↓
SetupCoordinator
   ↓
Environment/Tool/Fleet services
   ↓
HandGateway / configured HandRunner
   ↓
Hand CLI contract
```

Do not create a second unrelated Hand process wrapper.

For pre-Fleet operations such as version probing or `hand init`, reuse the existing global runner pattern or refactor it behind a semantic setup gateway if needed.

---

## 11. Tauri command safety

Do not expose a generic command like:

```text
run_shell(command: string)
```

Every setup mutation must have a typed Tauri command or typed backend operation, for example conceptually:

```text
environment_scan
setup_plan
managed_tool_install(tool_id)
fleet_initialize(path)
environment_repair(action_id)
```

The backend—not the frontend—must validate:

- allowed tool IDs;
- destination paths;
- expected versions;
- allowed URLs/sources;
- whether an operation is destructive;
- compatibility after installation.

Frontend validation is UX, not the security boundary.

---

## 12. Download safety

Downloads must:

- use HTTPS;
- come from allow-listed official sources encoded by installer providers/manifest;
- have size/time limits;
- download to a temporary/staging location;
- validate integrity/version before activation;
- use atomic/rename-style activation where practical;
- clean failed partial downloads;
- never overwrite a user-owned custom/system binary;
- produce structured progress and error events.

Do not let the frontend supply arbitrary download URLs.

---

## 13. Path safety

Managed installation roots and Fleet paths are different concerns.

### Managed tools

Must remain inside Serenade's application-data root.

### Fleet path

User-selectable, visible location.

Before Fleet initialization:

- canonicalize/normalize where possible;
- reject an obvious file path;
- verify parent writable;
- detect an existing Fleet;
- detect non-empty unrelated directories;
- never recursively delete a directory to "make setup work";
- require explicit confirmation before adopting a pre-existing directory with data.

---

## 14. Privilege policy

Prefer operations that do not require administrator/root privileges.

If a dependency requires elevation:

- clearly explain why;
- do not attempt hidden privilege escalation;
- use a platform-approved elevation flow only after explicit user action;
- prefer detect-only/manual guidance for the MVP if robust elevation is out of scope.

---

## 15. Authentication policy

Serenade setup may detect authentication readiness and launch/guide a provider's official authentication flow.

It must not:

- scrape credentials from terminals;
- persist plaintext API keys in ordinary Serenade config;
- claim authentication success only because an executable exists;
- silently create provider accounts.

If a harness exposes a safe non-secret status check, use it.

Otherwise mark the state `authentication-required` and let the user complete the provider-owned flow.

---

## 16. Resumability

Setup must be restart-safe.

Do not model the wizard as one irreversible monolithic transaction.

Each operation should be idempotent or safely re-inspectable:

```text
scan
install Hand
validate Hand
initialize/adopt Fleet
validate Fleet
configure optional Supervisor
register project
```

On relaunch, derive truth from actual environment state first. Persisted wizard step is only a UX hint.

---

## 17. Progress/event model

Long-running setup operations should emit structured progress rather than freezing the UI.

Conceptual stages:

```text
queued
resolving-source
downloading
verifying
installing
configuring
validating
complete
failed
```

Progress messages must be human-readable and include a technical detail channel for diagnostics.

Avoid fake percentage precision when the underlying operation cannot report real byte/task progress.

---

## 18. Error model

Add setup-specific typed errors where useful, but reuse the existing Serenade error envelope.

Useful categories include conceptually:

```text
TOOL_NOT_FOUND
TOOL_INCOMPATIBLE
INSTALL_SOURCE_UNAVAILABLE
DOWNLOAD_FAILED
INTEGRITY_CHECK_FAILED
INSTALL_FAILED
AUTHENTICATION_REQUIRED
FLEET_PATH_INVALID
FLEET_INIT_FAILED
REPAIR_FAILED
UNSUPPORTED_PLATFORM
```

Errors should include:

- title;
- actionable message;
- technical detail;
- recoverability;
- suggested action.

---

## 19. Configuration persistence

Serenade may persist:

- tool ownership choice;
- managed/custom executable paths;
- Fleet path;
- preferred setup mode;
- optional Supervisor Harness selection;
- wizard completion UX flag;
- last environment scan summary/timestamp if useful.

Do not persist canonical Hand workflow truth.

Do not treat persisted `ready` flags as authoritative; always revalidate when required.

---

## 20. Version updates

Managed updates must be compatibility-driven.

UI should say:

```text
Check for compatible updates
```

not simply:

```text
Update to latest
```

Before activation:

1. resolve candidate qualified version;
2. download/verify;
3. stage it;
4. run version/compatibility checks;
5. only then switch the configured managed executable;
6. retain enough information for rollback when practical.

Hand 0.7/0.8 must remain mutation-blocked until Serenade explicitly qualifies those contracts.

---

## 21. Platform abstraction

Implement Windows first, but keep platform-specific behavior behind adapters.

Avoid sprinkling `cfg!(windows)`/platform path logic through UI/domain code.

Conceptual providers:

```text
PlatformEnvironment
ManagedToolRoot
ExecutableDiscovery
InstallerProvider
Terminal/AuthLauncher
```

Linux/macOS support should be able to implement the same capability contract later.

---

## 22. Testing requirements

### Unit tests

At minimum cover:

- ownership precedence (`custom` vs system vs managed);
- readiness state derivation;
- Hand compatibility fail-closed behavior;
- setup plan generation;
- unsupported platform/tool handling;
- Fleet path validation;
- installer source allow-listing;
- version mismatch after install;
- idempotent/resume behavior;
- no `ready` state when authentication/configuration is incomplete.

### Backend integration tests

Use temporary directories and fake executables/process fixtures where possible.

Test:

- resolved absolute paths;
- managed-root confinement;
- staging/activation cleanup;
- timeout/error mapping;
- validation after install;
- Fleet init wrapper behavior without touching a real user Fleet.

### Frontend tests

Test:

- first-run routing;
- Quick vs existing environment choice;
- missing/incompatible/ready cards;
- progress and retry UI;
- skip Supervisor path;
- wizard resume;
- Environment Manager reuse.

---

## 23. Stop conditions for OpenCode

OpenCode must stop and document a blocker instead of guessing when it encounters any of the following:

1. No verified official version-pinned Hand installation source is available.
2. Upstream download integrity cannot be verified and the intended install method would silently execute remote code.
3. Implementing a feature requires direct Hand DB/schema manipulation.
4. A project registration mode is not supported by the qualified Hand contract.
5. Authentication would require Serenade to capture/store secrets insecurely.
6. Supporting a newer Hand version requires guessing 0.7/0.8 contracts.
7. A requested automatic install requires hidden privilege escalation.

Document the blocker in `docs/quick-setup-tasks.md` and continue with independent safe tasks.
