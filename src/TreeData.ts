import { randomUUID } from 'crypto';
import { safeRemove } from './Arrays';
import { getNextColorId } from './color';
import { Group, TreeItemType, Tab, isGroup, isTab } from './types';

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
				for (const child of item.children) {
					this.tabMap[child.id] = child;
				}
			}
		}
	}

	public getState(): Array<Tab | Group> {
		this.removeEmptyGroups();
		return this.root;
	}

	private removeEmptyGroups() {
		for (let i = this.root.length - 1; i >= 0; i--) {
			const item = this.root[i];
			if (isGroup(item) && item.children.length === 0) {
				this.root.splice(i, 1);
				delete this.groupMap[item.id];
			}
		}
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

	private _getUsedColorIds(): string[] {
		return Object.values(this.groupMap).map(group => group.colorId)
	};

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
			colorId: getNextColorId(this._getUsedColorIds()),
			id: randomUUID(),
			label: '',
			children: [],
			collapsed: false,
		};
		this.groupMap[group.id] = group;
		this.root.splice(this.root.indexOf(target), 1, group);
		this._insertTabToGroup(target, group);

		tabs.forEach(tab => this._group(group, tab));
		return;
	}

	private _group(group: Group, tab: Tab, index?: number) {
		this._removeTab(tab);
		this._insertTabToGroup(tab, group, index);
	}


	public ungroup(tabs: Tab[], pushBack: boolean = false) {
		tabs.forEach(tab => {
			if (tab.groupId === null) {
				return;
			}
			const group = this.groupMap[tab.groupId];
			const index = this.root.indexOf(group);
			safeRemove(group.children, tab);
			tab.groupId = null;
			this._insertTabToRoot(tab, pushBack ? undefined : index + 1);
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

	public getGroup(groupId: string): Group | undefined {
		return this.groupMap[groupId];
	}

	public renameGroup(group: Group, input: string): void {
		group.label = input;
	}

	public cancelGroup(group: Group): void {
		this.ungroup(group.children.slice(0).reverse());
	}

	public moveTo(target: Tab | Group, draggeds: Array<Tab | Group>) {
		if (isTab(target) && target.groupId) {
			const draggedTabs: Array<Tab> = draggeds.filter(isTab);
			draggedTabs.forEach(tab => this._removeTab(tab));
			const group = this.groupMap[target.groupId];
			group.children.splice(group.children.indexOf(target), 0, ...draggedTabs);
			draggedTabs.forEach(tab => tab.groupId = target.groupId);
			return;
		}

		draggeds.forEach(dragged => {
			if (isGroup(dragged)) {
				safeRemove(this.root, dragged);
			} else {
				this._removeTab(dragged)
			}
		});
		this.root.splice(this.root.indexOf(target), 0, ...draggeds);
	}

	public pushBack(groupId: string | null, draggeds: (Tab | Group)[]) {
		if (groupId) {
			const draggedTabs: Array<Tab> = draggeds.filter(isTab);
			draggedTabs.forEach(tab => this._removeTab(tab));
			this.groupMap[groupId].children.push(...draggedTabs);
			draggedTabs.forEach(tab => tab.groupId = groupId);
			return;
		}

		draggeds.forEach(dragged => {
			if (isGroup(dragged)) {
				safeRemove(this.root, dragged);
			} else {
				this._removeTab(dragged)
			}
		});
		this.root.push(...draggeds);
	}

	public isAllCollapsed(): boolean {
		for (const item of this.root) {
			if (isGroup(item) && !item.collapsed) {
				return false;
			}
		}
		return true;
	}

	public setCollapsedState(group: Group, collapsed: boolean) {
		this.groupMap[group.id].collapsed = collapsed;
	}
}