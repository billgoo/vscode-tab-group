import { randomUUID } from 'crypto';
import * as vscode from 'vscode';
import { safeRemove } from './Arrays';
import { getNextColorId } from './color';

import { JSONLikeTab, JSONLikeGroup, JSONLikeType, DataStore } from './TabsViewDataStore';

type Tab = Omit<JSONLikeTab, "inputId"> & {
	tab: vscode.Tab;
};

type Group = Omit<JSONLikeGroup, "children"> & {
	children: Tab[];
};

class UnimplementedError extends Error { } 

export class TabsView {
	private treeDataProvider: TreeDataProvider = new TreeDataProvider();

	constructor(context: vscode.ExtensionContext) {
		const initialState = this.initializeState();
		this.saveState(initialState);
		this.treeDataProvider.setState(initialState);

		const view = vscode.window.createTreeView('tabsTreeView', {
			treeDataProvider: this.treeDataProvider,
			dragAndDropController: this.treeDataProvider,
			canSelectMany: true
		});

		const explorerView = vscode.window.createTreeView('tabsTreeViewInExplorer', {
			treeDataProvider: this.treeDataProvider,
			dragAndDropController: this.treeDataProvider,
			canSelectMany: true
		});

		this.treeDataProvider.onDidChangeTreeData(() => {
			this.saveState(this.treeDataProvider.getState());
		});

		context.subscriptions.push(view);
		context.subscriptions.push(explorerView);

		context.subscriptions.push(vscode.commands.registerCommand('tabsTreeView.tab.close', (tab: Tab) => {
			vscode.window.tabGroups.close(tab.tab);
		}));

		context.subscriptions.push(vscode.commands.registerCommand('tabsTreeView.tab.ungroup', (tab: Tab) => {
			this.treeDataProvider.ungroup(tab);
		}));

		context.subscriptions.push(vscode.commands.registerCommand('tabsTreeView.UngroupAll', () => {
			DataStore.setState([]);
			const initialState = this.initializeState();
			this.treeDataProvider.setState(initialState);
		}));

		context.subscriptions.push(vscode.window.tabGroups.onDidChangeTabs(e => {
			this.treeDataProvider.removeTabs(e.closed);
			this.treeDataProvider.appendTabs(e.opened);
		}));

	}

	private initializeState(): Array<Tab | Group> {
		const restoredItems = DataStore.getState() ?? [];
		const currentTabs = vscode.window.tabGroups.all.flatMap(tabGroup => tabGroup.tabs);
		return this.mergeState(restoredItems, currentTabs);
	}

	private mergeState(restoredItems: Array<JSONLikeTab | JSONLikeGroup>, currentTabs: vscode.Tab[]): Array<Tab | Group> {
		const mergedTabs: Array<Tab | Group> = [];

		for (const restoredItem of restoredItems) {
			if (restoredItem.type === JSONLikeType.Tab) {
				const index = currentTabs.findIndex((currentTab) => this.isCorrespondingTab(currentTab, restoredItem));

				if (index !== -1) {
					mergedTabs.push({ ...restoredItem, tab: currentTabs[index] });
					currentTabs.splice(index, 1);
				}
			} else {
				const children: Tab[] = [];
				restoredItem.children.forEach(tab => {
					const index = currentTabs.findIndex((currentTab) => this.isCorrespondingTab(currentTab, tab));

					if (index !== -1) {
						children.push({ ...tab, tab: currentTabs[index]});
						currentTabs.splice(index, 1);
					}
				});

				if (children.length > 0) {
					mergedTabs.push({ ...restoredItem, children });
				}
			}
		}

		mergedTabs.push(...currentTabs.map<Tab>(tab => ({ type: JSONLikeType.Tab, groupId: null, tab })));

		return mergedTabs;
	}

	private saveState(state: Array<Tab | Group>): void {
		DataStore.setState(toJSONLikeState(state));
	}

	private isCorrespondingTab(tab: vscode.Tab, jsonTab: JSONLikeTab): boolean {
		try {
			return jsonTab.inputId === getNormalizedInputId(tab);
		} catch (_) {
			return false;
		}
	}	
}

function getNormalizedInputId(tab: vscode.Tab) {
	const { input } = tab;
	if (input instanceof vscode.TabInputText) {
		return input.uri.toString();
	}
	return (input as any).toString();
}

function toJsonLikeTab(tab: Tab): JSONLikeTab {
	return {
		type: JSONLikeType.Tab,
		groupId: null,
		inputId: getNormalizedInputId(tab.tab),
	};
}

function toJsonLikeGroup(group: Group): JSONLikeGroup {
	return {
		...group,
		children: group.children.map(child => ({ type: JSONLikeType.Tab, groupId: group.id, inputId: getNormalizedInputId(child.tab) })),
	};
}

function toJSONLikeState(state: Array<Tab | Group>): Array<JSONLikeTab | JSONLikeGroup> {
	return state.map(item => {
		if (item.type === JSONLikeType.Tab) {
			return toJsonLikeTab(item);
		}

		return toJsonLikeGroup(item);
	});
}


class TreeDataProvider implements vscode.TreeDataProvider<Tab | Group>, vscode.TreeDragAndDropController<Tab | Group> {
	private static TabDropMimeType = 'application/vnd.code.tree.tabstreeview';
	private _onDidChangeTreeData = new vscode.EventEmitter<void>();
	onDidChangeTreeData = this._onDidChangeTreeData.event;

	private root: Array<Tab | Group> = [];

	/**
	 * To reuse tree item object
	 */
	private treeItemMap: Record<string, vscode.TreeItem> = {};

