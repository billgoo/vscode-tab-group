import * as vscode from 'vscode';
import { File, Folder } from './types';

export class WorkspaceState {
	private static readonly workspaceStateKey = 'tabs.workspace.state.key';
	private static context: vscode.ExtensionContext;

	static use(context: vscode.ExtensionContext) {
		WorkspaceState.context = context;
	}

	static getState(): Array<File | Folder> | undefined {
		return WorkspaceState.context.workspaceState.get(WorkspaceState.workspaceStateKey);
	}

	/**
	 * 
	 * @param state state information that can be "JSON.stringify"ed 
	 */
	static setState(state: Array<File | Folder> | undefined) {
		WorkspaceState.context.workspaceState.update(WorkspaceState.workspaceStateKey, state);
	}
}
