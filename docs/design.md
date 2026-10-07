# Serenade — Product & UX Design

> **Modernization target:** Secondhand / `hand` 0.9+  
> **Last reviewed:** 2026-10-07  
> **Current shipping implementation:** Serenade still uses the verified Hand 0.6 compatibility adapter until the modern adapter is implemented and qualified.  
> **Upstream baseline:** Hand 0.9.0 stable; newer edge builds continue to evolve and are development-only unless explicitly qualified.

## 1. Product thesis

Serenade is the **desktop presentation and interaction client for Secondhand**.

Modern Hand now owns the workflow and interaction primitives that Serenade previously had to approximate: a managed Supervisor, Tasks, Plans, Attempts, Reports, Decisions, routing profiles, native Git worktrees, runtime lifecycle through Luvus, event cursors/wakes, and the operator-facing "Needs" model.

That changes Serenade's role materially.

Serenade should no longer behave like a second orchestration layer around Hand. It should make Hand's canonical state easier to see, understand and operate through a richer desktop UX.

```text
Operator
   ↓
Serenade
   ├─ Presentation
   ├─ Interaction UX
   ├─ local editor / Git convenience
   └─ desktop notifications / navigation
            ↓
       HandGateway
            ↓
      Secondhand / hand
   ├─ managed Supervisor
   ├─ Tasks / Plans
   ├─ Attempts / Reports
   ├─ Decisions
   ├─ routing profiles
   ├─ git worktrees
   ├─ event cursor / wakes
   └─ Luvus runtime
```

The central rule is unchanged:

> **Hand owns workflow truth. Serenade owns presentation, operator ergonomics and local desktop convenience.**

## 2. Why Serenade is more valuable after Hand 0.8/0.9

Hand's redesign removes several responsibilities that made Serenade complicated:

- no Serenade-owned Supervisor runtime is required;
- no private supervisor context reconstruction is required;
- no Treehouse or Herdr lifecycle management is required for modern Hand;
- no local derivation of "attention" is required when Hand exposes canonical operator needs;
- no task-kind/execution-class routing matrix is required;
- no guessed lifecycle completion from worker output is required;
- no custom Hand updater is required for modern installs once `hand update` is available.

Serenade can now focus on the parts a desktop application is good at:

- cross-fleet overview;
- high-density visual task and attempt inspection;
- task → plan → attempt history;
- Needs/Decision workflows;
- Supervisor chat with rich attachments;
- diff, branch and worktree inspection;
- opening files/worktrees in local tools;
- desktop-safe confirmations;
- searchable reports and event history;
- keyboard-first navigation;
- environment diagnostics;
- update visibility without reimplementing Hand's updater.

## 3. Canonical Hand 0.9+ vocabulary

Serenade should mirror modern Hand's public nouns instead of preserving legacy 0.6 vocabulary.

| Hand concept | Serenade representation |
|---|---|
| Fleet | Fleet / workspace |
| Project | Project |
| Task `tN` | Task |
| Plan revision `pN` | Plan |
| Attempt `aN` | Attempt |
| Report `rN` | Report |
| Decision `dN` | Decision |
| Supervisor launch `sN` | Supervisor run |
| Supervisor input `iN` | Chat input |
| Routing profile | Profile |
| Worktree | Attempt worktree |
| Event cursor | Refresh/currentness cursor |
| Needs | Needs You surface |

Modern Hand task kinds such as `scout`/`ship`, execution classes such as `mechanical`/`standard`/`deep`, delivery modes, legacy route maps, Herdr and Treehouse are **not** modern Serenade domain concepts.

## 4. Product boundaries

### Serenade may

- invoke documented Hand CLI operations through typed backend methods;
- parse Hand's public TOON output;
- keep ephemeral cached projections for UI performance;
- subscribe/wait on Hand's event cursor and refresh affected projections;
- open worktrees, folders, terminals and editors locally;
- compute local Git/diff convenience data when it does not redefine Hand lifecycle truth;
- persist UI preferences, selected views, window state and non-authoritative cache metadata;
- surface Hand update plans and invoke Hand's own update operation after explicit user intent.

### Serenade must not

- read or write `hand.db` directly;
- manipulate Luvus directly for workflow operations;
- scrape or automate `hand board` HTML as an API;
- maintain a separate canonical Supervisor conversation;
- infer Task completion from provider output;
- invent Decisions, Reports, Plans or lifecycle records outside Hand;
- silently retarget stale actions to a newer Attempt or screen;
- expose arbitrary shell execution through the frontend;
- silently switch stable users onto Hand edge builds.

## 5. Primary user questions

