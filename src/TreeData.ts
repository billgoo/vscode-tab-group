import { randomUUID } from 'crypto';
import { safeRemove } from './Arrays';
import { getNextColorId } from './color';
import { Group, TreeItemType, Tab, isGroup } from './types';

export class TreeData {
	private root: Array<Tab | Group> = [];

	/**
	 * To quickly access group
	 */
	private groupMap: Record<string, Group> = {};

	/**
	 * To quickly access tab
	 */
	private tabMap: Record<string, Tab> = {};

	public setState(state: Array<Tab | Group>) {
		this.root = state;
		this.tabMap = {};
		this.groupMap = {};
		for (const item of this.root) {
			if (item.type === TreeItemType.Tab) {
				this.tabMap[item.id] = item;
			} else {
				this.groupMap[item.id] = item;
			}
		}
	}

	public getState(): Array<Tab | Group> {
		this.removeEmptyGroups();
		return this.root;
	}

	private removeEmptyGroups() {
		this.root = this.root.filter(item => !(isGroup(item) && item.children.length === 0));
	}

	getChildren(element?: Tab | Group): Array<Tab | Group> | null {
		if (!element) {
			this.removeEmptyGroups();
			return this.root;
		}
		if (element.type === TreeItemType.Tab) {
			return null;
		}
		return element.children;
	}

	getParent(element: Tab | Group) {
		if (element.type === TreeItemType.Group) {
			return undefined;
		}
		
		if (element.groupId === null) {
			return undefined;
		}

		return this.groupMap[element.groupId];
	}

	private _insertTabToGroup(tab: Tab, group: Group, index?: number) {
		tab.groupId = group.id;
		group.children.splice(index ?? group.children.length, 0, tab);
	}

	private _insertTabToRoot(tab: Tab, index?: number) {
		tab.groupId = null;
		this.root.splice(index ?? this.root.length, 0, tab);
	}

	private _removeTab(tab: Tab) {
		const from = tab.groupId === null ? this.root : this.groupMap[tab.groupId].children;
		safeRemove(from, tab);
		tab.groupId = null;
	}

	public group(target: Tab | Group, tabs: Tab[]) {
		if (tabs.length === 0) {
			return;
		}

		if (isGroup(target)) {
			tabs.forEach(tab => this._group(target, tab));
			return;
		}

		if (target.groupId) {
			const group = this.groupMap[target.groupId];
			const index = group.children.indexOf(target);
			tabs.forEach(tab => this._group(group, tab, index));
			return;
		}

		const group: Group = {
			type: TreeItemType.Group,
			colorId: getNextColorId(),
			id: randomUUID(),
			label: '',
			children: [],
		};
		this.groupMap[group.id] = group;
		this.root.splice(this.root.indexOf(target), 1, group);
		this._insertTabToGroup(target, group);
		
		tabs.forEach(tab => this._group(group, tab));
	}

	private _group(group: Group, tab: Tab, index?: number) {
		this._removeTab(tab);
		this._insertTabToGroup(tab, group, index);
	}


	public ungroup(tabs: Tab[]) {
		tabs.forEach(tab => {
			if (tab.groupId === null) {
				return;
			}
			const group = this.groupMap[tab.groupId];
			const index = this.root.indexOf(group);
			safeRemove(group.children, tab);
			tab.groupId = null;
			this._insertTabToRoot(tab, index + 1);
		});
	}

	public appendTab(tabId: string) {
		if (!this.tabMap[tabId]) {
			this.tabMap[tabId] = {
				type: TreeItemType.Tab,
				groupId: null,
				id: tabId,
			};
			this.root.push(this.tabMap[tabId]);
		}
	}

	public deleteTab(tabId: string) {
		const tab = this.tabMap[tabId];
		this._removeTab(tab);
		delete this.tabMap[tabId];
	}

	public getTab(tabId: string): Tab | undefined {
		return this.tabMap[tabId];
	}

	public renameGroup(group: Group, input: string): void {
		group.label = input;
	}

	public cancelGroup(group: Group): void {
		this.ungroup(group.children.slice(0).reverse());
	}
}