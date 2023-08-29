
import * as vscode from 'vscode';
import { asPromise, updateIds } from './utils';
import { ExclusiveHandle } from './event';
import { Disposable } from './lifecycle';
import { TreeDataProvider } from './TreeDataProvider';
import { File, Folder, TreeItemType } from './types';
import { WorkspaceState } from './WorkspaceState';
import { getFilePathTree } from './utils';

export class TabsView extends Disposable {
	private treeExplorerDataProvider: TreeDataProvider = this._register(new TreeDataProvider());
	private treeOpenedDataProvider: TreeDataProvider = this._register(new TreeDataProvider());
	private exclusiveHandle = new ExclusiveHandle();

	constructor(private workspaceRoot: string | undefined) {
		super();
		let initialState: Array<File | Folder> = [];

		if (workspaceRoot) {
			initialState = getFilePathTree(workspaceRoot);
		}

		// EXPLORER VIEW CREATION
		this.treeExplorerDataProvider.setState(initialState);
		const explorerView = this._register(vscode.window.createTreeView('tabsTreeExplorerView', {
			treeDataProvider: this.treeExplorerDataProvider,
			canSelectMany: true
		}));

		// OPENED VIEW CREATION
		const workspaceSavedState = this.initializeOpenedState();
		this.saveState(workspaceSavedState);
		this.treeOpenedDataProvider.setState(workspaceSavedState);
		const openView = this._register(vscode.window.createTreeView('tabsTreeOpenView', {
			treeDataProvider: this.treeOpenedDataProvider,
			dragAndDropController: this.treeOpenedDataProvider,
			canSelectMany: true
		}));

		/* ******** PACK OF REGISTRED EVENTS START ******** */

		// EDIT
		this._register(this.treeOpenedDataProvider.onDidChangeTreeData(() => this.saveState(this.treeOpenedDataProvider.getState())));
		// RENAME
		this._register(vscode.commands.registerCommand('tabsTreeOpenView.rename', (element: File | Folder ) => {
			vscode.window.showInputBox({ placeHolder: 'Type name here', value: element.label }).then(input => {
				if (input) {
					this.treeOpenedDataProvider.rename(element, input);
				}
			})
		}));

		this._register(this.treeExplorerDataProvider)

		// CLICK TO DIFFERENT ELEMENT
		this._register(openView.onDidChangeSelection(e => {
			if (e.selection.length > 0) {
				const item = e.selection[e.selection.length - 1];
				if (item.type === TreeItemType.File) {
					this.exclusiveHandle.run(() => asPromise(this.treeOpenedDataProvider.openFile(item)));
				}
			}
		}));
		this._register(explorerView.onDidChangeSelection(e => {
			if (e.selection.length > 0) {
				const item = e.selection[e.selection.length - 1];
				if (item.type === TreeItemType.File) {
					this.exclusiveHandle.run(() => asPromise(this.treeExplorerDataProvider.openFile(item)));
				}
			}
		}));

		/* ********** CUSTOM GROUPS ********** */

		// ADD TO OPEN
		this._register(vscode.commands.registerCommand('tabsTreeExplorerView.addToOpen', (element: File | Folder) => {
			const currentState = this.treeOpenedDataProvider.getState();

			// We have to update ID's if we need to keep different folder versions in one page
			const elementWithCustomIds = updateIds(element);
			this.treeOpenedDataProvider.setState([...currentState, elementWithCustomIds]);
		}));

		this._register(vscode.commands.registerCommand('tabsTreeOpenView.close', (element: File | Folder) => {
			this.treeOpenedDataProvider.deleteById(element.id);
		}));

		// RESET
		this._register(vscode.commands.registerCommand('tabsTreeOpenView.reset', () => {
			WorkspaceState.setState([]);
			this.treeOpenedDataProvider.setState(initialState);
		}));

		/* ******** PACK OF REGISTRED EVENTS END ******** */
	}

	private initializeOpenedState(): Array<File | Folder> {
		const jsonItems = WorkspaceState.getState() ?? [];
		// const nativeTabs = vscode.window.tabGroups.all.flatMap(tabGroup => tabGroup.tabs);

		return jsonItems
	}

	// private mergeState(jsonItems: Array<Tab | Group>, nativeTabs: vscode.Tab[]): Array<Tab | Group> {
	// 	const mergedTabs: Array<Tab | Group> = [];

	// 	for (const jsonItem of jsonItems) {
	// 		if (jsonItem.type === TreeItemType.Tab) {
	// 			const length = nativeTabs.length;
	// 			nativeTabs = nativeTabs.filter((nativeTab) => !this.isCorrespondingTab(nativeTab, jsonItem));
	// 			if (nativeTabs.length < length) {
	// 				mergedTabs.push(jsonItem);
	// 			}
	// 		} else {
	// 			const children: Tab[] = [];
	// 			jsonItem.children.forEach(tab => {
	// 				const length = nativeTabs.length;
	// 				nativeTabs = nativeTabs.filter((nativeTab) => !this.isCorrespondingTab(nativeTab, tab));

	// 				if (nativeTabs.length < length) {
	// 					children.push(tab);
	// 				}
	// 			});

	// 			if (children.length > 0) {
	// 				mergedTabs.push({ ...jsonItem, children });
	// 			}
	// 		}
	// 	}

	// 	const tabMap: Record<string, Tab> = {}; // if there are same resources in multiple tab group, add only one
	// 	nativeTabs.forEach(tab => {
	// 		try {
	// 			const id = getNormalizedTabId(tab);
	// 			if (!tabMap[id]) {
	// 				tabMap[id] = { type: TreeItemType.Tab, groupId: null, id };
	// 				mergedTabs.push(tabMap[id]);
	// 			}
	// 		} catch {
	// 			// won't add unimplemented-typed tab into tree
	// 		}
	// 	})

	// 	return mergedTabs;
	// }

	private saveState(state: Array<File | Folder>): void {
		WorkspaceState.setState(state);
	}

	// private isCorrespondingTab(tab: vscode.Tab, jsonTab: Tab): boolean {
	// 	try {
	// 		return jsonTab.id === getNormalizedTabId(tab);
	// 	} catch {
	// 		return false;
	// 	}
	// }
}
