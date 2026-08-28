export const enum TreeItemType {
  Tab,
  Group,
  Slot,
  Folder,
}

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

export type Folder = {
  readonly type: TreeItemType.Folder;
  readonly id: string;
  readonly label: string;
  readonly groupId: string | null;
  readonly children: Array<Folder | Tab>;
};

export type ViewMode = 'list' | 'tree';

export type TreeElement = Tab | Group | Slot | Folder;

export function isTab(item: TreeElement): item is Tab {
  return item.type === TreeItemType.Tab;
}

export function isGroup(item: TreeElement): item is Group {
  return item.type === TreeItemType.Group;
}

export function isSlot(item: TreeElement): item is Slot {
  return item.type === TreeItemType.Slot;
}

export function isFolder(item: TreeElement): item is Folder {
  return item.type === TreeItemType.Folder;
}

export type FilePathNode = {
  pathList: Array<string>;
  id: string;
};
