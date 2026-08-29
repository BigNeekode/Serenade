# Serenade Quick Setup — Product & UX Specification

> **Status:** implementation-ready design spec  
> **Initial platform:** Windows-first  
> **Goal:** make a packaged Serenade build usable without requiring the operator to manually assemble the Secondhand environment in a terminal.

---

## 1. Product goal

A new user should be able to go from:

```text
Download Serenade
  ↓
Launch Serenade
  ↓
Choose where the Fleet should live
  ↓
Serenade checks and prepares the environment
  ↓
Add first project
  ↓
Use Serenade
```

The setup experience should replace the current implicit expert flow:

```text
install hand manually
install/configure runtime dependencies
configure PATH
hand init
configure fleet path
install/configure coding harnesses
configure routes
install OpenCode for Serenade Supervisor
launch Serenade
```

Serenade should become the approachable desktop onboarding experience for Secondhand while keeping Hand as the sole workflow authority.

---

## 2. Product principles

### 2.1 Quick by default

The common path should require as few decisions as possible.

### 2.2 Explicit ownership

Serenade must distinguish tools it manages from tools supplied by the system/user.

```text
managed  → installed and version-pinned by Serenade
system   → discovered from the operating system / PATH
custom   → operator supplied an explicit executable path
```

### 2.3 Qualified versions only

Serenade must never install `latest` blindly.

The currently verified workflow baseline is Hand **0.6.x**. A newer executable is not automatically mutation-compatible.

### 2.4 Repairable, not disposable

The first-run wizard must not be the only place the environment can be managed. The same capabilities become a reusable **Settings → Environment** page.

### 2.5 No hidden system mutation

Downloads, installations, authentication, and destructive/privileged changes must be visible to the user. Do not silently edit global PATH or run opaque remote scripts.

### 2.6 Hand remains authoritative

Serenade may install/discover Hand and invoke canonical Hand setup commands. It must never create/edit Hand database tables or fabricate Fleet state.

---

## 3. User modes

### Quick setup

Recommended for most users.

Serenade:

- scans dependencies;
- installs supported managed tools where safe;
- asks for Fleet location;
- initializes the Fleet through Hand;
- verifies health;
- offers optional Supervisor setup;
- guides the user through adding the first project.

### Existing environment

For experienced users who already have Hand/harnesses configured.

Serenade:

- discovers system executables;
- allows custom paths;
- validates versions/capabilities;
- imports an existing Fleet path;
- does not replace or reinstall healthy tools without explicit user action.

---

## 4. First-run flow

### Step 0 — Welcome

```text
┌───────────────────────────────────────────────┐
│ Welcome to Serenade                          │
│                                               │
│ Serenade can prepare the local tools needed  │
│ to run your AI coding fleet.                 │
│                                               │
│                    [ Get Started ]             │
└───────────────────────────────────────────────┘
```

Actions:

- **Get Started**
- **Use existing environment**

---

### Step 1 — Environment scan

Run read-only checks first.

Example:

```text
Environment Check

Git                       ✓ 2.x
Secondhand / hand         ✕ Missing
Supervisor Harness        ✕ Missing (optional)
Fleet                     ✕ Not configured

[ Continue ]
```

Each result should expose an expandable detail section containing:

- detected path;
- detected version;
- ownership (`managed`, `system`, `custom`);
- compatibility state;
- diagnostic message;
- available repair/setup action.

Do not prominently expose low-level provider implementation details such as Treehouse/Herdr as primary onboarding concepts. They may appear under **Advanced details** when relevant to the currently qualified Hand version.

---

### Step 2 — Setup mode

```text
● Quick setup
  Serenade manages compatible tools for you.

○ Use existing tools
  Choose already-installed executables and Fleet state.
```

The user can always override an individual tool after choosing Quick setup.

---

### Step 3 — Fleet location

Suggested default:

```text
Windows: %USERPROFILE%\Serenade\fleet
```

The Fleet should not be hidden under application data because it contains operator-visible project clones, worktrees, reports, and state.

Serenade-internal managed binaries/configuration should live separately, conceptually:

```text
%LOCALAPPDATA%\Serenade\
├─ config
├─ cache
├─ logs
└─ tools
```

UI:

```text
Where should your Fleet live?

C:\Users\you\Serenade\fleet
[ Browse ]

This location may contain:
• Fleet state
• project clones
• task worktrees
• reports
```

Validation before continuing:

- path is absolute/resolvable;
- parent is writable;
- path is not obviously inside Serenade's installation directory;
- an existing valid Fleet may be reused;
- a non-empty unrelated directory requires explicit confirmation or a different path.

---

### Step 4 — Prepare required tooling

Display an operation plan **before** downloading/installing anything.

Example:

```text
Quick Setup will prepare:

Secondhand / hand 0.6.x   Install managed compatible version
Git                       Use existing system installation
Fleet                     Initialize C:\Users\you\Serenade\fleet
Supervisor                Skip for now

[ Prepare Environment ]
```

Progress view:

```text
Preparing environment…

✓ Git detected
✓ Hand installed and verified
✓ Fleet initialized through Hand
✓ Environment validated
○ Supervisor skipped

[ Continue ]
```

Failures must be actionable and resumable. Never force the user to restart the entire wizard after fixing one dependency.

---

### Step 5 — Coding agent / Supervisor setup

Worker Harnesses and Serenade Supervisor are different concerns.

Show them separately.

#### Worker execution

Display Hand-detected/configured harness capability. Do not invent a new routing system.

Possible states:

