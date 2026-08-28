# Serenade Documentation Pack

**Serenade** is a graphical control interface for **Secondhand / `hand`**.

> Secondhand + Serenade. Yes, the name collision is intentional.

This folder contains the product, architecture, integration, and implementation planning documents for the Serenade desktop application.

## Files

- `design.md` — product vision, UX, screens, flows, design system, and MVP scope.
- `architecture.md` — frontend/backend architecture, safety boundaries, adapter design, polling, and testing.
- `implementation-plan.md` — staged implementation strategy and milestones.
- `tasks.md` — Codex-ready implementation backlog with task IDs and checkboxes.
- `hand-integration-notes.md` — verified notes for the currently implemented Hand CLI contract.
- `hand-0.8-roadmap.md` — living migration/progression tracker for Hand 0.8 Presentation + Interaction alignment, blockers, next actions, and upstream update reviews.

## Recommended Codex order

1. Read `design.md`.
2. Read `architecture.md`.
3. Read `hand-0.8-roadmap.md` before changing Hand-facing architecture or Supervisor behavior.
4. Use `hand-integration-notes.md` for the currently implemented Hand contract.
5. Use `tasks.md` as the implementation backlog.
6. Use `implementation-plan.md` as the milestone guide.
7. Keep `tasks.md` and `hand-0.8-roadmap.md` updated as work progresses or upstream Hand changes.

## Naming

```text
hand         → CLI
Secondhand   → orchestration system
Serenade     → Presentation + Interaction GUI / control interface
```

The most important architectural constraint remains: **Serenade sits on top of `hand`; it does not reimplement the orchestration engine or own canonical workflow truth.**
