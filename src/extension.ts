import * as vscode from 'vscode';
import { TabsView } from './TreeView';
import { WorkspaceState } from './WorkspaceState';

function activate(context: vscode.ExtensionContext) {
	const rootPath = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0))
	? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;

	WorkspaceState.use(context);
	
	context.subscriptions.push(new TabsView(rootPath));
}

// this method is called when your extension is deactivated
function deactivate() {}

// eslint-disable-next-line no-undef
module.exports = {
	activate,
	deactivate
}
