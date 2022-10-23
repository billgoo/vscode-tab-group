import * as vscode from 'vscode';
import { Disposable } from './lifecycle';
import { getHandler, getNormalizedTabId } from './TabTypeHandler';
import { TreeData } from './TreeData';
import { Group, TreeItemType, Tab, isTab } from './types';

export function getNativeTabs(tab: Tab): vscode.Tab[] {
	const currentNativeTabs = vscode.window.tabGroups.all.flatMap(tabGroup => tabGroup.tabs);
	return currentNativeTabs.filter(nativeTab => {
		const handler = getHandler(nativeTab);
		return tab.id === handler?.getNormalizedId(nativeTab);
	});
}

export class TreeDataProvider extends Disposable implements vscode.TreeDataProvider<Tab | Group>, vscode.TreeDragAndDropController<Tab | Group> {
	private static TabDropMimeType = 'application/vnd.code.tree.tabstreeview';
	private _onDidChangeTreeData = this._register(new vscode.EventEmitter<void>());
	onDidChangeTreeData = this._onDidChangeTreeData.event;

	private treeData: TreeData = new TreeData();

	/**
	 * To reuse tree item object
	 */
	private treeItemMap: Record<string, vscode.TreeItem> = {};

	dropMimeTypes = [TreeDataProvider.TabDropMimeType];
	dragMimeTypes = ['text/uri-list'];

	getChildren(element?: Tab | Group): Array<Tab | Group> | null {
		return this.treeData.getChildren(element);
	}

	getTreeItem(element: Tab | Group): vscode.TreeItem {
		if (element.type === TreeItemType.Tab) {
			const tabId = element.id;
			if (!this.treeItemMap[tabId]) {
				this.treeItemMap[tabId] = this.createTabTreeItem(element);
			}
			this.treeItemMap[tabId].contextValue = element.groupId === null ? 'tab' : 'grouped-tab';
			return this.treeItemMap[tabId];
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

	async handleDrag(source: Array<Tab | Group>, treeDataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): Promise<void> {
		treeDataTransfer.set(TreeDataProvider.TabDropMimeType, new vscode.DataTransferItem(source));
	}

	async handleDrop(target: Tab | Group | undefined, treeDataTransfer: vscode.DataTransfer, token: vscode.CancellationToken) {
		const draggeds: Array<Group | Tab> = treeDataTransfer.get(TreeDataProvider.TabDropMimeType)?.value ?? [];
		const isTab = (item: Group | Tab): item is Tab => { return item.type === TreeItemType.Tab; }
		const draggedTabs: Array<Tab> = draggeds.filter<Tab>(isTab);

		this.doHandleGrouping(target, draggedTabs.filter(tab => tab !== target));
	
		this._onDidChangeTreeData.fire();
	}

	private doHandleGrouping(target: Tab | Group | undefined, tabs: Tab[]) {
		if (target === undefined) {
			this.treeData.ungroup(tabs);
		} else {
			this.treeData.group(target, tabs);
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
		const tabId = getNormalizedTabId(nativeTab);
		return this.treeData.getTab(tabId);
	}

	public getState(): Array<Tab | Group> {
		return this.treeData.getState();
	}

	public ungroup(tab: Tab) {
		this.treeData.ungroup([tab]);
		this.triggerRerender();
	}
}
