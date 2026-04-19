import { randomUUID } from 'crypto';
import { safeRemove } from './Arrays';
import { getNextColorId } from './color';
import { Group, TreeItemType, Tab, isGroup, isTab } from './types';

/**
 * Extracts the last path segment of a tab ID for use as a sort key.
 * Works with file URIs (`file:///path/to/file.ts`) and arbitrary IDs.
 * @param tabId - The normalised tab identifier.
 * @returns Lower-cased filename or the full ID when no segments are found.
 */
function getTabSortKey(tabId: string): string {
	const parts = tabId.split('/');
	return (parts[parts.length - 1] ?? tabId).toLowerCase();
}

/**
 * Extracts the parent directory name from a tab ID that represents a file URI.
 * Returns `null` for non-file IDs such as JSON-serialised diff descriptors.
 * @param tabId - The normalised tab identifier.
 * @returns The immediate parent folder name, or `null` when it cannot be determined.
 */
function getParentDirName(tabId: string): string | null {
	// Only process IDs that look like file URIs
	if (!tabId.startsWith('file:///') && !tabId.startsWith('file://')) {
		return null;
	}
	const parts = tabId.split('/');
	// At minimum: ['file:', '', '', ...dir, filename]
	if (parts.length < 2) {
		return null;
	}
	const dirName = parts[parts.length - 2];
	return dirName && !dirName.includes(':') ? dirName : null;
}

/**
 * Given a file-URI parent-directory path and an optional workspace-root URI,
 * returns the relative path from the root (e.g. `src/utils`). Falls back to
 * the immediate parent folder name when no root is provided or the path is
 * outside the workspace.
 * @param dirPath - Full URI of the parent directory (from {@link getParentDirPath}).
 * @param workspaceRoot - Optional workspace-root URI string (e.g. `file:///home/user/project`).
 * @returns A human-readable relative label for the group.
 */
function getRelativeDirLabel(dirPath: string, workspaceRoot?: string): string {
	if (workspaceRoot) {
		const root = workspaceRoot.replace(/\/$/, '');
		if (dirPath === root) {
			return '/';
		}
		if (dirPath.startsWith(root + '/')) {
			return decodeURIComponent(dirPath.slice(root.length + 1));
		}
	}
	// Fallback: immediate parent folder name
	const parts = dirPath.split('/');
	return decodeURIComponent(parts[parts.length - 1] ?? dirPath);
}

/**
 * Extracts the full parent directory path from a file-URI tab ID.
 * Used as a grouping key so that only files sharing the exact same folder are co-grouped.
 * @param tabId - The normalised tab identifier.
 * @returns The decoded parent path string, or `null` for non-file IDs.
 */
function getParentDirPath(tabId: string): string | null {
	if (!tabId.startsWith('file:///') && !tabId.startsWith('file://')) {
		return null;
	}
	const parts = tabId.split('/');
	if (parts.length < 2) {
		return null;
	}
	return parts.slice(0, parts.length - 1).join('/');
}

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

	/**
	 * Groups all ungrouped root-level tabs that share the same immediate parent directory.
	 * Directories represented by only one tab are left ungrouped.
	 * Each resulting group is labelled with the path relative to the workspace root.
	 * @param workspaceRoot - Optional workspace-root URI used to compute relative group labels.
	 */
	public groupByParentFolder(workspaceRoot?: string): void {
		const ungroupedTabs = this.root.filter(isTab);

		// Build a map from dirPath → existing group (by label) so we can merge into it
		const labelToGroup = new Map<string, Group>();
		for (const group of Object.values(this.groupMap)) {
			labelToGroup.set(group.label, group);
		}

		// Bucket ungrouped tabs by their parent directory path
		const byDir = new Map<string, { label: string; tabs: Tab[] }>();
		for (const tab of ungroupedTabs) {
			const dirPath = getParentDirPath(tab.id);
			if (dirPath === null) {
				continue;
			}
			if (!byDir.has(dirPath)) {
				byDir.set(dirPath, { label: getRelativeDirLabel(dirPath, workspaceRoot), tabs: [] });
			}
			byDir.get(dirPath)!.tabs.push(tab);
		}

		for (const { label, tabs } of byDir.values()) {
			const existingGroup = labelToGroup.get(label);
			if (existingGroup) {
				// Merge all ungrouped tabs from this directory into the existing group
				tabs.forEach(tab => this._group(existingGroup, tab));
			} else {
				const [anchor, ...rest] = tabs;
				if (rest.length === 0) {
					// Single-tab directory: create a one-item group directly
					const group: Group = {
						type: TreeItemType.Group,
						colorId: getNextColorId(this._getUsedColorIds()),
						id: randomUUID(),
						label,
						children: [],
						collapsed: false,
					};
					this.groupMap[group.id] = group;
					this.root.splice(this.root.indexOf(anchor), 1, group);
					this._insertTabToGroup(anchor, group);
					labelToGroup.set(label, group);
				} else {
					this.group(anchor, rest);
					const groupId = anchor.groupId;
					if (groupId) {
						this.groupMap[groupId].label = label;
						labelToGroup.set(label, this.groupMap[groupId]);
					}
				}
			}
		}

		// Place ungrouped tabs ("<root>") at the top, then sort groups alphabetically.
		const rootTabs = this.root.filter(isTab);
		const groups = this.root.filter(isGroup).sort((a, b) =>
			a.label.toLowerCase().localeCompare(b.label.toLowerCase())
		);
		this.root = [...rootTabs, ...groups];
	}

	/**
	 * Sorts tabs and/or groups alphabetically.
	 *
	 * @param scope
	 *   - `'all'`        – Sort root-level items (groups by label, tabs by filename)
	 *                      **and** sort tabs within every group.
	 *   - `'groupsOnly'` – Sort only the order of root-level items (groups by label,
	 *                      ungrouped tabs by filename). Tabs inside groups are untouched.
	 *   - `'tabsOnly'`   – Sort tabs within each group, and sort ungrouped root-level
	 *                      tabs by filename among themselves. The position of groups in
	 *                      the root list is preserved.
	 */
	public sortAlphabetically(scope: 'all' | 'groupsOnly' | 'tabsOnly'): void {
		const tabKey = (tab: Tab) => getTabSortKey(tab.id);
		const itemKey = (item: Tab | Group) =>
			isGroup(item) ? item.label.toLowerCase() : tabKey(item);

		if (scope === 'all' || scope === 'groupsOnly') {
			this.root.sort((a, b) => itemKey(a).localeCompare(itemKey(b)));
		}

		if (scope === 'all' || scope === 'tabsOnly') {
			// Sort children within every group
			for (const item of this.root) {
				if (isGroup(item)) {
					item.children.sort((a, b) => tabKey(a).localeCompare(tabKey(b)));
				}
			}

			if (scope === 'tabsOnly') {
				// Sort ungrouped root-level tabs among themselves without disturbing groups
				const ungrouped = this.root.filter(isTab).sort((a, b) =>
					tabKey(a).localeCompare(tabKey(b))
				);
				let ui = 0;
				for (let i = 0; i < this.root.length; i++) {
					if (isTab(this.root[i])) {
						this.root[i] = ungrouped[ui++];
					}
				}
			}
		}
	}
}