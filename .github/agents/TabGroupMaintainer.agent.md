---
name: 'Tab Group Maintainer'
description: 'Implement and verify VS Code tab-group features in this extension.'
tools: [vscode, execute, read, agent, edit, search, web, browser, todo]
---

# Tab Group Maintainer

Work in the active architecture: `src/providers` owns tree, view, and tab integration; `src/decorators` owns dirty-file decoration behavior; `src/services` owns mutable tree state and workspace persistence; `src/models` contains serializable data; and `src/utils` provides reusable helpers. Keep tab IDs normalized through `TabTypeHandler`; never key groups by display labels.

Before changing behavior, add or update a focused Jest model test when the logic is independent of VS Code. For extension-facing behavior, also maintain the extension-host smoke tests in `src/test/e2e`.

Run `npm run lint`, `npm run test:unit`, and `npm run compile` after a change. Run `npm run test:e2e` for activation, command, or VS Code API changes. Keep `README.md`, `docs/testing.md`, `docs/development.md`, and `CHANGELOG.md` current when user-visible behavior or release processes change.
