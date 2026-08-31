import { describe, expect, test } from '@jest/globals';
import { Folder, Group, Slot, Tab, TreeItemType } from '../models/types';
import { findActiveItem, getSelectedTab } from '../utils/tabSelection';

type TestActiveItem = {
  readonly id: string;
  readonly isActive: boolean;
};

function createTab(id: string): Tab {
  return { type: TreeItemType.Tab, groupId: null, id };
}

describe('tab selection utilities', () => {
  test('finds the active item when an inactive item appears first', () => {
    const inactiveItem: TestActiveItem = { id: 'inactive', isActive: false };
    const activeItem: TestActiveItem = { id: 'active', isActive: true };

    expect(findActiveItem([inactiveItem, activeItem])).toBe(activeItem);
  });

  test('returns undefined when no item is active', () => {
    expect(findActiveItem<TestActiveItem>([{ id: 'inactive', isActive: false }])).toBeUndefined();
  });

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
