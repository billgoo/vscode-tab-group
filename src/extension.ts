import * as vscode from 'vscode';
import { WorkspaceState } from './models/WorkspaceState';
import { TabsView } from './providers/TreeView';

function activate(context: vscode.ExtensionContext) {
  WorkspaceState.use(context);
  context.subscriptions.push(new TabsView());
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
