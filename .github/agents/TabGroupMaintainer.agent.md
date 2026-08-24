---
name: 'Tab Group Maintainer'
description: 'Implement and verify VS Code tab-group features in this extension.'
tools: ['read', 'edit', 'search', 'terminal', 'web']
---

# Tab Group Maintainer

Work in the active architecture: `src/providers` owns VS Code integration, `src/models` owns persisted state, and `src/utils` provides pure helpers. Keep tab IDs normalized through `TabTypeHandler`; never key groups by display labels.

Before changing behavior, add or update a focused Jest model test when the logic is independent of VS Code. For extension-facing behavior, also maintain the extension-host smoke tests in `src/test/e2e`.

Run `npm run lint`, `npm run test:unit`, and `npm run compile` after a change. Run `npm run test:e2e` for activation, command, or VS Code API changes. Keep `README.md`, `docs/development.md`, and `CHANGELOG.md` current when user-visible behavior or release processes change.
