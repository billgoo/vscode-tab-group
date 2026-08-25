# Change Log

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
