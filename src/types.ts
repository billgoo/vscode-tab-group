export const enum TreeItemType {
	Tab,
	Group,
	Slot,
};

export type Group = {
	readonly type: TreeItemType.Group;
	readonly id: string;
	colorId: string;
	label: string;
	children: Tab[];
	collapsed: boolean;
};

export type Tab = {
	readonly type: TreeItemType.Tab;
	groupId: string | null;
	id: string;
};

export type Slot = {
	type: TreeItemType.Slot;
	index: number;
	groupId: string | null;
};

export function isTab(item: Tab | Group | Slot): item is Tab {
	return item.type === TreeItemType.Tab;
}


export function isGroup(item: Tab | Group | Slot): item is Group {
	return item.type === TreeItemType.Group;
}


export function isSlot(item: Tab | Group | Slot): item is Slot {
	return item.type === TreeItemType.Slot;
}
