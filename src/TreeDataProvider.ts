import * as vscode from 'vscode';
import { Disposable } from './lifecycle';
import { File, Folder, TreeItemType } from './types';
import { openFileByPath, deleteInRootById, sortByName, renameInRootById } from './utils';


export class TreeDataProvider extends Disposable implements vscode.TreeDataProvider<File | Folder>, vscode.TreeDragAndDropController<File | Folder> {
	private static TabDropMimeType = 'application/vnd.code.tree.tabstreeview';
	dropMimeTypes = [TreeDataProvider.TabDropMimeType];
	dragMimeTypes = ['text/uri-list'];

	private _onDidChangeTreeData = this._register(new vscode.EventEmitter<void>());
	onDidChangeTreeData = this._onDidChangeTreeData.event;

	// Here is virtual tree representation of OPEN folders/items in folders
	private treeItemMap: Record<string, vscode.TreeItem> = {};

	// Root folder or Default folder (here we load state from workspace)
	private root: Array<File | Folder> = [];
	
	// Shows childrens of given element (undefined = show all childrens)
	getChildren(element?: File | Folder): Array<File | Folder> | null {
		if (!element) {
			return this.root;
		}
		if (element.type === TreeItemType.File) {
			return null;
		}
		return element.children;
	}

	private createFile(tab: File): vscode.TreeItem {
		return {
			collapsibleState: vscode.TreeItemCollapsibleState.None,
			resourceUri: vscode.Uri.file(tab.filePath),
		};
	}
	// Here implements, how should elements look like (like real data of element displayed)
	getTreeItem(element: File | Folder): vscode.TreeItem {
		// FILE ITEM
		if (element.type === TreeItemType.File) {
			const tabId = element.id;
			if (!this.treeItemMap[tabId]) {
				this.treeItemMap[tabId] = {
					...this.createFile(element),
					label: element.label
				}
					
			}
			// this.treeItemMap[tabId].contextValue = element.groupId === null ? 'tab' : 'grouped-tab';
			return this.treeItemMap[tabId];
		}

		// FOLDER ITEM
		if (!this.treeItemMap[element.id]) {
			// IF NOT EXISTS
			const treeItem = new vscode.TreeItem(element.label, element.collapsed ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.Expanded);
			// treeItem.contextValue = 'group';
			this.treeItemMap[element.id] = treeItem;
		} else {
			// IF ALREADY EXISTS
			const treeItem = this.treeItemMap[element.id];
			treeItem.label = element.label;
		}

		return this.treeItemMap[element.id]
	}

	public triggerRerender() {
		this._onDidChangeTreeData.fire();
	}

	public rename(element: File | Folder, input: string): void {
		element.label = input;
		this.treeItemMap[element.id].label = input;
		this.triggerRerender();
	}

	// DRAG N DROP FUNCTIONALITY
	async handleDrag(source: Array<File | Folder>, treeDataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): Promise<void> {
		treeDataTransfer.set(TreeDataProvider.TabDropMimeType, new vscode.DataTransferItem(source));
	}
	async handleDrop(target: File | Folder | undefined, treeDataTransfer: vscode.DataTransfer, token: vscode.CancellationToken) {
		// Filter logic for situation when we move to the same place target element (like return)
		const draggeds: Array<File | Folder> = (treeDataTransfer.get(TreeDataProvider.TabDropMimeType)?.value ?? []).filter((tab: any) => tab !== target);

		if (target?.type === TreeItemType.Folder) {
			draggeds.forEach(draggableElement => this.deleteById(draggableElement.id));
			target.children = [...draggeds, ...target.children].sort(sortByName);
		}
		this.triggerRerender()
	}

	// OPEN FILE
	public async openFile(file: File): Promise<any> {
		openFileByPath(file.filePath);
	}

	// STATE
	public getState(): Array<File | Folder> {
		return this.root;
	}
	public setState(state: Array<File | Folder>) {
		this.root = state;
		this.triggerRerender();
	}
	public deleteById(elementId: string) {
		deleteInRootById(this.root, elementId);
		delete this.treeItemMap[elementId];
		this.triggerRerender();
	}
}
