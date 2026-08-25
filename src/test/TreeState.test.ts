import { describe, expect, test } from '@jest/globals';
import { Group, isGroup, isTab, Tab, TreeItemType } from '../models/types';
import { TreeState } from '../services/TreeState';

function createTab(id: string): Tab {
  return {
    type: TreeItemType.Tab,
    groupId: null,
    id,
  };
}

function createGroup(id: string): Group {
  return {
    type: TreeItemType.Group,
    children: [],
    colorId: '',
    id,
    label: id,
    collapsed: false,
  };
}

describe('TreeState grouping', () => {
  test('groups a tab dropped onto another root tab', () => {
    const a = createTab('A');
    const b = createTab('B');
    const c = createTab('C');
    const treeState = new TreeState();
    treeState.setState([a, b, c]);
    treeState.group(b, [a]);
    const state = treeState.getState();

    expect(state).toHaveLength(2);
    expect(isGroup(state[0])).toBe(true);
    expect((state[0] as Group).children).toEqual([b, a]);
    expect(isTab(state[1])).toBe(true);
  });

  test('groups multiple tabs dropped onto a root tab', () => {
    const a = createTab('A');
    const b = createTab('B');
    const c = createTab('C');
    const treeState = new TreeState();
    treeState.setState([a, b, c]);
    treeState.group(c, [a, b]);

    const state = treeState.getState();
    expect(state).toHaveLength(1);
    expect(isGroup(state[0])).toBe(true);
    expect((state[0] as Group).children).toEqual([c, a, b]);
  });
});

describe('TreeState ungrouping', () => {
  test('returns a grouped tab to the root after its group', () => {
    const group = createGroup('G');
    const a = createTab('A');
    const b = createTab('B');
    const c = createTab('C');
    a.groupId = group.id;
    b.groupId = group.id;
    group.children = [a, b];

    const treeState = new TreeState();
    treeState.setState([group, c]);
    treeState.ungroup([a]);

    const state = treeState.getState();
    expect(state).toHaveLength(3);
    expect(isGroup(state[0])).toBe(true);
    expect(state[1]).toBe(a);
    expect(state[2]).toBe(c);
  });
});
