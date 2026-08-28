import { Folder, Tab, TreeItemType } from '../models/types';

export type FileTreeItem = Folder | Tab;

export function createFileTree(
  tabs: readonly Tab[],
  getPath: (tab: Tab) => readonly string[] | undefined,
  groupId: string | null = null,
): FileTreeItem[] {
  const roots: FileTreeItem[] = [];
  const folders = new Map<string, Folder>();

  tabs.forEach(tab => {
    const path = getPath(tab)?.filter(segment => segment.length > 0);
    if (!path || path.length < 2) {
      roots.push(tab);
      return;
    }

    let children = roots;
    const folderPath: string[] = [];
    path.slice(0, -1).forEach(label => {
      folderPath.push(label);
      const key = JSON.stringify(folderPath);
      let folder = folders.get(key);
      if (!folder) {
        folder = {
          type: TreeItemType.Folder,
          id: `folder:${JSON.stringify([groupId ?? 'root', folderPath])}`,
          label,
          groupId,
          children: [],
        };
        folders.set(key, folder);
        children.push(folder);
      }
      children = folder.children;
    });

    children.push(tab);
  });

  return roots;
}
