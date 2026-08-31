import { describe, expect, test } from '@jest/globals';
import { Folder, Group, Slot, Tab, TreeItemType } from '../models/types';
import { getSelectedTab } from '../utils/selectedTab';

function createTab(id: string): Tab {
  return { type: TreeItemType.Tab, groupId: null, id };
}

describe('selected tab utility', () => {
  test('returns the last selected tab', () => {
    const firstTab = createTab('first');
    const secondTab = createTab('second');

    expect(getSelectedTab([firstTab, secondTab])).toBe(secondTab);
  });

  test.each<[Group | Folder | Slot]>([
    [
      {
        type: TreeItemType.Group,
        id: 'group',
        colorId: 'charts.blue',
        label: 'Group',
        children: [],
        collapsed: false,
      },
    ],
    [
      {
        type: TreeItemType.Folder,
        id: 'folder',
        label: 'Folder',
        groupId: null,
        children: [],
      },
    ],
    [{ type: TreeItemType.Slot, index: 0, groupId: null }],
  ])('returns undefined when the selected item is not a tab', selectedItem => {
    expect(getSelectedTab([createTab('tab'), selectedItem])).toBeUndefined();
  });

  test('returns undefined when the selection is empty', () => {
    expect(getSelectedTab([])).toBeUndefined();
  });
});
