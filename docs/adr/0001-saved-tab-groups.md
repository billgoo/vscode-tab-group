# ADR-0001: Persist Saved Tab Groups as Workspace Snapshots

- **Status:** Accepted
- **Date:** 2026-08-27
- **Related issue:** [#21 - Save and Load Tab group](https://github.com/billgoo/vscode-tab-group/issues/21)

## Context

The live Tabs and Recent Tabs views represent editors that are currently open. They cannot safely retain closed tabs because the live tree needs a native `vscode.Tab` to render and activate an item.

Users need to save a useful group, close its tabs, and restore it later. The solution must work for multi-root, remote, and virtual workspaces without merging resources that merely have the same path.

## Decision

Persist named Saved Tab Groups as versioned snapshots in `ExtensionContext.workspaceState`.

- Keep snapshots separate from the live Tabs and Recent Tabs state.
- Store typed, full-resource reopen descriptors for supported text, text-diff, custom-editor, notebook, and notebook-diff tabs.
- Give each live group at most one snapshot, using the live group's stable ID as the snapshot ID. Derive the display name from the group label, falling back to the ID when the label is empty or already used. Saving that group again updates the snapshot in place without prompting for a name.
- Restore an exact snapshot: reuse matching open tabs, reopen missing tabs, restore saved metadata and order, and return live-only tabs to the root list.
- Show snapshots in a collapsed Saved Groups panel. Users can inspect saved files, restore or delete one snapshot, and restore or delete all snapshots.
- Use stable tree item IDs so Saved Groups expansion and selection survive refreshes.
- Reject writes when persisted saved-group data has an unsupported version or invalid shape. Do not overwrite data that this version cannot understand.

## Consequences

### Positive

- Closing a tab does not lose a user-created snapshot.
- Restored groups have predictable membership, order, label, color, and collapsed state.
- Full URI identity avoids collisions between remote or virtual resources with the same path.
- The live tree remains a truthful representation of current VS Code tabs.
- Saved state is isolated to the workspace and profile where its resources are meaningful.

### Trade-offs

- Snapshots are not shared automatically across workspaces or VS Code profiles.
- Saved snapshot names are derived automatically; custom names from older snapshots are preserved when those snapshots are updated.
- Restoring a snapshot intentionally removes tabs added to its source group after the snapshot was saved.
- A missing file or unavailable provider yields a partial restore warning; the snapshot is kept.
- Terminal, webview, unknown, untitled, and unsaved editor content are not recoverable through public VS Code APIs.
- Restore All resolves overlapping legacy snapshots in panel order; a shared tab belongs to the first restored snapshot.

## Alternatives Considered

### Keep closed entries in the live Tabs tree

Rejected. Closed items cannot be reliably rendered or activated through the current public tab API, and they would make the live tree stale.

### Store snapshots in `globalState`

Rejected. Saved URIs and editor providers are workspace-specific. `workspaceState` naturally supports multi-root workspaces without presenting stale snapshots in unrelated workspaces.

### Restore into a new group every time

Rejected. Repeated restore would create duplicate live groups and could split tabs across them. Reusing the source group ID makes repeated restores deterministic.

## Implementation Notes

- [src/models/SavedGroup.ts](../../src/models/SavedGroup.ts) defines the persisted snapshot model and validation.
- [src/utils/savedTab.ts](../../src/utils/savedTab.ts) owns framework-independent saved-tab identity and presentation helpers.
- [src/providers/TabTypeHandler.ts](../../src/providers/TabTypeHandler.ts) owns public VS Code tab conversion and reopening.
- [src/services/SavedGroupsStore.ts](../../src/services/SavedGroupsStore.ts) owns workspace-state persistence.
- [src/providers/SavedGroupsTreeDataProvider.ts](../../src/providers/SavedGroupsTreeDataProvider.ts) renders snapshot inspection UI.

See [testing.md](../testing.md) for automated and manual acceptance coverage.
