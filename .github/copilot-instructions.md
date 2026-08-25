# Project Guidelines

## Code Style

- TypeScript strict with CommonJS modules; decorators are enabled, so keep `@Registered` usage consistent. See [tsconfig.json](tsconfig.json#L1-L18) and [src/providers/TabTypeHandler.ts](src/providers/TabTypeHandler.ts#L88-L98).
- Handlers are registered by class decoration; order matters (specific before general). See [src/providers/TabTypeHandler.ts](src/providers/TabTypeHandler.ts#L88-L98).
- Tree items are reused and labels may be rewritten for duplicate filenames; keep `TreeDataProvider` updates consistent with `treeItemMap` usage. See [src/providers/TreeDataProvider.ts](src/providers/TreeDataProvider.ts#L24-L99).

## Architecture

- Extension activation initializes workspace state and the tabs tree view. See [src/extension.ts](src/extension.ts#L1-L17).
- [src/models/types.ts](src/models/types.ts) defines serializable tab and group data. [src/services/TreeState.ts](src/services/TreeState.ts) owns the in-memory indexes and grouping/ordering operations. [src/services/WorkspaceStateStore.ts](src/services/WorkspaceStateStore.ts) adapts VS Code workspace storage.
- [src/providers/TreeDataProvider.ts](src/providers/TreeDataProvider.ts) bridges VS Code UI with tree state, handling drag/drop, sort mode slots, and path disambiguation.
- Tab input types are normalized via a handler registry, which is the single source of truth for tab IDs and activation. See [src/providers/TabTypeHandler.ts](src/providers/TabTypeHandler.ts#L12-L266).
- `providers/` owns tree, view, and tab integrations. `decorators/` owns dirty-file decoration behavior. `utils/` contains reusable framework-independent helpers, including disposable lifecycle management.

## Build and Test

- Build: `npm run compile`; watch: `npm run watch`; prepublish: `npm run vscode:prepublish`. See [package.json](package.json#L165-L170).
- Tests: `npm test` (Jest with `ts-jest`, roots in `src`). See [package.json](package.json#L165-L170) and [jest.config.js](jest.config.js#L1-L6).

## Project Conventions

- Tabs are linked to native VS Code tabs through normalized IDs; update handlers when adding new tab input types. See [src/providers/TabTypeHandler.ts](src/providers/TabTypeHandler.ts#L12-L266) and [src/providers/TreeDataProvider.ts](src/providers/TreeDataProvider.ts#L9-L188).
- Sort mode inserts a `Slot` item for drop targets and uses `pushBack`/`moveTo` to reorder. See [src/providers/TreeDataProvider.ts](src/providers/TreeDataProvider.ts#L39-L140).
- Group creation prompts for a name only when a new group is created from a root tab. See [src/providers/TreeDataProvider.ts](src/providers/TreeDataProvider.ts#L142-L161).

## Integration Points

- VS Code contributions define the activity bar view, tree view, and commands for group operations. See [package.json](package.json#L36-L164).
- Drag/drop uses `application/vnd.code.tree.tabstreeview` plus `text/uri-list`. See [src/providers/TreeDataProvider.ts](src/providers/TreeDataProvider.ts#L17-L37).
- Tab activation uses VS Code commands (`vscode.open`, `vscode.diff`, `vscode.openWith`). See [src/providers/TabTypeHandler.ts](src/providers/TabTypeHandler.ts#L97-L252).

## Security

- The extension operates on VS Code APIs only; no network or filesystem writes are present in the core tree and decoration paths. See [src/providers/TreeDataProvider.ts](src/providers/TreeDataProvider.ts#L17-L245) and [src/decorators/TabFileDecorationProvider.ts](src/decorators/TabFileDecorationProvider.ts#L1-L72).
