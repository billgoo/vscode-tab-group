import * as vscode from 'vscode';
import { SavedGroupsStore } from './services/SavedGroupsStore';
import { WorkspaceStateStore } from './services/WorkspaceStateStore';
import { TabsView } from './providers/TreeView';

function activate(context: vscode.ExtensionContext) {
  const workspaceStateStore = new WorkspaceStateStore(context.workspaceState);
  const savedGroupsStore = new SavedGroupsStore(context.workspaceState);
  context.subscriptions.push(new TabsView(workspaceStateStore, savedGroupsStore));
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