	/**
	 * To quickly access group
	 */
	private groupMap: Record<string, Group> = {};
	
	/**
	 * To quickly access tab
	 */
	private tabMap: Record<string, Tab> = {};

	dropMimeTypes = [TreeDataProvider.TabDropMimeType];
	dragMimeTypes = ['text/uri-list'];

	getChildren(element?: Tab | Group): Array<Tab | Group> | null {
		if (!element) {
			return this.root;
		}
		if (element.type === JSONLikeType.Tab) {
			return null;
		}
		return element.children;
	}

	getTreeItem(element: Tab | Group): vscode.TreeItem {
		if (element.type === JSONLikeType.Tab) {
			const inputId = getNormalizedInputId(element.tab);
			if (!this.treeItemMap[inputId]) {
				this.treeItemMap[inputId] = this.createTabTreeItem(element);
			}
			return this.treeItemMap[inputId];
		}

		if (!this.treeItemMap[element.id]) {
			const treeItem = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Expanded);
			treeItem.contextValue = 'group';
			treeItem.iconPath = new vscode.ThemeIcon('layout-sidebar-left', new vscode.ThemeColor(element.colorId));
			this.treeItemMap[element.id] = treeItem;
		}
		return this.treeItemMap[element.id]
	}

	private createTabTreeItem(tab: Tab): vscode.TreeItem {
		if (tab.tab.input instanceof vscode.TabInputText) {
			const treeItem: vscode.TreeItem = new vscode.TreeItem(tab.tab.input.uri);
			treeItem.contextValue = 'tab';
			return treeItem;
		}
		// todo: implement other input types
		return {};
	}

	async handleDrop(target: Tab | Group | undefined, treeDataTransfer: vscode.DataTransfer, token: vscode.CancellationToken) {
		const draggeds: Array<JSONLikeGroup | JSONLikeTab> = treeDataTransfer.get(TreeDataProvider.TabDropMimeType)?.value ?? [];
		const isTab = (item: JSONLikeGroup | JSONLikeTab): item is JSONLikeTab => { return item.type === JSONLikeType.Tab; }
		const draggedTabs: Array<JSONLikeTab> = draggeds.filter<JSONLikeTab>(isTab);

		draggedTabs.forEach(jsonTab => this.moveTab(this.tabMap[jsonTab.inputId], target));
	
		this._onDidChangeTreeData.fire();
	}

	private moveTab(tab: Tab, target: Tab | Group| undefined) {
		if (target === undefined) {
			this._ungroup(tab);
			return;
		}
		
		if (target.type === JSONLikeType.Tab) {
			if (target.groupId === null) {
				const targetGroup: Group = {
					type: JSONLikeType.Group,
					id: randomUUID(),
					colorId: getNextColorId(),
					label: '',
					children: [target]
				};
				this.groupMap[targetGroup.id] = targetGroup;
				target.groupId = targetGroup.id;
				this.root.splice(this.root.indexOf(target), 1, targetGroup);
				this.moveTab(tab, targetGroup);
			} else {
				this.moveTab(tab, this.groupMap[target.groupId]);
			}
			return;
		}

		if (tab.groupId) {
			const fromGroup = this.groupMap[tab.groupId];
			safeRemove(fromGroup.children, tab);

			if (fromGroup.children.length === 0) {
				safeRemove(this.root, fromGroup);
				delete this.groupMap[fromGroup.id];
			}
		} else {
			safeRemove(this.root, tab);
		}

		tab.groupId = target.id;
		target.children.push(tab);
	}

	private _ungroup(tab: Tab) {
		if (tab.groupId === null) { // already in root
			return;
		}

		const group = this.groupMap[tab.groupId];
		if (!group) {
			tab.groupId = null;
			return;
		}

		tab.groupId = null;
		safeRemove(group.children, tab);

		if (group.children.length === 0) {
			safeRemove(this.root, group);
			delete this.groupMap[group.id];
		}

		this.root.push(tab);
	}

	public ungroup(tab: Tab) {
		this._ungroup(tab);
		this._onDidChangeTreeData.fire();
	}

	public removeTabs(originalTabs: readonly vscode.Tab[]) {
		originalTabs.forEach((originalTab) => {
			const inputId = getNormalizedInputId(originalTab);
			const tab = this.tabMap[inputId];
			if (tab.groupId) {
				safeRemove(this.groupMap[tab.groupId].children, tab);
			} else {
				safeRemove(this.root, tab);
			}
			delete this.tabMap[inputId];
		});

		this._onDidChangeTreeData.fire();
	}

	public appendTabs(originalTabs: readonly vscode.Tab[]) {
		originalTabs.forEach((originalTab) => {
			const inputId = getNormalizedInputId(originalTab);
			this.tabMap[inputId] = {
				type: JSONLikeType.Tab,
				groupId: null,
				tab: originalTab,
			};
			this.root.push(this.tabMap[inputId]);
		});

		this._onDidChangeTreeData.fire();
	}


	async handleDrag(source: Array<Tab | Group>, treeDataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): Promise<void> {
		treeDataTransfer.set(TreeDataProvider.TabDropMimeType, new vscode.DataTransferItem(toJSONLikeState(source)));
	}

	public getState(): Array<Tab | Group> {
		return this.root;
	}

	public setState(_state: Array<Tab | Group>) {
		this.root = _state;
		this.tabMap = {};
		this.groupMap = {};
		for (const item of this.root) {
			if (item.type === JSONLikeType.Tab) {
				this.tabMap[getNormalizedInputId(item.tab)] = item;
			} else {
				this.groupMap[item.id] = item;
			}
		}
		this._onDidChangeTreeData.fire();
	}
}
