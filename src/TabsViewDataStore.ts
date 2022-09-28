import * as vscode from 'vscode';

export const enum JSONLikeType {
	Tab,
	Group,
};

export type JSONLikeGroup = {
	readonly type: JSONLikeType.Group;
	readonly id: string;
	colorId: string;
	label: string;
	children: JSONLikeTab[];
};

export type JSONLikeTab = {
	readonly type: JSONLikeType.Tab;
	groupId: string | null;
	inputId: string;
};

export class DataStore {
	private static readonly workspaceStateKey = 'tabs.workspace.state.key';
	private static context: vscode.ExtensionContext;

	static use(context: vscode.ExtensionContext) {
		DataStore.context = context;
	}

	static getState(): Array<JSONLikeTab | JSONLikeGroup> | undefined {
		return DataStore.context.workspaceState.get(DataStore.workspaceStateKey);
	}

	/**
	 * 
	 * @param state state information that can be "JSON.stringify"ed 
	 */
	static setState(state: Array<JSONLikeTab | JSONLikeGroup> | undefined) {
		DataStore.context.workspaceState.update(DataStore.workspaceStateKey, state);
	}
}
