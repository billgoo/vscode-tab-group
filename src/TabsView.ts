import { randomUUID } from 'crypto';
import * as vscode from 'vscode';
import { safeRemove } from './Arrays';
import { getNextColorId } from './color';
import { getHandler } from './TabTypeHandler';

import { JSONLikeTab, JSONLikeGroup, JSONLikeType, DataStore } from './TabsViewDataStore';
import { ExclusiveHandle } from './event';
import { asPromise } from './async';

type Tab = JSONLikeTab;

type Group = Omit<JSONLikeGroup, "children"> & {
	children: Tab[];
};

class UnimplementedError extends Error {
	constructor(message?: string) {
		super(message);
	}
}

export class TabsView {
	private treeDataProvider: TreeDataProvider = new TreeDataProvider();
	private exclusiveHandle = new ExclusiveHandle();

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
			canSelectMany: true,
		});

		this.treeDataProvider.onDidChangeTreeData(() => this.saveState(this.treeDataProvider.getState()));

		context.subscriptions.push(view);
		context.subscriptions.push(explorerView);

		context.subscriptions.push(vscode.commands.registerCommand('tabsTreeView.tab.close', (tab: Tab) => vscode.window.tabGroups.close(getNativeTabs(tab))));

		context.subscriptions.push(vscode.commands.registerCommand('tabsTreeView.tab.ungroup', (tab: Tab) => this.treeDataProvider.ungroup(tab)));

		context.subscriptions.push(vscode.commands.registerCommand('tabsTreeView.UngroupAll', () => {
			DataStore.setState([]);
			const initialState = this.initializeState();
			this.treeDataProvider.setState(initialState);
		}));

		context.subscriptions.push(vscode.window.tabGroups.onDidChangeTabs(e => {
			this.treeDataProvider.appendTabs(e.opened);
			this.treeDataProvider.removeTabs(e.closed);

			if (e.changed[0] && e.changed[0].isActive) {
				const tab = this.treeDataProvider.getTab(e.changed[0]);
				if (tab) {
					this.exclusiveHandle.run(() => {
						const viewToReveal = view.visible ? view : explorerView;
						return asPromise(viewToReveal.reveal(tab, { select: true, expand: true }));
					});
				}
			}

			this.treeDataProvider.triggerRerender();
		}));

		context.subscriptions.push(view.onDidChangeSelection(e => {
			if (e.selection.length > 0) {
				const item = e.selection[e.selection.length - 1];
				if (item.type === JSONLikeType.Tab) {
					this.exclusiveHandle.run(() => asPromise(this.treeDataProvider.activate(item)));
				}
			}
		}));

		context.subscriptions.push(explorerView.onDidChangeSelection(e => {
			if (e.selection.length > 0) {
				const item = e.selection[e.selection.length - 1];
				if (item.type === JSONLikeType.Tab) {
					this.exclusiveHandle.run(() => asPromise(this.treeDataProvider.activate(item)));
				}
			}
		}));
	}

	private initializeState(): Array<Tab | Group> {
		const jsonItems = DataStore.getState() ?? [];
		const nativeTabs = vscode.window.tabGroups.all.flatMap(tabGroup => tabGroup.tabs);
		return this.mergeState(jsonItems, nativeTabs);
	}

	private mergeState(jsonItems: Array<JSONLikeTab | JSONLikeGroup>, nativeTabs: vscode.Tab[]): Array<Tab | Group> {
		const mergedTabs: Array<Tab | Group> = [];

		for (const jsonItem of jsonItems) {
			if (jsonItem.type === JSONLikeType.Tab) {
				const correspondingTabs = nativeTabs.filter((nativeTab) => this.isCorrespondingTab(nativeTab, jsonItem));

				if (correspondingTabs.length > 0) {
					mergedTabs.push(jsonItem);
					correspondingTabs.forEach(tab => safeRemove(nativeTabs, tab));
				}
			} else {
				const children: Tab[] = [];
				jsonItem.children.forEach(tab => {
					const correspondingTabs = nativeTabs.filter((nativeTab) => this.isCorrespondingTab(nativeTab, tab));

					if (correspondingTabs.length > 0) {
						children.push(tab);
						correspondingTabs.forEach(tab => safeRemove(nativeTabs, tab));
					}
				});

				if (children.length > 0) {
					mergedTabs.push({ ...jsonItem, children });
				}
			}
		}

		const tabMap: Record<string, Tab> = {};
		nativeTabs.forEach(tab => {
			try {
				const id = getNormalizedInputId(tab);
				if (!tabMap[id]) {
					tabMap[id] = { type: JSONLikeType.Tab, groupId: null, inputId: getNormalizedInputId(tab) };
					mergedTabs.push(tabMap[id]);
				}
			} catch {
				// won't add unimplemented tab into tree
			}
		})

		return mergedTabs;
	}

	private saveState(state: Array<Tab | Group>): void {
		DataStore.setState(toJSONLikeState(state));
	}

	private isCorrespondingTab(tab: vscode.Tab, jsonTab: JSONLikeTab): boolean {
		try {
			return jsonTab.inputId === getNormalizedInputId(tab);
		} catch {
			return false;
		}
	}	
}

