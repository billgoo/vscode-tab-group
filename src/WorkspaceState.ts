import * as vscode from 'vscode';
import { Group, Tab } from './types';

export class WorkspaceState {
	private static readonly workspaceStateKey = 'tabs.workspace.state.key';
	private static context: vscode.ExtensionContext;

	static use(context: vscode.ExtensionContext) {
		WorkspaceState.context = context;
	}

	static getState(): Array<Tab | Group> | undefined {
		return WorkspaceState.context.workspaceState.get(WorkspaceState.workspaceStateKey);
	}

	/**
	 * 
	 * @param state state information that can be "JSON.stringify"ed 
	 */
	static setState(state: Array<Tab | Group> | undefined) {
		WorkspaceState.context.workspaceState.update(WorkspaceState.workspaceStateKey, state);
	}
}