```text
Claude Code      installed / authentication required / ready
Codex            installed / authentication required / ready
OpenCode         installed / authentication required / ready
Pi               installed / authentication required / ready
```

Installation/authentication support should be capability-driven. A tool that requires interactive login must say so instead of being marked ready merely because an executable exists.

#### Serenade Supervisor

Current qualified Supervisor Harness: **OpenCode**.

The wizard may offer:

```text
Set up Serenade Supervisor?

OpenCode is currently the qualified Supervisor runtime.

[ Set up OpenCode ]
[ Skip — use Serenade without Supervisor ]
```

Supervisor setup is optional. Core Serenade Fleet operations must remain usable without it.

---

### Step 6 — Add first project

Provide a GUI rather than requiring `hand project add` in a terminal.

```text
Add your first project

○ Git repository URL
  https://github.com/example/repo

○ Existing local repository
  C:\Projects\my-project
```

Only expose options actually supported by the currently qualified Hand contract. If Hand 0.6 cannot canonically register one of these forms, do not fake support in Serenade.

Project registration must go through the typed Hand integration boundary.

---

### Step 7 — Ready

```text
Everything is ready

Fleet             C:\Users\you\Serenade\fleet
Hand              0.6.x ✓ qualified
Git               2.x ✓
Supervisor        OpenCode ✓ / skipped
Projects          1

[ Open Serenade ]
```

Persist wizard completion only after required capabilities are ready. Optional capabilities may remain skipped.

---

## 5. Environment Manager

After onboarding, expose the same state under:

```text
Settings
└─ Environment
```

Example:

```text
Secondhand
  0.6.x
  ✓ Compatible
  Managed by Serenade
  [ Validate ] [ Reinstall ]

Git
  2.x
  System installation
  ✓ Ready

Supervisor Harness
  OpenCode
  ✓ Ready

Fleet
  C:\Users\you\Serenade\fleet
  ✓ Healthy

[ Run full check ]
```

This page is the long-term home for:

- dependency discovery;
- version compatibility;
- managed updates;
- custom executable paths;
- repair actions;
- authentication-required state;
- Fleet health;
- full diagnostics.

---

## 6. Dependency states

A dependency must not be represented by a single `installed: bool`.

Use a richer state model conceptually equivalent to:

```text
missing
installing
installed
configuration-required
authentication-required
incompatible
unhealthy
ready
```

A tool is only `ready` when the capability Serenade needs is actually usable.

Examples:

```text
opencode.exe exists
≠ Supervisor ready

hand.exe exists
≠ compatible Hand contract

Fleet directory exists
≠ valid Fleet
```

---

## 7. Tool ownership UX

Every executable integration should resolve to one of:

```text
managed
system
custom
```

Example detail card:

```text
Secondhand / hand

Ownership     Managed by Serenade
Version       0.6.x
Path          %LOCALAPPDATA%\Serenade\tools\hand\hand.exe
Compatibility Verified

[ Validate ] [ Change source ]
```

Advanced user action:

```text
Use Serenade-managed Hand
Use system Hand
Choose custom executable…
```

Switching executable source must immediately rerun compatibility checks.

---

## 8. Auto-repair UX

When a previously-ready dependency becomes unhealthy, prefer a repair action over raw errors.

Example:

```text
Worker runtime is unavailable.

Serenade detected that the configured Hand environment is not healthy.

[ Repair automatically ]
[ Run diagnostics ]
[ Show technical details ]
```

Repairs must be narrowly scoped and previewable when they alter files/install tools.

Never present a repair as successful until validation passes afterward.

---

## 9. Runtime vs development requirements

The packaged application must not tell normal users to install Node.js or Rust.

README/setup UI should distinguish:

### Runtime requirements

Only actual dependencies required by the packaged application and current Hand integration.

### Build-from-source requirements

- Node.js
- Rust
- Tauri build dependencies
- development tooling

---

## 10. MVP scope

### In scope — Windows-first Quick Setup MVP

- reusable Environment Inspector;
- detect Git;
- detect managed/system/custom Hand;
- enforce Hand compatibility policy;
- install a Serenade-qualified Hand version through a verified installer strategy;
- choose/create Fleet path;
- initialize Fleet through canonical Hand commands;
- run health validation;
- detect OpenCode;
- allow Supervisor to be skipped;
- add/import first supported project through Hand;
- persist resolved executable paths/ownership;
- Settings → Environment management page;
- resumable setup state;
- actionable diagnostics;
- tests for state transitions and fail-closed behavior.

### Explicitly out of scope for MVP

- silently installing every possible coding harness;
- storing API keys/passwords inside Serenade config;
- bypassing interactive authentication flows;
- directly manipulating Hand DB/schema;
- implementing guessed Hand 0.8 setup contracts;
- global PATH modification as the default setup mechanism;
- auto-installing an unqualified `latest` Hand release;
- full Linux/macOS installer support before the provider abstraction is proven on Windows.

---

## 11. Success criteria

A clean Windows machine with the supported base OS prerequisites should be able to:

1. install a packaged Serenade build;
2. launch it;
3. see an accurate environment scan;
4. choose Quick setup;
5. choose a Fleet location;
6. obtain/configure a Serenade-qualified Hand environment without manually editing PATH;
7. initialize/validate the Fleet through Hand;
8. optionally configure or skip Supervisor;
9. register the first supported project;
10. enter the main Serenade UI with required capabilities ready.

An experienced user with an existing Fleet/system Hand must also be able to choose existing tools without Serenade overwriting them.
