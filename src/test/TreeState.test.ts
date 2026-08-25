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

describe('TreeState group colors', () => {
  test('updates a persisted group color by group id', () => {
    const group = createGroup('G');
    const tab = createTab('A');
    group.colorId = 'charts.blue';
    tab.groupId = group.id;
    group.children = [tab];
    const treeState = new TreeState();
    treeState.setState([group]);

    treeState.setGroupColor(group.id, 'charts.orange');

    expect(treeState.getGroup(group.id)?.colorId).toBe('charts.orange');
    expect((treeState.getState()[0] as Group).colorId).toBe('charts.orange');
  });

  test('does not change another group when the group id is unknown', () => {
    const group = createGroup('G');
    group.colorId = 'charts.blue';
    const treeState = new TreeState();
    treeState.setState([group]);

    treeState.setGroupColor('unknown', 'charts.orange');

    expect(treeState.getGroup(group.id)?.colorId).toBe('charts.blue');
  });
});
