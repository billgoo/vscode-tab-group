
import * as vscode from 'vscode';
import { asPromise } from './async';
import { ContextKeys, setContext } from './context';
import { ExclusiveHandle } from './event';
import { Disposable } from './lifecycle';
import { getNativeTabs, TreeDataProvider } from './TreeDataProvider';
import { Group, isGroup, Tab, TreeItemType } from './types';
import { WorkspaceState } from './WorkspaceState';
import { getFilePathTree } from './utils';

export class TabsView extends Disposable {
	private treeExplorerDataProvider: TreeDataProvider = this._register(new TreeDataProvider());
	private treeOpenedDataProvider: TreeDataProvider = this._register(new TreeDataProvider(true));
	private exclusiveHandle = new ExclusiveHandle();

	constructor(private workspaceRoot: string | undefined) {
		super();
		let initialState: Array<Tab | Group> = [];

		if (workspaceRoot) {
			initialState = getFilePathTree(workspaceRoot);
		}

		// setContext(ContextKeys.AllCollapsed, this.treeOpenedDataProvider.isAllCollapsed());

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

		console.log(workspaceSavedState, initialState);
		/* ******** PACK OF REGISTRED EVENTS START ******** */

		// RESET
		this._register(vscode.commands.registerCommand('tabsTreeOpenView.reset', () => {
			WorkspaceState.setState([]);
			this.treeOpenedDataProvider.setState(initialState);
		}));

		// EDIT
		this._register(this.treeOpenedDataProvider.onDidChangeTreeData(() => this.saveState(this.treeOpenedDataProvider.getState())));
		// CLOSE
		this._register(vscode.commands.registerCommand('tabsTreeOpenView.tab.close', (tab: Tab) => vscode.window.tabGroups.close(getNativeTabs(tab))));
		// RENAME
		this._register(vscode.commands.registerCommand('tabsTreeOpenView.group.rename', (group: Group) => {
			vscode.window.showInputBox({ placeHolder: 'Name this Group' }).then(input => {
				if (input) {
					this.treeOpenedDataProvider.renameGroup(group, input);
				}
			})
		}));
		
		// CHANGING FILE IN WINDOW
		this._register(vscode.window.tabGroups.onDidChangeTabs(e => {
			this.treeOpenedDataProvider.appendTabs(e.opened);
			this.treeOpenedDataProvider.closeTabs(e.closed);
			
			if (e.changed[0] && e.changed[0].isActive) {
				const tab = this.treeOpenedDataProvider.getTab(e.changed[0]);
				if (tab) {
					if (openView.visible) {
						this.exclusiveHandle.run(() => asPromise(openView.reveal(tab, { select: true, expand: true })));
					}
				}
			}
			
			this.treeOpenedDataProvider.triggerRerender();
		}));
		
		// CLICK TO DIFFERENT ELEMENT
		this._register(openView.onDidChangeSelection(e => {
			if (e.selection.length > 0) {
				const item = e.selection[e.selection.length - 1];
				if (item.type === TreeItemType.Tab) {
					this.exclusiveHandle.run(() => asPromise(this.treeOpenedDataProvider.activate(item)));
				}
			}
		}));
		this._register(explorerView.onDidChangeSelection(e => {
			if (e.selection.length > 0) {
				const item = e.selection[e.selection.length - 1];
				if (item.type === TreeItemType.Tab) {
					this.exclusiveHandle.run(() => asPromise(this.treeExplorerDataProvider.activate(item)));
				}
			}
		}));


		// COLLAPSE / EXPAND
		this._register(vscode.commands.registerCommand('tabsTreeExplorerView.collapseAll', () => vscode.commands.executeCommand('list.collapseAll')));
		this._register(vscode.commands.registerCommand('tabsTreeExplorerView.expandAll', () => {
			for (const item of this.treeOpenedDataProvider.getState()) {
				if (isGroup(item) && item.children.length > 0) {
					openView.reveal(item, { expand: true });
				}
			}
		}));
		this._register(openView.onDidExpandElement((element) => {
			if (isGroup(element.element)) {
				this.treeOpenedDataProvider.setCollapsedState(element.element, false);
				this.saveState(this.treeOpenedDataProvider.getState());
				setContext(ContextKeys.AllCollapsed, false);
			}
		}));
		this._register(openView.onDidCollapseElement((element) => {
			if (isGroup(element.element)) {
				this.treeOpenedDataProvider.setCollapsedState(element.element, true);
				this.saveState(this.treeOpenedDataProvider.getState());
				setContext(ContextKeys.AllCollapsed, this.treeOpenedDataProvider.isAllCollapsed());
			}
		}));

		// GROUPING
		this._register(vscode.commands.registerCommand('tabsTreeOpenView.tab.ungroup', (tab: Tab) => this.treeOpenedDataProvider.ungroup(tab)));
		this._register(vscode.commands.registerCommand('tabsTreeOpenView.group.cancelGroup', (group: Group) => this.treeOpenedDataProvider.cancelGroup(group)));

		/* ******** PACK OF REGISTRED EVENTS END ******** */
	}

	private initializeOpenedState(): Array<Tab | Group> {
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

	private saveState(state: Array<Tab | Group>): void {
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
