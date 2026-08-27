# Tab Group for VS Code

Organize editor tabs into persistent, named groups from the Tab Group activity-bar view. The extension is inspired by browser tab groups while respecting VS Code's native editor and tab behavior.

![Grouping editor tabs](docs/assets/demo.gif)

## Features

- Drag one or more tabs onto a tab or group to create and populate a named group.
- Choose a distinct color for each group.
- Drag tabs to the view background to ungroup them.
- Use Sort Mode to reorder tabs and groups without changing group membership.
- Rename, close, ungroup, or dissolve a group from its context menu.
- Collapse and expand all groups.
- Preserve group membership, order, names, colors, and collapsed state in workspace state.
- Save named group snapshots, shown in a collapsed Saved Groups panel, and restore their supported tabs after they are closed.
- Show an unsaved-file decoration for text editors.
- Track text, text-diff, custom-editor, notebook, and notebook-diff tabs with stable IDs.
- Show ungrouped tabs in a Recent Tabs view ordered by most recently viewed.

## Usage

Open the **Tab Group** activity-bar view. Drag tabs directly to group them. When a new group is created, enter an optional name. Use the view title actions to enter Sort Mode and to collapse, expand, or reset all groups.

![Sorting grouped tabs](docs/assets/sort.gif)

Dropping an item onto another inserts it immediately before the target. In Sort Mode, tabs and groups can only be reordered within their current parent, so sorting never changes group membership. The **Recent Tabs** view lists ungrouped tabs by most recent activation; drag a tab from it onto a group in the **Tabs** view to organize it.

![Saved Groups panel](docs/assets/saved-groups.gif)

Use **Save Group...** from a group context menu to create a snapshot. Saving the same live group again updates its existing snapshot and keeps its name. Expand the **Saved Groups** panel to see snapshots and their tab counts, then expand a snapshot to inspect its saved files. Duplicate file names show the shortest distinguishing parent path. Use its folder action to restore one snapshot or its trash action to remove it from saved workspace storage. The panel toolbar also provides **Restore All Saved Groups** and **Delete All Saved Groups**. **Restore Saved Group...** remains available in the Tabs view title actions and Command Palette.

## Tab support

Tab Group supports the current public VS Code tab inputs that provide both a stable identity and a public reopen command: text editors, text diffs, custom editors, notebooks, and notebook diffs. Saved tab groups restore the same supported input types.

Terminal and webview panel tabs are intentionally omitted. The public `TabInputTerminal` input has no identity fields, while `TabInputWebview` exposes only its view type. VS Code provides no public operation to match or reopen those individual instances, so adding them would merge unrelated tabs or break after a reload. Unknown and future tab inputs are skipped for the same reason.

## Development

```bash
npm ci
npm run compile
npm run test:unit
npm run test:e2e
```

Use **Run Extension** in VS Code to launch an Extension Development Host. See [docs/testing.md](docs/testing.md) for automated and manual testing, and [docs/development.md](docs/development.md) for packaging, CI, and Marketplace releases.

## Contributing and Support

Please report defects and feature requests in the [issue tracker](https://github.com/billgoo/vscode-tab-group/issues). Read [SUPPORT.md](SUPPORT.md) for support expectations.
