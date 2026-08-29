# Serenade Documentation Pack

**Serenade** is a graphical control interface for **Secondhand / `hand`**.

> Secondhand + Serenade. Yes, the name collision is intentional.

This folder contains the product, architecture, integration, onboarding, and implementation planning documents for the Serenade desktop application.

## Files

### Core product / architecture

- `design.md` — product vision, UX, screens, flows, design system, and MVP scope.
- `architecture.md` — frontend/backend architecture, safety boundaries, adapter design, polling, and testing.
- `implementation-plan.md` — staged implementation strategy and milestones.
- `tasks.md` — general implementation backlog with task IDs and checkboxes.
- `hand-integration-notes.md` — verified notes for the currently implemented Hand CLI contract.
- `hand-0.8-roadmap.md` — living migration/progression tracker for Hand 0.8 Presentation + Interaction alignment, blockers, next actions, and upstream update reviews.

### Quick Setup / onboarding

- `quick-setup-design.md` — first-run wizard, Environment Manager, tool ownership/readiness, auto-repair UX, and Windows-first MVP scope.
- `quick-setup-architecture.md` — installer/security boundaries, SetupCoordinator, EnvironmentInspector, ToolManager, FleetSetup, compatibility manifest, resumability, and stop conditions.
- `quick-setup-implementation-plan.md` — phased implementation order from environment scanning through managed tooling, Fleet setup, Supervisor setup, project onboarding, repair, and packaging.
- `quick-setup-tasks.md` — OpenCode-ready execution checklist and live progress tracker for the Quick Setup feature.

## Recommended OpenCode order

For general Serenade work:

1. Read `design.md`.
2. Read `architecture.md`.
3. Read `hand-0.8-roadmap.md` before changing Hand-facing architecture or Supervisor behavior.
4. Use `hand-integration-notes.md` for the currently implemented Hand contract.
5. Use `tasks.md` as the general implementation backlog.
6. Use `implementation-plan.md` as the milestone guide.

For **Quick Setup / automatic environment onboarding** work:

1. Read `quick-setup-design.md`.
2. Read `quick-setup-architecture.md`.
3. Read `hand-0.8-roadmap.md` and preserve its compatibility rules.
4. Read `hand-integration-notes.md` before invoking current Hand setup/project commands.
5. Execute `quick-setup-implementation-plan.md` phase-by-phase.
6. Track every implementation result/blocker in `quick-setup-tasks.md`.
7. Keep `quick-setup-tasks.md` and `hand-0.8-roadmap.md` synchronized when upstream Hand changes invalidate assumptions.

## Naming

```text
hand         → CLI
Secondhand   → orchestration system
Serenade     → Presentation + Interaction GUI / control interface
```

The most important architectural constraint remains: **Serenade sits on top of `hand`; it does not reimplement the orchestration engine or own canonical workflow truth.**

Quick Setup adds one additional rule: **Serenade may discover/install local tools and invoke Hand's canonical setup operations, but it must not silently install unqualified versions, expose arbitrary shell/download primitives, or manipulate Hand's database directly.**
