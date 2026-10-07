# Serenade Documentation Pack

**Serenade** is a graphical desktop presentation and interaction client for **Secondhand / `hand`**.

> Secondhand owns orchestration and interaction truth. Serenade owns visibility, navigation, review and operator ergonomics.

## Active documents

### Product and architecture

- `design.md` — current product/UX design for the Hand 0.9+ interaction model.
- `architecture.md` — dual-adapter architecture, modern Hand gateway, event bridge, transports and safety boundaries.
- `implementation-plan.md` — original/general Serenade implementation history and milestone plan.
- `tasks.md` — general implementation backlog.
- `hand-integration-notes.md` — verified notes for the currently implemented Hand 0.6 legacy contract.

### Modern Hand migration

- `hand-modern-roadmap.md` — active Hand 0.9+ migration roadmap, compatibility policy and workstreams.
- `hand-modern-implementation-plan.md` — phased Codex-ready implementation plan for the modern adapter.
- `hand-0.8-roadmap.md` — archived pointer only; do not use for new implementation work.

### Quick Setup / onboarding

The existing Quick Setup documents describe the currently implemented/legacy environment path and will need modernization as the Hand 0.9+ adapter lands:

- `quick-setup-design.md`
- `quick-setup-architecture.md`
- `quick-setup-implementation-plan.md`
- `quick-setup-tasks.md`

For modern Hand, Treehouse/Herdr installation must not be carried forward; Hand owns Luvus and provides its own update lifecycle.

## Recommended Codex reading order

For **Hand modernization**:

1. `design.md`
2. `architecture.md`
3. `hand-modern-roadmap.md`
4. `hand-modern-implementation-plan.md`
5. `hand-integration-notes.md` only when preserving the Hand 0.6 legacy adapter
6. current upstream Hand 0.9+ public README/spec/vocabulary before implementing a command

For ordinary legacy fixes:

1. `hand-integration-notes.md`
2. `tasks.md`
3. the relevant implementation document

## Naming

```text
hand         → CLI
Secondhand   → orchestration + interaction system
Serenade     → desktop presentation + interaction client

Legacy06     → current verified Hand 0.6 adapter
Modern09     → target Hand 0.9+ adapter
```

## Core rules

1. **Hand is canonical.**
2. **Serenade does not read/write `hand.db` directly.**
3. **Serenade does not control Luvus directly for workflow operations.**
4. **Modern Supervisor state belongs to Hand.**
5. **Public Hand CLI/TOON is the modern integration contract.**
6. **Unknown/new Hand contracts fail closed for mutations.**
7. **Legacy and modern adapters remain isolated until migration is complete.**
