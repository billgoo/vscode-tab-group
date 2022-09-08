import * as vscode from 'vscode';
import { TabsView } from './TabsView';
import { DataStore } from './TabsViewDataStore';

function activate(context: vscode.ExtensionContext) {
	DataStore.use(context);

	new TabsView(context);
}

// this method is called when your extension is deactivated
function deactivate() {}

// eslint-disable-next-line no-undef
module.exports = {
	activate,
	deactivate
}
