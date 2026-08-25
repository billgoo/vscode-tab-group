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

| Command             | Coverage                                                                  |
| ------------------- | ------------------------------------------------------------------------- |
| `npm run lint`      | TypeScript style and static analysis.                                     |
| `npm run test:unit` | Grouping, ungrouping, lifecycle, and pure utility behavior.               |
| `npm run compile`   | Strict TypeScript compilation.                                            |
| `npm run test:e2e`  | Extension-host smoke test for activation and public command registration. |
| `npm run package`   | Production VSIX build and package contents.                               |

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

### Unsaved File Decoration

- Modify an open text file without saving and confirm the unsaved decoration appears in the tree.
- Save the file and confirm the decoration disappears.

### Packaged Extension

- Run `npm run package`.
- Install `tab-group-<version>.vsix` with **Extensions: Install from VSIX...**.
- Repeat the grouping and toolbar checks in a normal VS Code window.
