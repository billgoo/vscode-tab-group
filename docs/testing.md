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

| Command             | Coverage                                                                                                                                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`      | TypeScript style and static analysis.                                                                                                                                                                                                       |
| `npm run test:unit` | Grouping, ungrouping, lifecycle, and pure utility behavior.                                                                                                                                                                                 |
| `npm run compile`   | Strict TypeScript compilation.                                                                                                                                                                                                              |
| `npm run test:e2e`  | Extension-host smoke test for activation, Recent Tabs, Saved Groups, root URI sorting across root and grouped tabs, group-name sorting, independent group URI sort controls, supported tab-input normalization, and opaque-input rejection. |
| `npm run package`   | Production VSIX build and package contents.                                                                                                                                                                                                 |

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
- Try to drop a root tab into a group and a grouped tab onto the root while sorting; confirm both drops are ignored.
- Use the view-title ascending sort control to sort root tabs and every group's tabs by File URI A-Z, and root groups by name A-Z, then confirm it changes to the descending control and reverses all three orders on the next click.
- Use a group sort control and confirm it sorts only that group's children and changes only that group's next-sort direction.
- Sort one group, then confirm the view-title sort direction is unchanged and another group retains its own direction.
- Run a root sort after changing a group direction and confirm every group control resets to the root's next-sort direction.
- Confirm root tabs keep their root positions, group membership is unchanged, tabs in other groups are unchanged, and VS Code's native editor-tab order is unchanged.
- Use **Collapse All** and **Expand All** when available.
- Use **Reset All** and confirm that groups are removed while open tabs remain listed at the root.

### Persistence And Synchronization

- Collapse a group, run **Developer: Reload Window**, and confirm the group membership, order, and collapsed state are restored.
- Confirm the selected group color is restored after reloading the window.
- Open a file and confirm it appears in the tree; close its native editor tab and confirm it disappears.
- Select a tree item and confirm the corresponding editor becomes active.

### Saved Tab Groups

- Create a group containing at least two text files, then choose **Save Group...** from its context menu and enter a snapshot name.
- Expand the **Saved Groups** panel, which starts collapsed, and confirm the saved snapshot name and tab count appear.
- Use the single Saved Groups panel toolbar toggle to expand all snapshots and collapse them again.
- Confirm the Tabs view title bar has no **Restore Saved Group...** action; restore controls appear in the **Saved Groups** panel and the Command Palette.
- Expand the saved snapshot and confirm each saved file appears as a read-only child item.
- Save two files with the same name from different folders and confirm their child items show the shortest distinguishing parent paths.
- Remove one tab from the same live group, save it again, and confirm the existing snapshot updates its tab count instead of creating a second snapshot.
- Close both native editor tabs and confirm the live group disappears from the Tabs view.
- Use the snapshot's folder action and confirm both files reopen in a group with the saved label, color, order, and collapsed state.
- Add another tab to that live group, restore the snapshot again, and confirm the extra tab returns to the root list while the restored group matches the snapshot exactly.
- Restore the snapshot when one of its files is already open and confirm the file is reused instead of duplicated.
- Run **Developer: Reload Window** and confirm the snapshot remains available in the restore picker.
- Rename or remove one saved file, restore the snapshot, and confirm the available files reopen, a warning appears, and the snapshot remains available.
- Use the snapshot's trash action in the **Saved Groups** panel, confirm deletion, and verify it no longer appears in the panel or restore picker.
- Create two non-overlapping snapshots, use **Restore All Saved Groups** from the Saved Groups panel toolbar, and confirm both restore. When snapshots share a tab, confirm the shared tab remains in the first saved group shown in the panel.
- Include a missing file in a snapshot, use **Restore All Saved Groups**, and confirm the final warning reports the failed saved tab.
- Use **Delete All Saved Groups** from the panel toolbar, confirm deletion, and verify the panel and restore picker are empty.

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
