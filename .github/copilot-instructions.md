# Project Guidelines

## Code Style
- TypeScript strict with CommonJS modules; decorators are enabled, so keep `@Registered` usage consistent. See [tsconfig.json](tsconfig.json#L1-L18) and [src/TabTypeHandler.ts](src/TabTypeHandler.ts#L88-L98).
- Handlers are registered by class decoration; order matters (specific before general). See [src/TabTypeHandler.ts](src/TabTypeHandler.ts#L88-L98).
- Tree items are reused and labels may be rewritten for duplicate filenames; keep `TreeDataProvider` updates consistent with `treeItemMap` usage. See [src/TreeDataProvider.ts](src/TreeDataProvider.ts#L24-L99).

## Architecture
- Extension activation initializes workspace state and the tabs tree view. See [src/extension.ts](src/extension.ts#L1-L17).
- `TreeData` owns the in-memory model (`root`, `groupMap`, `tabMap`) and grouping/ordering operations. See [src/TreeData.ts](src/TreeData.ts#L6-L227).
- `TreeDataProvider` bridges VS Code UI with the model, handling drag/drop, sort mode slots, and path disambiguation. See [src/TreeDataProvider.ts](src/TreeDataProvider.ts#L17-L325).
- Tab input types are normalized via a handler registry, which is the single source of truth for tab IDs and activation. See [src/TabTypeHandler.ts](src/TabTypeHandler.ts#L12-L266).
- Dirty-file decorations are provided by `TabFileDecorationProvider` and applied when building tree items. See [src/TabFileDecorationProvider.ts](src/TabFileDecorationProvider.ts#L1-L58).

## Build and Test
- Build: `npm run compile`; watch: `npm run watch`; prepublish: `npm run vscode:prepublish`. See [package.json](package.json#L165-L170).
- Tests: `npm test` (Jest with `ts-jest`, roots in `src`). See [package.json](package.json#L165-L170) and [jest.config.js](jest.config.js#L1-L6).

## Project Conventions
- Tabs are linked to native VS Code tabs through normalized IDs; update handlers when adding new tab input types. See [src/TabTypeHandler.ts](src/TabTypeHandler.ts#L12-L266) and [src/TreeDataProvider.ts](src/TreeDataProvider.ts#L9-L188).
- Sort mode inserts a `Slot` item for drop targets and uses `pushBack`/`moveTo` to reorder. See [src/TreeDataProvider.ts](src/TreeDataProvider.ts#L39-L140).
- Group creation prompts for a name only when a new group is created from a root tab. See [src/TreeDataProvider.ts](src/TreeDataProvider.ts#L142-L161).

## Integration Points
- VS Code contributions define the activity bar view, tree view, and commands for group operations. See [package.json](package.json#L36-L164).
- Drag/drop uses `application/vnd.code.tree.tabstreeview` plus `text/uri-list`. See [src/TreeDataProvider.ts](src/TreeDataProvider.ts#L17-L37).
- Tab activation uses VS Code commands (`vscode.open`, `vscode.diff`, `vscode.openWith`). See [src/TabTypeHandler.ts](src/TabTypeHandler.ts#L97-L252).

## Security
- The extension operates on VS Code APIs only; no network or filesystem writes are present in the core tree/decoration paths. See [src/TreeDataProvider.ts](src/TreeDataProvider.ts#L17-L245) and [src/TabFileDecorationProvider.ts](src/TabFileDecorationProvider.ts#L1-L58).
