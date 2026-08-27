# Testing

Use Node.js 20 or newer and install dependencies from the committed lockfile:

```bash
npm ci
```

## Automated Checks

Run the checks below before opening a pull request or preparing a release:

```bash
npm run lint
npm run test:unit
npm run compile
npm run test:e2e
npm run package
```

| Command             | Coverage                                                                                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run lint`      | TypeScript style and static analysis.                                                                                                                                                      |
| `npm run test:unit` | Grouping, ungrouping, lifecycle, and pure utility behavior.                                                                                                                                |
| `npm run compile`   | Strict TypeScript compilation.                                                                                                                                                             |
| `npm run test:e2e`  | Extension-host smoke test for activation, Recent Tabs, the expandable Saved Groups panel, saved-tab commands and reopening, supported tab-input normalization, and opaque-input rejection. |
| `npm run package`   | Production VSIX build and package contents.                                                                                                                                                |

On macOS, `test:e2e` uses the installed VS Code application when available. Set `VSCODE_TEST_EXECUTABLE` to an executable path on another platform, or set `VSCODE_TEST_DOWNLOAD=true` to use a downloaded runtime. On headless Linux, run the command through `xvfb-run -a npm run test:e2e`.

To run the local release gate without publishing to Marketplace:

```bash
npm run publish:local -- --package-only
```

Use `--skip-e2e` only when a local VS Code runtime is unavailable. CI and tag-based releases always run the extension-host test.

## Manual Acceptance

1. Open the repository in VS Code and start **Run Extension** with `F5`.
2. In the Extension Development Host, open at least three files and open the **Tab Group** activity-bar view.
3. Complete the following checks.

### Grouping

- Drag a root tab onto another root tab and enter an optional group name.
- Confirm each tab appears exactly once in the tree.
- Drag another root tab onto the group and confirm it joins that group.
- Drag a grouped tab onto the view background and confirm it returns to the root list.
- Select a group, use the top-right **Change Group Color** action (or the group item action), choose a color, and confirm the colored group icon and color name update.

### Sorting And Toolbar

- Use the top-right **Sort Mode** action, reorder tabs or groups, and select **Done**.
- Confirm ordering changes without changing group membership.
- Use **Collapse All** and **Expand All** when available.
- Use **Reset All** and confirm that groups are removed while open tabs remain listed at the root.

### Persistence And Synchronization

- Collapse a group, run **Developer: Reload Window**, and confirm the group membership, order, and collapsed state are restored.
- Confirm the selected group color is restored after reloading the window.
- Open a file and confirm it appears in the tree; close its native editor tab and confirm it disappears.
- Select a tree item and confirm the corresponding editor becomes active.

### Saved Tab Groups

- Create a group containing at least two text files, then choose **Save Group...** from its context menu and enter a snapshot name.
- Close both native editor tabs and confirm the live group disappears from the Tabs view.
- Choose **Restore Saved Group...** from the Tabs view title actions, select the snapshot, and confirm both files reopen in a group with the saved label, color, order, and collapsed state.
- Restore the snapshot when one of its files is already open and confirm the file is reused instead of duplicated.
- Run **Developer: Reload Window** and confirm the snapshot remains available in the restore picker.
- Rename or remove one saved file, restore the snapshot, and confirm the available files reopen, a warning appears, and the snapshot remains available.
- Run **Delete Saved Group...** from the Command Palette, confirm deletion, and verify the snapshot no longer appears in the restore picker.

### Unsaved File Decoration

- Modify an open text file without saving and confirm the unsaved decoration appears in the tree.
- Save the file and confirm the decoration disappears.

### Recent Tabs

- Open several ungrouped files and activate them in different orders; confirm **Recent Tabs** lists the most recently activated tab first.
- Drag a tab from **Recent Tabs** onto an existing group and confirm it disappears from **Recent Tabs** after grouping.
- Ungroup the tab and confirm it returns to **Recent Tabs** in its tracked position.

### Supported Tab Inputs

- Confirm text editors, text diffs, custom editors, notebooks, and notebook diffs can be listed, grouped, selected, reopened from the Tab Group view, and restored from a saved group when their provider is available.
- Confirm terminal and webview panel tabs are omitted because the public VS Code API does not expose a stable per-instance identity and reopen operation for them.

### Packaged Extension

- Run `npm run package`.
- Install `tab-group-<version>.vsix` with **Extensions: Install from VSIX...**.
- Repeat the grouping and toolbar checks in a normal VS Code window.
