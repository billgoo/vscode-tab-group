
import * as vscode from 'vscode';
import { getNormalizedTabId } from './TabTypeHandler';
import { WorkspaceState, ViewModeState } from './WorkspaceState';
import { ExclusiveHandle } from './event';
import { asPromise } from './async';
import { Group, isGroup, Tab, TreeItemType } from './types';
import { getNativeTabs, TreeDataProvider } from './TreeDataProvider';
import { Disposable } from './lifecycle';
import { ContextKeys, setContext } from './context';
import { tabFileDecorationProvider } from './TabFileDecorationProvider';

export class TabsView extends Disposable {
	private treeDataProvider: TreeDataProvider = this._register(new TreeDataProvider());
	private exclusiveHandle = new ExclusiveHandle();
	private viewMode: ViewModeState = { groupByParentActive: false, sortScope: null };

	constructor() {
		super();
		const initialState = this.initializeState();
		this.saveState(initialState);
		this.treeDataProvider.setState(initialState);

		// Restore persisted view modes and re-apply them to the initial state
		this.viewMode = WorkspaceState.getViewMode();
		this.applyViewMode();
		setContext(ContextKeys.AllCollapsed, this.treeDataProvider.isAllCollapsed());

		const view = this._register(vscode.window.createTreeView('tabsTreeView', {
			treeDataProvider: this.treeDataProvider,
			dragAndDropController: this.treeDataProvider,
			canSelectMany: true
		}));

		this._register(this.treeDataProvider.onDidChangeTreeData(() => this.saveState(this.treeDataProvider.getState())));

		// Listen to decoration changes to refresh the tree view
		this._register(tabFileDecorationProvider.onDidChangeFileDecorations(() => {
			this.treeDataProvider.triggerRerender();
		}));

		this._register(vscode.commands.registerCommand('tabsTreeView.tab.close', (tab: Tab) => vscode.window.tabGroups.close(getNativeTabs(tab))));

		this._register(vscode.commands.registerCommand('tabsTreeView.tab.ungroup', (tab: Tab) => this.treeDataProvider.ungroup(tab)));

		this._register(vscode.commands.registerCommand('tabsTreeView.group.rename', (group: Group) => {
			vscode.window.showInputBox({ placeHolder: 'Name this Group', value: group.label }).then(input => {
				if (input) {
					this.treeDataProvider.renameGroup(group, input);
				}
			})
		}));

		this._register(vscode.commands.registerCommand('tabsTreeView.group.cancelGroup', (group: Group) => this.treeDataProvider.cancelGroup(group)));

		this._register(vscode.commands.registerCommand('tabsTreeView.group.close', (group: Group) => {
			vscode.window.tabGroups.close(group.children.map((tab: Tab) => getNativeTabs(tab)).flat());
		}));

		this._register(vscode.commands.registerCommand('tabsTreeView.reset', () => {
			WorkspaceState.setState([]);
			this.viewMode = { groupByParentActive: false, sortScope: null };
			WorkspaceState.setViewMode(this.viewMode);
			const initialState = this.initializeState();
			this.treeDataProvider.setState(initialState);
			this.applyViewMode();
		}));

		const toggleGroupByParent = () => {
			this.viewMode.groupByParentActive = !this.viewMode.groupByParentActive;
			WorkspaceState.setViewMode(this.viewMode);
			this.applyViewMode();
		};
		const toggleSort = (scope: 'all' | 'groupsOnly' | 'tabsOnly') => () => {
			this.viewMode.sortScope = this.viewMode.sortScope === scope ? null : scope;
			WorkspaceState.setViewMode(this.viewMode);
			this.applyViewMode();
		};

		this._register(vscode.commands.registerCommand('tabsTreeView.groupByParentFolder', toggleGroupByParent));
		this._register(vscode.commands.registerCommand('tabsTreeView.groupByParentFolder.active', toggleGroupByParent));

		this._register(vscode.commands.registerCommand('tabsTreeView.sortAlphabetically.all', toggleSort('all')));
		this._register(vscode.commands.registerCommand('tabsTreeView.sortAlphabetically.all.active', toggleSort('all')));

		this._register(vscode.commands.registerCommand('tabsTreeView.sortAlphabetically.groupsOnly', toggleSort('groupsOnly')));
		this._register(vscode.commands.registerCommand('tabsTreeView.sortAlphabetically.groupsOnly.active', toggleSort('groupsOnly')));

		this._register(vscode.commands.registerCommand('tabsTreeView.sortAlphabetically.tabsOnly', toggleSort('tabsOnly')));
		this._register(vscode.commands.registerCommand('tabsTreeView.sortAlphabetically.tabsOnly.active', toggleSort('tabsOnly')));

		this._register(vscode.window.tabGroups.onDidChangeTabs(e => {
			this.treeDataProvider.appendTabs(e.opened);
			this.treeDataProvider.closeTabs(e.closed);

			if (e.opened.length > 0) {
				this.applyViewMode();
			}

			if (e.changed[0] && e.changed[0].isActive) {
				const tab = this.treeDataProvider.getTab(e.changed[0]);
				if (tab) {
					if (view.visible) {
						this.exclusiveHandle.run(() => asPromise(view.reveal(tab, { select: true, expand: true })));
					}
				}
			}

			this.treeDataProvider.triggerRerender();
		}));

		this._register(view.onDidChangeSelection(e => {
			if (e.selection.length > 0) {
				const item = e.selection[e.selection.length - 1];
				if (item.type === TreeItemType.Tab) {
					this.exclusiveHandle.run(() => asPromise(this.treeDataProvider.activate(item)));
				}
			}
		}));

		this._register(vscode.commands.registerCommand('tabsTreeView.collapseAll', () => vscode.commands.executeCommand('list.collapseAll')));

		this._register(vscode.commands.registerCommand('tabsTreeView.expandAll', () => {
			for (const item of this.treeDataProvider.getState()) {
				if (isGroup(item) && item.children.length > 0) {
					view.reveal(item, { expand: true });
				}
			}
		}));

		this._register(view.onDidExpandElement((element) => {
			if (isGroup(element.element)) {
				this.treeDataProvider.setCollapsedState(element.element, false);
				this.saveState(this.treeDataProvider.getState());
				setContext(ContextKeys.AllCollapsed, false);
			}
		}));

		this._register(view.onDidCollapseElement((element) => {
			if (isGroup(element.element)) {
				this.treeDataProvider.setCollapsedState(element.element, true);
				this.saveState(this.treeDataProvider.getState());
				setContext(ContextKeys.AllCollapsed, this.treeDataProvider.isAllCollapsed());
			}
		}));
	}

