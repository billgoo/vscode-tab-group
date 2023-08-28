export const enum TreeItemType {
	File,
	Folder,
};

export type Folder = {
	readonly type: TreeItemType.Folder;
	readonly id: string;
	colorId: string;
	label: string;
	filePath: string,
	children: (File | Folder)[];
	groupId: string | null;
	collapsed: boolean;
	customId: string;
	customPath: string;
};

export type File = {
	readonly type: TreeItemType.File;
	groupId: string | null;
	id: string;
	customId: string;
	customPath: string;
};

export function isFile(item: File): item is File {
	return item.type === TreeItemType.File;
}

export function isFileOrFolder(item: File | Folder): item is File | Folder {
	return item.type === TreeItemType.File || item.type === TreeItemType.Folder;
}


export function isFolder(item: File | Folder): item is Folder {
	return item.type === TreeItemType.Folder;
}