The main UI should make these answerable immediately:

1. **What needs me right now?**
2. **What is the Supervisor doing?**
3. **Which Tasks are active, blocked or waiting?**
4. **What did the latest Attempt do?**
5. **What did the worker report?**
6. **Is there a Decision I need to answer?**
7. **Where is the worktree and what changed?**
8. **Which profile/model is running this Attempt?**
9. **What failed and what is the next valid action?**
10. **Is my Hand environment healthy and current?**

## 6. Information architecture

Recommended global navigation:

- **Overview**
- **Supervisor**
- **Projects**
- **Tasks**
- **Attempts**
- **Reports**
- **Profiles**
- **Settings**

"Worktrees" remains accessible from Tasks/Attempts and may remain as a power-user view, but it should no longer imply a separate execution subsystem.

"Agents" should migrate to **Attempts**, because Hand's durable execution record is an Attempt. Provider status is a property of the active Attempt rather than a first-class Serenade workflow entity.

"Routes" should migrate to **Profiles**.

## 7. Main application shell

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Fleet switcher | Search | Needs badge | Supervisor state | Hand health      │
├───────────────┬──────────────────────────────────────────┬───────────────────┤
│ Sidebar       │ Primary workspace                        │ Context panel     │
│               │                                          │                   │
│ Overview      │ Needs / chat / board / history / reports │ Task detail       │
│ Supervisor    │                                          │ Attempt detail    │
│ Projects      │                                          │ Decision detail   │
│ Tasks         │                                          │ Report detail     │
│ Attempts      │                                          │                   │
│ Reports       │                                          │                   │
│ Profiles      │                                          │                   │
│ Settings      │                                          │                   │
├───────────────┴──────────────────────────────────────────┴───────────────────┤
│ Hand version | channel | fleet | watcher | Luvus | event cursor             │
└──────────────────────────────────────────────────────────────────────────────┘
```

The context panel should remain a core Serenade strength: inspect deep Hand state without leaving the operational surface.

## 8. Overview: "Needs You" first

The highest-priority section is a canonical **Needs You** queue derived from Hand state/commands, not Serenade heuristics.

It should surface, in priority order where Hand provides that ordering:

- blocked Supervisor screen;
- blocked worker screen;
- worker turn ended without a report when operator intervention is required;
- harness usage-limit state;
- failed/exited/interrupted Attempts;
- work waiting for a Supervisor;
- unexpectedly stopped Supervisor;
- open Decisions;
- unread Reports.

A clean fleet should say **All clear**.

A need card should show:

- severity/tone;
- canonical ref(s);
- Task title;
- concise Hand-provided reason;
- age;
- the exact safe actions available.

Refreshing the view must never acknowledge a Report or answer a Decision.

## 9. Supervisor workspace

Hand now owns the managed Supervisor. Serenade should be a client for it.

### Supervisor surface

Show:

- current Supervisor launch ref;
- harness;
- model;
- effort;
- state;
- usage/context information when Hand exposes it;
- pending model/harness switch;
- watcher state;
- conversation history exposed by a qualified public Hand surface;
- operator inputs and image attachments;
- Hand lines for start/stop/switch/keys events.

### Actions

Through typed Hand operations:

- Start
- Resume
- Stop
- Interrupt, when supported by the public contract
- Send message
- Switch model/effort
- Switch harness/profile
- Respond to a blocked Supervisor screen using revision/digest guards

Serenade must not maintain a second provider session or claim that local chat history is canonical Supervisor state.

## 10. Tasks, Plans and Attempts

### Task board

Modern Hand Tasks should be shown around their actual lifecycle rather than legacy scout/ship columns.

Recommended presentation groups:

- **Inbox**
- **Active**
- **Needs attention** (presentation grouping; not a Hand lifecycle)
- **Done**
- **Abandoned**

A Task card should show:

- `tN`;
- title;
- project;
- current lifecycle;
- latest Plan revision;
- active/latest Attempt;
- harness/model/effort;
- latest Report status;
- open Decision count;
- need/warning state;
- last meaningful event.

### Task detail

Use progressive disclosure:

```text
Task t12
├─ Goal
├─ Current status
├─ Plan history
│   ├─ p1
│   └─ p2 current
├─ Attempts
│   ├─ a17 stopped
│   └─ a21 running
├─ Reports
│   ├─ r8 progress
│   └─ r9 done unread
├─ Decisions
│   └─ d4 answered
└─ Event history
```

Do not flatten these into one overloaded "task status".

### Attempt detail

Show separately:

- attempt lifecycle: launching/running/exited/interrupted/stopped/failed;
- agent/provider state exposed by Hand;
- harness/model/effort;
- worktree and branch;
- start/end timestamps;
- reason;
- last safe screen tail when Hand exposes it;
- Reports;
- messages sent to the Attempt;
- relevant events;
- Git convenience information.

## 11. Blocked screens

Modern Hand provides revision-guarded screen interaction.

Serenade should expose blocked screens as explicit operator actions:

- render the sanitized screen;
- display the screen revision;
- offer only Hand-supported keys/options;
- submit the revision and, where required, the screen digest;
- on stale failure, refresh and require the operator to review the new screen.

Never resend keys against "the current screen" after a stale response without another operator confirmation.

## 12. Reports

Reports are canonical Hand records for any Attempt.

Report statuses:

- `progress`
- `done`
- `stuck`

The Reports view should support:

- unread/read state;
- task/project filtering;
- Markdown rendering;
- link back to Attempt and Task;
- full text and summary;
- acknowledgement through Hand;
- search;
- "ask Supervisor about this report" by sending a normal Supervisor input containing refs.

A `done` Report means **the worker says the Attempt's work is finished**. It does not by itself redefine Task lifecycle.

## 13. Decisions

Decisions are the canonical Supervisor → operator question channel.

Decision UI should support:

- question headline/body;
- task context;
- numbered options as quick-fill buttons when present;
- free-form answer;
- answered/withdrawn history;
- exact `dN` identity.

Decision answers must target the exact Decision ref. If Hand rejects it because state changed, Serenade refreshes instead of guessing.

## 14. Profiles

Replace the legacy route matrix with modern routing profiles.

Display from `hand route list`:

- profile name;
- harness;
- model;
- effort;
- validity on this machine;
- track record when Hand exposes it.

Use profiles for:

- starting an Attempt;
- starting the Supervisor;
- switching Supervisor profile.

Serenade may offer a friendly editor only if Hand exposes a safe canonical write path. Do not make direct `routing.json` editing the default application contract unless explicitly designed and validated.

## 15. Projects

Modern Hand Projects refer to existing repositories that Hand uses in place.

Project UI should focus on:

- project name;
- repository path;
- active/inbox Task counts;
- recent events;
- current worktrees;
- open in editor/folder/terminal;
- add/adopt/create only through public Hand operations that exist in the qualified version.

Serenade must not preserve assumptions from legacy Hand about every project being cloned under the fleet home.

## 16. Worktrees and Git UX

Hand owns worktree creation/cleanup lifecycle. Serenade adds inspection convenience.

Show:

- Attempt;
- Task;
- path;
- branch;
- Git status;
- changed files;
- commits;
- ahead/behind when safe to compute;
- open editor/folder/terminal.

Any cleanup action must go through Hand's Attempt cleanup operation. Serenade must not remove a modern Hand worktree directly.

## 17. Real-time update model

Modern Serenade should move away from blind high-frequency polling.

Preferred model:

1. obtain a fresh bounded Hand projection;
2. retain Hand's event cursor;
3. wait for events after that cursor using a qualified Hand command;
4. invalidate/refetch only affected projections;
5. fall back to conservative polling if the event wait is unavailable.

The cursor is transport/currentness state, not business state.

The frontend should still display "last updated" and make stale/disconnected state obvious.

## 18. Environment and updates

For modern Hand, Settings should show:

- Hand executable;
- version;
- channel;
- commit;
- state schema;
- tested/pinned Luvus;
- fleet health;
- watcher state;
- available harnesses;
- profile validity.

Modern setup should prefer Hand's own facilities:

- installation from an explicitly qualified stable release;
- `hand init`;
- `hand version`;
- `hand update --check`;
- `hand update`;
- `hand luvus show` / Hand-managed Luvus pinning.

Serenade should not install/manage Treehouse or Herdr for modern Hand.

Legacy Hand 0.6 setup support may remain isolated behind the legacy compatibility path during migration.

## 19. Compatibility policy

Target policy during modernization:

| Hand version | Serenade mode |
|---|---|
| `0.6.x` | legacy adapter; current verified behavior |
| `0.7.x` | unsupported transition line |
| `0.8.x` | redesigned but not the target qualification baseline; diagnostics only unless explicitly tested |
| `0.9.x` | modern adapter target |
| newer `0.x` / edge | capability-gated; no automatic mutation permission |
| `1.x+` / unknown | fail closed until qualified |

Version alone is not sufficient. The modern adapter should also consider `hand version` metadata such as channel/state schema when relevant to a public contract.

## 20. Platform policy

Hand 0.9 stable ships Linux/macOS binaries and supports Windows through WSL2. Current edge development also contains experimental native Windows support.

Serenade should therefore separate:

- **protocol/contract support** for modern Hand;
- **platform transport support** for invoking it.

Initial qualification matrix:

- Linux native: target;
- macOS native: target;
- Windows + WSL2: target after path/process bridge validation;
- native Windows Hand edge: experimental opt-in only until upstream stable support is qualified.

Do not require Serenade users to run an unqualified edge build merely to satisfy the desktop application's Windows-first history.

## 21. Domain model direction

Frontend domain types should mirror Hand records without exposing CLI formatting.

```ts
type HandRef = string;