function getNormalizedInputId(tab: vscode.Tab): string {
	const handler = getHandler(tab);
	if (!handler) {
		throw new UnimplementedError();
	}
	return handler.getNormalizedId(tab);
}

function toJsonLikeTab(tab: Tab): JSONLikeTab {
	return {
		type: JSONLikeType.Tab,
		groupId: null,
		inputId: tab.inputId,
	};
}

function toJsonLikeGroup(group: Group): JSONLikeGroup {
	return {
		...group,
		children: group.children.map(child => ({ type: JSONLikeType.Tab, groupId: group.id, inputId: child.inputId })),
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

function getNativeTabs(tab: Tab): vscode.Tab[] {
	const currentNativeTabs = vscode.window.tabGroups.all.flatMap(tabGroup => tabGroup.tabs);
	return currentNativeTabs.filter(nativeTab => {
		const handler = getHandler(nativeTab);
		return tab.inputId === handler?.getNormalizedId(nativeTab);
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
			const inputId = element.inputId;
			if (!this.treeItemMap[inputId]) {
				this.treeItemMap[inputId] = this.createTabTreeItem(element);
			}
			this.treeItemMap[inputId].contextValue = element.groupId === null ? 'tab' : 'grouped-tab';
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

	getParent(element: Tab | Group) {
		if (element.type === JSONLikeType.Group) {
			return undefined;
		}
		
		if (element.groupId === null) {
			return undefined;
		}

		return this.groupMap[element.groupId];
	}

	private createTabTreeItem(tab: Tab): vscode.TreeItem {
		const nativeTabs = getNativeTabs(tab);
		if (nativeTabs.length === 0) {
			// todo: remove tab without any native Tab
			return {};
		}
		const handler = getHandler(nativeTabs[0])!;
		const treeItem = handler.createTreeItem(nativeTabs[0]);
		return treeItem;
	}

	async handleDrop(target: Tab | Group | undefined, treeDataTransfer: vscode.DataTransfer, token: vscode.CancellationToken) {
		const draggeds: Array<JSONLikeGroup | JSONLikeTab> = treeDataTransfer.get(TreeDataProvider.TabDropMimeType)?.value ?? [];
		const isTab = (item: JSONLikeGroup | JSONLikeTab): item is JSONLikeTab => { return item.type === JSONLikeType.Tab; }
		const draggedTabs: Array<JSONLikeTab> = draggeds.filter<JSONLikeTab>(isTab).filter(dragged => {
			// get rid of dropping the tab on itself
			return !(target?.type === JSONLikeType.Tab && target.inputId === dragged.inputId);
		});

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

	public removeTabs(nativeTabs: readonly vscode.Tab[]) {
		nativeTabs.forEach((nativeTab) => {
			try {
				const inputId = getNormalizedInputId(nativeTab);
				const tab = this.tabMap[inputId];
				const nativeTabs = getNativeTabs(tab);
				if (nativeTabs.length === 0) { // no more native Tabs for this ext Tab, delete it from ext tree
					if (tab.groupId) {
						safeRemove(this.groupMap[tab.groupId].children, tab);
					} else {
						safeRemove(this.root, tab);
					}
					delete this.tabMap[inputId];
				}

			} catch {
				// skip
			}
		});
	}

	public appendTabs(nativeTabs: readonly vscode.Tab[]) {
		nativeTabs.forEach((nativeTab) => {
			try {
				const inputId = getNormalizedInputId(nativeTab);
				if (!this.tabMap[inputId]) {
					this.tabMap[inputId] = {
						type: JSONLikeType.Tab,
						groupId: null,
						inputId: inputId,
					};
					this.root.push(this.tabMap[inputId]);
				}

			} catch {
				// skip
			}
		});
	}

	async handleDrag(source: Array<Tab | Group>, treeDataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): Promise<void> {
		treeDataTransfer.set(TreeDataProvider.TabDropMimeType, new vscode.DataTransferItem(toJSONLikeState(source)));
	}

	public getState(): Array<Tab | Group> {
		return this.root;
	}

	/**
	 * Set tree data state, will trigger rerendering
	 * @param _state 
	 */
	public setState(_state: Array<Tab | Group>) {
		this.root = _state;
		this.tabMap = {};
		this.groupMap = {};
		for (const item of this.root) {
			if (item.type === JSONLikeType.Tab) {
				this.tabMap[item.inputId] = item;
			} else {
				this.groupMap[item.id] = item;
			}
		}
		this._onDidChangeTreeData.fire();
	}

	public async activate(tab: Tab): Promise<any> {
		const nativeTabs = getNativeTabs(tab);
		const handler = getHandler(nativeTabs[0])!;
		return handler.openEditor(nativeTabs[0]);
	}

	public getTab(nativeTab: vscode.Tab): Tab | undefined {
		const inputId = getNormalizedInputId(nativeTab);
		return this.tabMap[inputId];
	}

	public triggerRerender() {
		this._onDidChangeTreeData.fire();
	}
}
