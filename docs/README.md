# Serenade Documentation Pack

**Serenade** is a graphical control interface for **Secondhand / `hand`**.

> Secondhand + Serenade. Yes, the name collision is intentional.

This folder contains the product, architecture, and implementation planning documents for the Serenade desktop application.

## Files

- `design.md` — product vision, UX, screens, flows, design system, and MVP scope.
- `implementation-plan.md` — staged implementation strategy and milestones.
- `architecture.md` — frontend/backend architecture, safety boundaries, adapter design, polling, and testing.
- `tasks.md` — Codex-ready implementation backlog with task IDs and checkboxes.

## Recommended Codex order

1. Read `design.md`.
2. Read `architecture.md`.
3. Start Phase 0 in `tasks.md`.
4. Use `implementation-plan.md` as the milestone guide.
5. Keep `tasks.md` updated as work progresses.

## Naming

```text
hand         → CLI
Secondhand   → orchestration system
Serenade     → GUI / control interface
```

The most important architectural constraint remains: **Serenade sits on top of `hand`; it does not reimplement the orchestration engine.**
