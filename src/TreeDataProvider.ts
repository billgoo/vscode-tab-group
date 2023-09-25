import * as vscode from 'vscode';
import { sep } from 'node:path';
import { Disposable } from './lifecycle';
import { getHandler, getNormalizedTabId } from './TabTypeHandler';
import { TreeData } from './TreeData';
import { Group, TreeItemType, Tab, isTab, Slot, isGroup, isSlot, FilePathNode } from './types';
import path = require('node:path');

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

	/**
	 * Store file path of open tab with resourceUri as tree map to use for label if duplicated file name showing
	 */
	private filePathTree: Record<string, Record<string, FilePathNode>> = {};

	/**
	 * Store file path of open tab with resourceUri as tree map to use for label if duplicated file name showing
	 */
	private filePathTree: Record<string, Record<string, FilePathNode>> = {};

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
			var newTreeItem = this.createTabTreeItem(element);
			const tabId = element.id;
			if (!this.treeItemMap[tabId]) {
				this.treeItemMap[tabId] = newTreeItem;
			}

			if (newTreeItem.resourceUri) {
				// use to update tab label if duplicated file name showing
				var filePathArray = tabId.split(sep);
				if (filePathArray.length > 1) {
					if (!this.filePathTree[filePathArray[-1]]) {
						this.filePathTree[filePathArray[-1]] = {};
					}
					if (!this.filePathTree[filePathArray[-1]][tabId]) {
						this.filePathTree[filePathArray[-1]][tabId] = { pathList: filePathArray, id: tabId };
					}
				}
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
		this.refreshFilePathTree();
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

	private refreshFilePathTree() {
		this.filePathTree = {};
		this.getLeafNodes(this.treeData.getState()).forEach((leafNode: Tab) => {
			const tabId = leafNode.id;
			const leafItem = this.getTreeItem(leafNode);
			if (leafItem.resourceUri) {
				// use to update tab label if duplicated file name showing
				var filePathArray = leafItem.resourceUri.fsPath.split(path.sep);
				if (filePathArray.length > 1) {
					var fileName = filePathArray[filePathArray.length - 1];
					if (!this.filePathTree[fileName]) {
						this.filePathTree[fileName] = {};
					}
					if (!this.filePathTree[fileName][tabId]) {
						this.filePathTree[fileName][tabId] = { pathList: filePathArray, id: tabId } as FilePathNode;
						this.onChangeFilePathTree(fileName);
					}
				}
			}
			// TODO: billgoo: Add support for other tab types
		});
	}

	private getLeafNodes(root: Array<Tab | Group>): Array<Tab> {
		const leafNodes: Array<Tab> = [];
		root.forEach((item: Tab | Group) => {
			if (isTab(item)) {
				leafNodes.push(item);
			} else {
				leafNodes.push(...this.getLeafNodes(item.children));
			}
		});
		return leafNodes;
	}

	private onChangeFilePathTree(fileName: string) {
		let distinceNodeCount = Object.keys(this.filePathTree[fileName]).length;
		if (distinceNodeCount > 1) {
			var commonAncestorDirIndex = findLongestCommonFilePathPrefixIndex(Object.values(this.filePathTree[fileName]).map(node => node.pathList) as Array<Array<string>>);
			// map back to treeItemMap to change the description
			Object.values(this.filePathTree[fileName]).forEach((node: FilePathNode) => {
				this.updateTreeItemDescription(node.id, node.pathList.slice(commonAncestorDirIndex + 1, -1));
			});
		} else if (distinceNodeCount === 1) {
			var node = Object.values(this.filePathTree[fileName])[0];
			this.updateTreeItemDescription(node.id);
		}
	}

	private updateTreeItemDescription(tabId: string, pathSequence?: Array<string>) {
		if (this.treeItemMap[tabId]) {
			this.treeItemMap[tabId].description = pathSequence?.length ? path.join(...pathSequence) : undefined;
		}
	}
}

export function findLongestCommonFilePathPrefixIndex(filePathArrays: Array<Array<string>>): number {
	const size = filePathArrays.length;

	if (size === 0) {
		return -1;
	} else if (size === 1) {
		return 0;
	}

	filePathArrays.sort((a, b) => a.length - b.length);

	// find the minimum length from first and last array
	const minLength = Math.min(filePathArrays[0].length, filePathArrays[size - 1].length);

	// find the common prefix between the first and last array
	let i = 0;
	while (i < minLength && filePathArrays[0][i] === filePathArrays[size - 1][i]) {
		i++;
	}

	return i - 1;
}
