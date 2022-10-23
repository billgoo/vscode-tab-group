import * as vscode from 'vscode';
import { DataStore } from './TabsViewDataStore';
import { TabsView } from './TreeView';

function activate(context: vscode.ExtensionContext) {
	DataStore.use(context);
	context.subscriptions.push(new TabsView());
}

// this method is called when your extension is deactivated
function deactivate() {}

// eslint-disable-next-line no-undef
module.exports = {
	activate,
	deactivate
}
