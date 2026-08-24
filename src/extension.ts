import * as vscode from 'vscode';
import { WorkspaceState } from '@src/models/WorkspaceState';
import { TabsView } from '@src/providers/TreeView';

function activate(context: vscode.ExtensionContext) {
  try {
    WorkspaceState.use(context);
    // Delay TabsView creation for debugging to avoid potential activation hang
    context.subscriptions.push(new TabsView());
  } catch (err) {
    throw err;
  } finally {
  }
}

// this method is called when your extension is deactivated
function deactivate() {}

// eslint-disable-next-line no-undef
module.exports = {
  activate,
  deactivate,
};
