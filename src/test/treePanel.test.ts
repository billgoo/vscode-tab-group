import { describe, expect, jest, test } from '@jest/globals';
import { sortItems, sortItemsInPlace } from '../utils/arrays';
import {
  collapseAllTreeItems,
  expandAllTreeItems,
  focusTreeItem,
  selectTreeItem,
  TreePanelRevealOptions,
  TreePanelView,
} from '../utils/treePanel';

type Item = {
  readonly id: string;
  readonly expandable: boolean;
};

function createTreeView() {
  const reveal = jest.fn(async (_item: Item, _options?: TreePanelRevealOptions) => {});
  const treeView: TreePanelView<Item> = { reveal };
  return { reveal, treeView };
}

describe('tree panel helpers', () => {
  test('sorts a copy without changing the source items', () => {
    const items = ['charlie', 'alpha', 'bravo'];

    expect(sortItems(items, (left, right) => left.localeCompare(right))).toEqual([
      'alpha',
      'bravo',
      'charlie',
    ]);
    expect(items).toEqual(['charlie', 'alpha', 'bravo']);
  });

  test('sorts mutable items in place only when their order changes', () => {
    const items = ['charlie', 'alpha', 'bravo'];

    expect(sortItemsInPlace(items, (left, right) => left.localeCompare(right))).toBe(true);
    expect(items).toEqual(['alpha', 'bravo', 'charlie']);
    expect(sortItemsInPlace(items, (left, right) => left.localeCompare(right))).toBe(false);
  });

  test('expands only expandable items and records completed expansions', async () => {
    const firstItem: Item = { id: 'first', expandable: true };
    const secondItem: Item = { id: 'second', expandable: false };
    const thirdItem: Item = { id: 'third', expandable: true };
    const { reveal, treeView } = createTreeView();
    const expandedIds: string[] = [];

    await expandAllTreeItems(
      treeView,
      [firstItem, secondItem, thirdItem],
      item => item.expandable,
      { select: false },
      item => expandedIds.push(item.id),
    );

    expect(reveal).toHaveBeenCalledTimes(2);
    expect(reveal).toHaveBeenNthCalledWith(1, firstItem, {
      expand: true,
      select: false,
    });
    expect(reveal).toHaveBeenNthCalledWith(2, thirdItem, {
      expand: true,
      select: false,
    });
    expect(expandedIds).toEqual(['first', 'third']);
  });

  test('focuses the requested item before collapsing the active tree panel', async () => {
    const item: Item = { id: 'saved-group', expandable: true };
    const { reveal, treeView } = createTreeView();
    const collapseAll = jest.fn(async () => {});

    await collapseAllTreeItems(treeView, collapseAll, item);

    expect(reveal).toHaveBeenCalledWith(item, { focus: true, select: false });
    expect(collapseAll).toHaveBeenCalledTimes(1);
    expect(reveal.mock.invocationCallOrder[0]).toBeLessThan(
      collapseAll.mock.invocationCallOrder[0],
    );
  });

  test('focuses a tree panel item before expanding the panel', async () => {
    const item: Item = { id: 'saved-group', expandable: true };
    const { reveal, treeView } = createTreeView();

    await focusTreeItem(treeView, item);

    expect(reveal).toHaveBeenCalledWith(item, { focus: true, select: false });
  });

  test('expands a collapsed parent before selecting a nested item', async () => {
    const group: Item = { id: 'group', expandable: true };
    const item: Item = { id: 'nested-tab', expandable: false };
    const { reveal, treeView } = createTreeView();

    await selectTreeItem(treeView, item, group);

    expect(reveal).toHaveBeenNthCalledWith(1, group, {
      expand: true,
      focus: false,
      select: false,
    });
    expect(reveal).toHaveBeenNthCalledWith(2, item, {
      expand: true,
      focus: false,
      select: true,
    });
  });
});