interface Fleet {
  id: string;
  name: string;
  home: string;
  cursor?: number;
}

interface Task {
  id: HandRef;          // tN
  projectId: string;
  title: string;
  goal?: string;
  status: "inbox" | "active" | "done" | "abandoned" | "unknown";
  currentPlanId?: HandRef;
  activeAttemptId?: HandRef;
  createdAt?: string;
  updatedAt?: string;
}

interface Plan {
  id: HandRef;          // pN
  taskId: HandRef;
  body: string;
  current: boolean;
  createdAt?: string;
}

interface Attempt {
  id: HandRef;          // aN
  taskId: HandRef;
  status: "launching" | "running" | "exited" | "interrupted" | "stopped" | "failed";
  harness: string;
  model?: string;
  effort?: string;
  worktree?: string;
  branch?: string;
  reason?: string;
  startedAt?: string;
  endedAt?: string;
}

interface Report {
  id: HandRef;          // rN
  attemptId: HandRef;
  status: "progress" | "done" | "stuck";
  body: string;
  acknowledged: boolean;
}

interface Decision {
  id: HandRef;          // dN
  taskId: HandRef;
  status: "open" | "answered" | "withdrawn";
  question: string;
  answer?: string;
}

interface RoutingProfile {
  name: string;
  harness: string;
  model?: string;
  effort?: string;
  valid: boolean;
}
```

Exact fields should be finalized from captured Hand 0.9 CLI fixtures rather than guessed from internal database structures.

## 22. Safety invariants

1. Hand remains the only workflow source of truth.
2. No direct `hand.db` mutation or schema dependency.
3. No direct Luvus control for workflow state.
4. Exact refs are preserved on every mutation.
5. Stale blocked-screen actions fail and refresh.
6. Reading never acknowledges.
7. Report `done` is not silently promoted to Task `done`.
8. Cleanup/destructive actions require explicit confirmation.
9. Edge builds never receive mutation permission merely because their version is numerically newer.
10. Legacy and modern adapters must not share commands whose semantics changed across the redesign.

## 23. Visual direction

Keep Serenade's developer-tool identity:

- dark-first;
- compact, information-dense layout;
- clear monospace refs;
- calm neutral surfaces;
- semantic warning/failure tones;
- restrained accent use;
- keyboard navigation;
- right-side contextual inspection;
- reduced-motion support.

The UI should feel closer to a desktop operations console than a generic project-management SaaS.

## 24. Modernization success criteria

The Hand 0.9+ modernization is successful when:

- Serenade can connect to a modern Fleet without reading `hand.db`;
- Overview shows canonical Needs instead of legacy-derived Attention;
- Supervisor chat/control is Hand-owned end-to-end;
- Tasks expose Plan/Attempt/Report/Decision history;
- Decisions can be answered safely;
- Reports can be acknowledged safely;
- blocked screens can be handled with revision guards;
- Attempts can be started/messaged/stopped/cleaned through typed commands;
- routing profiles replace scout/ship route UI;
- modern setup has no Treehouse/Herdr requirement;
- modern Hand updates use Hand's own updater;
- legacy 0.6 remains isolated until intentionally removed;
- all modern mutations fail closed on unqualified versions/contracts.

## 25. Explicitly deprecated Serenade concepts

The modernization should remove these from the modern path:

```text
Serenade-owned Supervisor runtime
OpenCode-only Supervisor architecture
scout / ship Task type
mechanical / standard / deep execution class
legacy route matrix
Treehouse as a product concept
Herdr as a product concept
merge / deliver / teardown workflow
legacy-derived Attention as canonical-looking state
private status-file reporting
direct fleet file lifecycle assumptions
```

They may remain inside the legacy 0.6 adapter until that adapter is retired.

## 26. Product identity after modernization

Serenade is not "Hand with buttons."

It is the high-bandwidth desktop workspace around Hand's interaction layer:

```text
Hand
  = orchestration + interaction truth

Serenade
  = visibility + navigation + review + operator ergonomics
```

That division should guide every future feature.
