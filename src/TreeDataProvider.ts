import * as vscode from 'vscode';
import { Disposable } from './lifecycle';
import { File, Folder, TreeItemType } from './types';
import { openFileByPath } from './utils';


export class TreeDataProvider extends Disposable implements vscode.TreeDataProvider<File | Folder>, vscode.TreeDragAndDropController<File | Folder> {
	private static TabDropMimeType = 'application/vnd.code.tree.tabstreeview';
	dropMimeTypes = [TreeDataProvider.TabDropMimeType];
	dragMimeTypes = ['text/uri-list'];

	private _onDidChangeTreeData = this._register(new vscode.EventEmitter<void>());
	onDidChangeTreeData = this._onDidChangeTreeData.event;

	/**
	 * To reuse tree item object
	 */
	private treeItemMap: Record<string, vscode.TreeItem> = {};
	private root: Array<File | Folder> = [];

	private createTabTreeItem(tab: File): vscode.TreeItem {
		return {
			collapsibleState: vscode.TreeItemCollapsibleState.None,
			resourceUri: vscode.Uri.file(tab.id)
		};
	}

	getChildren(element?: File | Folder): Array<File | Folder> | null {
		if (!element) {
			return this.root;
		}
		if (element.type === TreeItemType.File) {
			return null;
		}
		return element.children;
	}

	getTreeItem(element: File | Folder): vscode.TreeItem {
		// FILE ITEM
		if (element.type === TreeItemType.File) {
			const tabId = element.id;
			if (!this.treeItemMap[tabId]) {
				this.treeItemMap[tabId] = this.createTabTreeItem(element);
			}
			this.treeItemMap[tabId].contextValue = element.groupId === null ? 'tab' : 'grouped-tab';
			return this.treeItemMap[tabId];
		}

		// FOLDER ITEM
		if (!this.treeItemMap[element.id]) {
			// IF NOT EXISTS
			const treeItem = new vscode.TreeItem(element.label, element.collapsed ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.Expanded);
			treeItem.contextValue = 'group';
			this.treeItemMap[element.id] = treeItem;
		} else {
			// IF ALREADY EXISTS
			const treeItem = this.treeItemMap[element.id];
			treeItem.label = element.label;
		}

		return this.treeItemMap[element.id]
	}


	public renameFolder(folder: Folder, input: string): void {
		folder.label = input;
		this.triggerRerender();
	}

	// DRAG N DROP FUNCTIONALITY
	async handleDrag(source: Array<File | Folder>, treeDataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): Promise<void> {
		treeDataTransfer.set(TreeDataProvider.TabDropMimeType, new vscode.DataTransferItem(source));
	}
	async handleDrop(target: File | Folder | undefined, treeDataTransfer: vscode.DataTransfer, token: vscode.CancellationToken) {
		const draggeds: Array<File | Folder> = (treeDataTransfer.get(TreeDataProvider.TabDropMimeType)?.value ?? []).filter((tab: any) => tab !== target);

		// TODO: Add adding to group here
		console.log(draggeds);

		this._onDidChangeTreeData.fire();
	}

	public triggerRerender() {
		this._onDidChangeTreeData.fire();
	}

	// OPEN FILE
	public async openFile(file: File): Promise<any> {
		openFileByPath(file.id);
	}

	// STATE

	public getState(): Array<File | Folder> {
		return this.root;
	}
	public setState(state: Array<File | Folder>) {
		this.root = state;
	}
}