	private initializeState(): Array<Tab | Group> {
		const jsonItems = WorkspaceState.getState() ?? [];
		const nativeTabs = vscode.window.tabGroups.all.flatMap(tabGroup => tabGroup.tabs);
		return this.mergeState(jsonItems, nativeTabs);
	}

	private mergeState(jsonItems: Array<Tab | Group>, nativeTabs: vscode.Tab[]): Array<Tab | Group> {
		const mergedTabs: Array<Tab | Group> = [];

		for (const jsonItem of jsonItems) {
			if (jsonItem.type === TreeItemType.Tab) {
				const length = nativeTabs.length;
				nativeTabs = nativeTabs.filter((nativeTab) => !this.isCorrespondingTab(nativeTab, jsonItem));
				if (nativeTabs.length < length) {
					mergedTabs.push(jsonItem);
				}
			} else {
				const children: Tab[] = [];
				jsonItem.children.forEach(tab => {
					const length = nativeTabs.length;
					nativeTabs = nativeTabs.filter((nativeTab) => !this.isCorrespondingTab(nativeTab, tab));

					if (nativeTabs.length < length) {
						children.push(tab);
					}
				});

				if (children.length > 0) {
					mergedTabs.push({ ...jsonItem, children });
				}
			}
		}

		const tabMap: Record<string, Tab> = {}; // if there are same resources in multiple tab group, add only one
		nativeTabs.forEach(tab => {
			try {
				const id = getNormalizedTabId(tab);
				if (!tabMap[id]) {
					tabMap[id] = { type: TreeItemType.Tab, groupId: null, id };
					mergedTabs.push(tabMap[id]);
				}
			} catch {
				// won't add unimplemented-typed tab into tree
			}
		})

		return mergedTabs;
	}

	private saveState(state: Array<Tab | Group>): void {
		WorkspaceState.setState(state);
	}

	/**
	 * Re-applies the currently active view modes (group by parent folder and/or sort)
	 * to the tree data provider and triggers a re-render.
	 */
	private applyViewMode(): void {
		if (this.viewMode.groupByParentActive) {
			this.treeDataProvider.groupByParentFolder();
		}
		if (this.viewMode.sortScope !== null) {
			this.treeDataProvider.sortAlphabetically(this.viewMode.sortScope);
		}
		setContext(ContextKeys.GroupByParentActive, this.viewMode.groupByParentActive);
		setContext(ContextKeys.SortAllActive, this.viewMode.sortScope === 'all');
		setContext(ContextKeys.SortGroupsOnlyActive, this.viewMode.sortScope === 'groupsOnly');
		setContext(ContextKeys.SortTabsOnlyActive, this.viewMode.sortScope === 'tabsOnly');
		this.treeDataProvider.triggerRerender();
	}

	private isCorrespondingTab(tab: vscode.Tab, jsonTab: Tab): boolean {
		try {
			return jsonTab.id === getNormalizedTabId(tab);
		} catch {
			return false;
		}
	}
}
