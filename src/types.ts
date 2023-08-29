export const enum TreeItemType {
	File,
	Folder,
};

export type Folder = {
	readonly type: TreeItemType.Folder;
	id: string;
	label: string;
	filePath: string,
	collapsed: boolean;
	children: (File | Folder)[];
};

export type File = {
	readonly type: TreeItemType.File;
	id: string;
	label: string;
	filePath: string;
};

export type SearchResult = {
	element: File | Folder | null;
	path: number[];
  }
