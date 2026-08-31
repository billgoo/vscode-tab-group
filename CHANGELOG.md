# Change Log

## 3.1.0

- Enhancements:
  - Add Tree View mode and configurable root, group, and saved-group sorting controls.
  - Synchronize the Tabs tree with the active editor and reveal its parent group or folder when needed.
  - Show input-less system editor tabs such as Settings and Keyboard Shortcuts in the Tabs view.
- Fix bugs:
  - Save restorable tabs from mixed groups and preserve open live-only system tabs when restoring a saved group.
  - Improve saved-group and workspace-state persistence across reloads and repeated tab events.
  - Close the selected tab correctly from the keyboard or Command Palette.
  - Guard destructive group and snapshot actions with appropriate confirmations and visibility conditions.

## 3.0.1

- Enhancements:
  - Add Recent Tabs for ungrouped tabs, with most-recently-activated ordering.
  - Add notebook and notebook-diff tab support with stable identities.
  - Add configurable group colors.
  - Add Saved Groups snapshots with restore, delete, and workspace persistence support.
  - Add release automation that validates, packages, and attaches VSIX files to GitHub Releases.
- Fix bugs:
  - Preserve existing tab and group state while native tabs are opened, closed, or reloaded.
  - Avoid duplicate tree entries when native tab events repeat an already tracked tab.
  - Migrate legacy custom-editor and notebook identities without losing existing workspace state.

## 3.0.0

- Refactors:
  - Refactor the extension to use the new VS Code TreeView API for better performance and maintainability.
- Enhancements:
  - Add support for notebook editor tabs in the Tab Group view.
  - Show an unsaved-file indicator for modified text editors.
  - Add automated lint, unit, extension-host, packaging, and Marketplace release workflows.
  - Add documented local testing, release preflight, VSIX packaging, and tagged release procedures.
- Fix bugs:
  - Prevent orphaned diff tabs from remaining in the Tab Group view.
  - Avoid duplicate grouping work when tabs are dropped in normal grouping mode.

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
