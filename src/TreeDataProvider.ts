import * as vscode from 'vscode';
import { Disposable } from './lifecycle';
import { getHandler, getNormalizedTabId } from './TabTypeHandler';
import { TreeData } from './TreeData';
import { Group, TreeItemType, Tab, isTab, Slot, isGroup, isSlot } from './types';

export function getNativeTabs(tab: Tab): vscode.Tab[] {
	const currentNativeTabs = vscode.window.tabGroups.all.flatMap(tabGroup => tabGroup.tabs);
	return currentNativeTabs.filter(nativeTab => {
		const handler = getHandler(nativeTab);
		return tab.id === handler?.getNormalizedId(nativeTab);
	});
}

export class TreeDataProvider extends Disposable implements vscode.TreeDataProvider<Tab | Group | Slot>, vscode.TreeDragAndDropController<Tab | Group | Slot> {
	private static TabDropMimeType = 'application/vnd.code.tree.tabstreeview';
	private _onDidChangeTreeData = this._register(new vscode.EventEmitter<void>());
	onDidChangeTreeData = this._onDidChangeTreeData.event;

	private treeData: TreeData = new TreeData();

	/**
	 * To reuse tree item object
	 */
	private treeItemMap: Record<string, vscode.TreeItem> = {};

	private sortMode = false;

	dropMimeTypes = [TreeDataProvider.TabDropMimeType];
	dragMimeTypes = ['text/uri-list'];

	getChildren(element?: Tab | Group): Array<Tab | Group | Slot> | null {
		const children = this.treeData.getChildren(element);

		if (this.sortMode && Array.isArray(children) && children.length > 0) {
			let groupId = isGroup(children[0]) ? null : children[0].groupId;
			const slottedChildren: Array<Tab | Group | Slot> = children.slice(0);
			slottedChildren.push({ type: TreeItemType.Slot, index: children.length, groupId });
			return slottedChildren;
		}

		return children;
	}

	getTreeItem(element: Tab | Group | Slot): vscode.TreeItem {
		if (element.type === TreeItemType.Tab) {
			const tabId = element.id;
			if (!this.treeItemMap[tabId]) {
				this.treeItemMap[tabId] = this.createTabTreeItem(element);
			}
			this.treeItemMap[tabId].contextValue = element.groupId === null ? 'tab' : 'grouped-tab';
			return this.treeItemMap[tabId];
		}

		if (element.type === TreeItemType.Slot) {
			const treeItem = new vscode.TreeItem('');
			treeItem.iconPath = new vscode.ThemeIcon('indent');
			return treeItem;
		}

		if (!this.treeItemMap[element.id]) {
			const treeItem = new vscode.TreeItem(element.label, element.collapsed ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.Expanded);
			treeItem.contextValue = 'group';
			treeItem.iconPath = new vscode.ThemeIcon('layout-sidebar-left', new vscode.ThemeColor(element.colorId));
			this.treeItemMap[element.id] = treeItem;
		} else {
			const treeItem = this.treeItemMap[element.id];
			treeItem.label = element.label;
			treeItem.iconPath = new vscode.ThemeIcon('layout-sidebar-left', new vscode.ThemeColor(element.colorId));
		}
		return this.treeItemMap[element.id]
	}

	getParent(element: Tab | Group) {
		return this.treeData.getParent(element);
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

	async handleDrag(source: Array<Tab | Group | Slot>, treeDataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): Promise<void> {
		treeDataTransfer.set(TreeDataProvider.TabDropMimeType, new vscode.DataTransferItem(source.filter(item => !isSlot(item))));
	}

	async handleDrop(target: Tab | Group | Slot | undefined, treeDataTransfer: vscode.DataTransfer, token: vscode.CancellationToken) {
		const draggeds: Array<Group | Tab> = (treeDataTransfer.get(TreeDataProvider.TabDropMimeType)?.value ?? []).filter((tab: any) => tab !== target);

		if (this.sortMode) {
			this.doHandleSorting(target, draggeds);
		} else {
			if (target && isSlot(target)) {
				return; // should not have slot in group mode
			}
			
			this.doHandleGrouping(target, draggeds.filter<Tab>(isTab));	
		}

		this._onDidChangeTreeData.fire();
	}

	private doHandleSorting(target: Tab | Group | Slot | undefined, draggeds: Array<Tab | Group>) {
		if (target === undefined) {
			this.treeData.pushBack(null, draggeds);
		} else if (isSlot(target)) {
			this.treeData.pushBack(target.groupId, draggeds);
		} else {
			this.treeData.moveTo(target, draggeds);
		}
	}

	private doHandleGrouping(target: Tab | Group | undefined, tabs: Tab[]) {
		if (target === undefined) {
			this.treeData.ungroup(tabs, true);
		} else {
			const isCreatingNewGroup = isTab(target) && target.groupId === null && tabs.length > 0;
			this.treeData.group(target, tabs);
			
			if (isCreatingNewGroup && tabs[0].groupId !== null) {
				const group = this.treeData.getGroup(tabs[0].groupId);
				if (group) {
					vscode.window.showInputBox({ placeHolder: 'Name this Group' }).then(input => {
						if (input) {
							this.treeData.renameGroup(group, input);
							this.triggerRerender();
						}
					});
				}
			}
		}
	}

	public triggerRerender() {
		this._onDidChangeTreeData.fire();
	}

	public setState(state: Array<Tab | Group>) {
		this.treeData.setState(state);
		this.triggerRerender();
	}

	public async activate(tab: Tab): Promise<any> {
		const nativeTabs = getNativeTabs(tab);
		const handler = getHandler(nativeTabs[0])!;
		return handler.openEditor(nativeTabs[0]);
	}

	public appendTabs(nativeTabs: readonly vscode.Tab[]) {
		nativeTabs.forEach((nativeTab) => {
			try {
				const tabId = getNormalizedTabId(nativeTab);
				this.treeData.appendTab(tabId);
			} catch {
				// skip
			}
		});
	}

	public closeTabs(nativeTabs: readonly vscode.Tab[]) {
		nativeTabs.forEach((nativeTab) => {
			try {
				const tabId = getNormalizedTabId(nativeTab);
				const tab = this.treeData.getTab(tabId);
				if (tab && getNativeTabs(tab).length === 0) {
					this.treeData.deleteTab(tabId);
				}
			} catch {
				// skip
			}
		});
	}

	public getTab(nativeTab: vscode.Tab): Tab | undefined {
		try {
			const tabId = getNormalizedTabId(nativeTab);
			return this.treeData.getTab(tabId);
		} catch {
			return undefined;
		}
	}

	public getState(): Array<Tab | Group> {
		return this.treeData.getState();
	}

	public ungroup(tab: Tab) {
		this.treeData.ungroup([tab]);
		this.triggerRerender();
	}

	public renameGroup(group: Group, input: string): void {
		this.treeData.renameGroup(group, input);
		this.triggerRerender();
	}

	public cancelGroup(group: Group): void {
		this.treeData.cancelGroup(group);
		this.triggerRerender();
	}

	
	public toggleSortMode(sortMode: boolean) {
		this.sortMode = sortMode;
		this.triggerRerender();
	}

	public isAllCollapsed(): boolean {
		return this.treeData.isAllCollapsed();
	}

	public setCollapsedState(group: Group, collapsed: boolean) {
		this.treeData.setCollapsedState(group, collapsed);
		// sync data from tree view, so rerendering is not needed
	}
}
