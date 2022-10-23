import * as vscode from 'vscode';
import { Group, Tab } from './types';

export class DataStore {
	private static readonly workspaceStateKey = 'tabs.workspace.state.key';
	private static context: vscode.ExtensionContext;

	static use(context: vscode.ExtensionContext) {
		DataStore.context = context;
	}

	static getState(): Array<Tab | Group> | undefined {
		return DataStore.context.workspaceState.get(DataStore.workspaceStateKey);
	}

	/**
	 * 
	 * @param state state information that can be "JSON.stringify"ed 
	 */
	static setState(state: Array<Tab | Group> | undefined) {
		DataStore.context.workspaceState.update(DataStore.workspaceStateKey, state);
	}
}
