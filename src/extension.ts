import * as vscode from 'vscode';
import { SavedGroupsStore } from './services/SavedGroupsStore';
import { WorkspaceStateStore } from './services/WorkspaceStateStore';
import { TabsView } from './providers/TreeView';
import { SerialTaskQueue } from './utils/async';

function activate(context: vscode.ExtensionContext) {
  const writeQueue = new SerialTaskQueue();
  const workspaceStateStore = new WorkspaceStateStore(context.workspaceState, writeQueue);
  const savedGroupsStore = new SavedGroupsStore(context.workspaceState, writeQueue);
  context.subscriptions.push(new TabsView(workspaceStateStore, savedGroupsStore));
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
