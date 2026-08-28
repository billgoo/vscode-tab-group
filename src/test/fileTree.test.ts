import { describe, expect, test } from '@jest/globals';
import { Folder, isFolder, Tab, TreeItemType } from '../models/types';
import { createFileTree } from '../utils/fileTree';

function createTab(id: string): Tab {
  return { type: TreeItemType.Tab, groupId: null, id };
}

describe('file tree', () => {
  test('groups tabs into nested folders while preserving tab order', () => {
    const firstTab = createTab('first');
    const secondTab = createTab('second');
    const rootTab = createTab('root');

    const tree = createFileTree(
      [firstTab, secondTab, rootTab],
      tab =>
        ({
          first: ['src', 'providers', 'TreeView.ts'],
          second: ['src', 'providers', 'TreeDataProvider.ts'],
          root: ['README.md'],
        })[tab.id],
    );

    expect(tree).toHaveLength(2);
    expect(isFolder(tree[0])).toBe(true);
    const sourceFolder = tree[0] as Folder;
    expect(sourceFolder.label).toBe('src');
    expect(sourceFolder.children).toHaveLength(1);
    expect(isFolder(sourceFolder.children[0])).toBe(true);
    expect((sourceFolder.children[0] as Folder).children).toEqual([firstTab, secondTab]);
    expect(tree[1]).toBe(rootTab);
  });

  test('keeps folders scoped to their group', () => {
    const tab = createTab('tab');
    const rootTree = createFileTree([tab], () => ['src', 'index.ts']);
    const groupTree = createFileTree([tab], () => ['src', 'index.ts'], 'group');

    expect((rootTree[0] as Folder).id).not.toBe((groupTree[0] as Folder).id);
    expect((rootTree[0] as Folder).groupId).toBeNull();
    expect((groupTree[0] as Folder).groupId).toBe('group');
  });

  test('leaves tabs without a directory as direct children', () => {
    const tab = createTab('readme');

    expect(createFileTree([tab], () => ['README.md'])).toEqual([tab]);
    expect(createFileTree([tab], () => undefined)).toEqual([tab]);
  });
});
