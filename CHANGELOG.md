# Change Log

## 2.1.0

- Enhancements:
  - **Group by Parent Folder**: groups tabs automatically, and labels each group with the full folder path relative to the workspace root (e.g. `src/utils`). Files sitting directly at the workspace root are grouped under `/`.
  - **Single-tab directories are now grouped**: every directory gets its own group when "Group by Parent Folder" is active, even if only one file from that directory is open.
  - **Merge on new tabs**: when "Group by Parent Folder" is active and a new tab is opened from a folder that already has a group, the tab is automatically added to the existing group instead of creating a duplicate.
  - **Groups sorted alphabetically after grouping**: after "Group by Parent Folder" runs, groups are sorted alphabetically; ungrouped tabs (if any) appear at the top.
  - **Persistent view modes**: "Group by Parent Folder" and all Sort modes now stay active across sessions. New tabs automatically conform to the active configuration when opened. Modes are saved to workspace state and restored on startup.
  - **Visual active indicator**: active toolbar buttons switch to a filled green icon (`$(pass-filled)`) so it is clear which modes are on. Clicking the active icon toggles the mode off.
  - **Sort buttons in toolbar**: Sort commands are now individual inline toolbar buttons (Sort All, Sort Groups, Sort Tabs) instead of a collapsed `...` menu, each with a distinct icon.
  - **Reset All moved to right**: the Reset All button is placed at the rightmost position in the toolbar (navigation group 99).
  - **Trailing drop-target row removed**: the invisible Slot row that appeared at the end of each group in the tree is no longer rendered.
  - **Drag-and-drop grouping and sorting always available**: tabs and groups can be reordered or grouped manually by dragging at any time — no need to activate a Sort mode first.

## 2.0.4

- Enhancements:
  - Show file path as normal tab to distinct file with same name for file type tabs.

## 2.0.3

- Enhancements:
  - Add close all tabs in a group functionality.
  - Set existing group name in the rename input field.
  - Improve group color usage.
- Fix bugs:
  - Fix displaying the group name in the tree when creating a group.

## 2.0.2

- Delete the tab view in explorer. (User can drag the other one to explorer).
