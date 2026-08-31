import { Folder, Tab, TreeItemType } from '../models/types';

export type FileTreeItem = Folder | Tab;

export function findLongestCommonFilePathPrefixIndex(
  filePathArrays: ReadonlyArray<ReadonlyArray<string>>,
): number {
  if (filePathArrays.length === 0) {
    return -1;
  }

  const minLength = Math.min(...filePathArrays.map(filePathArray => filePathArray.length));

  for (let index = 0; index < minLength; index++) {
    const segment = filePathArrays[0][index];
    if (filePathArrays.some(filePathArray => filePathArray[index] !== segment)) {
      return index - 1;
    }
  }

  return minLength - 1;
}

export function getFilePathDescription(
  filePath: ReadonlyArray<string>,
  relatedFilePaths: ReadonlyArray<ReadonlyArray<string>>,
): string | undefined {
  if (relatedFilePaths.length < 2) {
    return undefined;
  }

  const commonPrefixIndex = findLongestCommonFilePathPrefixIndex(relatedFilePaths);
  const description = filePath.slice(commonPrefixIndex + 1, -1);
  return description.length > 0 ? description.join('/') : undefined;
}

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
