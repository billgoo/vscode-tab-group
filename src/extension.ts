import * as vscode from 'vscode';
import { WorkspaceStateStore } from './services/WorkspaceStateStore';
import { TabsView } from './providers/TreeView';

function activate(context: vscode.ExtensionContext) {
  const workspaceStateStore = new WorkspaceStateStore(context.workspaceState);
  context.subscriptions.push(new TabsView(workspaceStateStore));
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
