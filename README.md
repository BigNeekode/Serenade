# Serenade

**A control room for your AI software team.**

Serenade is a free, local-first desktop GUI for [Secondhand (`hand`)](https://github.com/atqamz/hand) —
the multi-agent coding orchestrator. If you run several AI coding agents in
parallel, `hand` orchestrates them; **Serenade makes the whole fleet visible,
controllable, and steerable without keeping a pile of terminals open.**

> Serenade sits on top of `hand` — it never reimplements the orchestration
> engine. `hand` stays the source of truth for every task, worker, and worktree.

---

## Why Serenade?

Running a fleet of coding agents from a CLI is powerful but cognitively
expensive. Serenade answers the operational questions in one glance:

- **What are my agents doing right now?**
- **Which tasks are blocked or failed?**
- **What changed, and where is the worktree?**
- **What did the scout discover?**
- **What needs my attention?**

And it adds the thing a terminal can't give you: a **chat with a supervising
agent** that plans and proposes work for you.

## Features

### Fleet operations

| Area | What you get |
|---|---|
| **Overview** | Health metrics, live activity feed, project health, provider usage, failure feed, stale-worker warnings |
| **Projects** | Registered repos with a Kanban board (statuses derived from hand's lifecycle), timeline, filters |
| **Tasks** | Full detail view: worker log stream, progress, worktree + git status, commits, scout report; create / instruct / retry / stop / promote |
| **Agents** | Every worker attempt with harness, model, live agent state, heartbeat staleness warnings |
| **Worktrees** | Isolated checkouts per task with git metadata; open in editor / file manager / terminal; confirmed cleanup |
| **Reports** | Markdown rendering of scout reports; create follow-up tasks; promote scouts to ship tasks |
| **Routes & providers** | Your harness/route configuration with live worker counts |
| **Supervisor chat** | Chat with an AI supervisor that sees your fleet and proposes tasks as one-click approval cards |

### Built-in safety

- **No arbitrary shell execution** — every backend action is a fixed, typed command
- **Destructive actions are confirmed** — stop (teardown) and worktree cleanup show exactly what will happen
- **Human-gated dispatch** — the supervisor can propose work, but *you* approve every spawn
- **Local-first** — no telemetry, no cloud, no ports bound to the network

### Nice to have

- `Ctrl+K` command palette / global search across projects, tasks, agents, reports, worktrees
- Resizable context panel — inspect any task without leaving the board
- Calm polling with a shared cache (one `hand` process per refresh, not dozens)
- Dark, developer-tool aesthetic (charcoal + violet, dense tables, monospace identifiers)

## Requirements

| Tool | Why | Install |
|---|---|---|
| [Node.js](https://nodejs.org) 22+ | frontend toolchain | nodejs.org |
| [Rust](https://rustup.rs) | to build the desktop app | rustup.rs |
| [`hand`](https://github.com/atqamz/hand) 0.6.0+ | the orchestrator Serenade drives | `irm https://atqamz.github.io/hand/install.ps1 \| iex` (Windows) or see the hand repo |
| [Git](https://git-scm.com) | project clones + worktree metadata | git-scm.com |
| An agent harness | the workers themselves — pick one: `claude`, `codex`, or `opencode` | each harness installs itself |

To actually spawn workers you also need hand's private runtime — run hand's
`bootstrap.ps1` (Windows) / `bootstrap.sh`, which installs **treehouse**
(worktree pool) and **herdr** (agent pane supervisor) under `~/.secondhand/`.

## Getting started

### 1. Build and launch

```bash
git clone <this-repo> serenade
cd serenade
npm install
npx tauri dev      # dev build — or:
npx tauri build    # production build → src-tauri/target/release/app.exe
```

On first launch Serenade checks your environment (hand found? fleet valid?) and
shows a setup screen if anything is missing.

### 2. Point it at a fleet

A *fleet home* is a directory `hand init` creates — Serenade can create one for
you from the setup screen, or use an existing one:

```bash
hand init C:\dev\my-fleet        # or wherever you want it
```

In Serenade: **Setup / Settings → fleet path** → set it → *Save & validate*.

### 3. Register a project and set your harness

```bash
hand config set harness opencode                # or claude / codex
hand project add https://github.com/you/your-repo
```

Projects appear in Serenade within seconds. That's it — you're operational.

### 4. Your first task

Two ways:

- **Direct** — *New Task* button (top right): pick a project, write a title and
  description, choose **scout** (investigation → report) or **ship**
  (implementation → PR). Serenade writes the task brief and dispatches a worker
  into an isolated worktree.
- **Via the supervisor** — open the **Supervisor** panel and just talk:
  *"Look at the fleet and propose tasks to improve the site."* The supervisor
  reads your fleet state (and, when scoped to a project, the codebase itself),
  then proposes work as approval cards. Click **Approve & spawn** — done.

From there: watch the board, read the worker's log stream, send mid-flight
instructions, review the diff in the worktree, and land or discard the work.

## How it works

```text
┌────────────────────────────  Serenade (Tauri desktop app)  ─────────────────────┐
│                                                                                  │
│  React UI  ── TanStack Query (polling + cache) ── typed SerenadeApi             │
│                                                        │                         │
│  Rust backend ────────────────────────────────────────┘                         │
│   ├─ hand adapter: fixed-arg subprocess calls, HAND_HOME pinned, timeouts,      │
│   │  typed error mapping (hand's error docs → actionable UI errors)             │
│   ├─ fleet files: briefs, reports, worker status streams, event log (read-only)│
│   ├─ git adapter: read-only worktree metadata                                   │
│   └─ supervisor: headless opencode agent with hand's session contract           │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
                          hand CLI  ·  treehouse  ·  herdr  ·  your harnesses
                                         │
                              projects/ clones + worktree pool
```

Key principles:

- **`hand` is the source of truth.** Serenade reads `hand status --json`,
  `hand project list --json`, and the fleet's files; every mutation is a real
  `hand` command (`spawn`, `send`, `reopen`, `promote`, `teardown`).
- **The frontend never knows CLI syntax**, and the backend exposes no generic
  shell — only typed, validated actions.
- **Mock mode for development**: run `npm run dev` in a browser and the same UI
  runs against a rich in-memory fleet — handy for developing without a real one.

## Repository layout

```text
src/                  React frontend
├─ app/               bootstrap, router, providers
├─ components/        design system (ui/), app shell (layout/), palette & markdown (common/)
├─ features/          overview, supervisor, projects, tasks, agents, worktrees,
│                     reports, routes, settings, setup
├─ hooks/             query hooks with polling
├─ lib/api/           SerenadeApi interface + Mock & Tauri implementations
├─ state/             UI store (selections, panel, supervisor chats)
└─ types/             shared domain model

src-tauri/src/        Rust backend
├─ lib.rs             all Tauri commands (async — the UI never blocks)
├─ hand/              process wrapper, JSON models, TOON parser
├─ supervisor.rs      headless supervisor sessions (per fleet / per project)
├─ adapter.rs         hand lifecycle → board statuses
├─ fleet_files.rs     briefs / reports / status streams / event log
├─ git.rs, local.rs   read-only git metadata; editor/folder/terminal launching
└─ config.rs, error.rs, domain.rs

docs/                 design, architecture, implementation plan, task backlog,
                      and the verified hand CLI contract
```

## Development

```bash
npm run dev                        # frontend only, mock backend → localhost:1420
npx tauri dev                      # full desktop app against your real fleet
npm run test                       # Vitest + React Testing Library
cd src-tauri && cargo test         # Rust unit tests (parsers, prompts)
npm run lint && npm run typecheck  # static checks
```

The docs folder is the map: `docs/design.md` (product/UX),
`docs/architecture.md` (system design), `docs/implementation-plan.md`
(milestones), `docs/hand-integration-notes.md` (the verified hand CLI contract,
including Windows setup gotchas).

## Troubleshooting

**Worker spawn fails with `server_not_running`** — herdr isn't running. Start it
(`herdr` in any terminal window) and retry.

**Worker spawn hangs at a `>>` prompt in the pane** — herdr panes must run a
POSIX shell on Windows. Set Git Bash as herdr's shell in
`%APPDATA%\herdr\config.toml`:

```toml
[terminal]
default_shell = "C:\\Program Files\\Git\\bin\\bash.exe"
```

then `herdr server reload-config`. (Full details in
`docs/hand-integration-notes.md` §11.)

**Claude workers stall on a security dialog** — Claude Code asks once per
project whether to allow external CLAUDE.md imports. Answer it once in the
herdr pane, or switch harnesses (`hand config set harness opencode`).

**Task shows "in progress" but the agent finished** — harnesses that don't
follow hand's report protocol never write the `done:` line. Serenade marks
these **Review** and says so in the log tab; inspect the worktree diff, then
send an instruction or tear the task down.

**App feels laggy or flashes console windows** — fixed in current builds (all
subprocesses run with `CREATE_NO_WINDOW` and behind a shared cache). If you see
it, you're on an old build — rebuild.

## Status & roadmap

MVP complete and live-verified against hand 0.6.0 on Windows: every core flow
(fleet overview, board, task lifecycle, worktrees, reports, supervisor chat
with task proposals) has been exercised against a real fleet. Up next:

- Installer bundles and app icons
- `hand watch --until-event` as a push event source (replacing some polling)
- Streaming supervisor replies
- Route/profile editor (once route config is safe to write)
- Token/cost analytics

See `docs/tasks.md` for the full backlog with status.

## Acknowledgments

- [Secondhand / hand](https://github.com/atqamz/hand) — the orchestrator this
  project drives; Serenade is a control surface for its design
- [treehouse](https://github.com/kunchenguid/treehouse) and
  [herdr](https://herdr.dev) — hand's worktree pool and agent pane supervisor
- [Tauri](https://tauri.app), React, Tailwind CSS, TanStack Query, shadcn-style
  primitives

## License

MIT
