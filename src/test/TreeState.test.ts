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

describe('TreeState sorting', () => {
  test('reorders tabs within their existing group', () => {
    const group = createGroup('group');
    const firstTab = createTab('first');
    const secondTab = createTab('second');
    const thirdTab = createTab('third');
    firstTab.groupId = group.id;
    secondTab.groupId = group.id;
    thirdTab.groupId = group.id;
    group.children = [firstTab, secondTab, thirdTab];
    const treeState = new TreeState();
    treeState.setState([group]);

    expect(treeState.sort(secondTab, [thirdTab])).toBe(true);
    expect(group.children).toEqual([firstTab, thirdTab, secondTab]);
    expect(thirdTab.groupId).toBe(group.id);
  });

  test('rejects sort operations across group boundaries', () => {
    const rootTab = createTab('root');
    const group = createGroup('group');
    const groupedTab = createTab('grouped');
    groupedTab.groupId = group.id;
    group.children = [groupedTab];
    const treeState = new TreeState();
    treeState.setState([rootTab, group]);

    expect(treeState.sort(groupedTab, [rootTab])).toBe(false);
    expect(treeState.sort(undefined, [groupedTab])).toBe(false);
    expect(treeState.getState()).toEqual([rootTab, group]);
    expect(group.children).toEqual([groupedTab]);
  });

  test('sorts root tabs without moving groups or their children', () => {
    const firstRootTab = createTab('charlie');
    const group = createGroup('group');
    const secondRootTab = createTab('alpha');
    const thirdRootTab = createTab('bravo');
    const firstGroupedTab = createTab('zulu');
    const secondGroupedTab = createTab('echo');
    firstGroupedTab.groupId = group.id;
    secondGroupedTab.groupId = group.id;
    group.children = [firstGroupedTab, secondGroupedTab];
    const treeState = new TreeState();
    treeState.setState([firstRootTab, group, secondRootTab, thirdRootTab]);

    expect(treeState.sortTabs((leftTab, rightTab) => leftTab.id.localeCompare(rightTab.id))).toBe(
      true,
    );
    expect(treeState.getState()).toEqual([secondRootTab, group, thirdRootTab, firstRootTab]);
    expect(group.children).toEqual([firstGroupedTab, secondGroupedTab]);
    expect(firstGroupedTab.groupId).toBe(group.id);
    expect(secondGroupedTab.groupId).toBe(group.id);
  });

  test('sorts groups by label in both directions without moving root tabs or group children', () => {
    const firstRootTab = createTab('first-root');
    const firstGroup = createGroup('first-group');
    const secondRootTab = createTab('second-root');
    const secondGroup = createGroup('second-group');
    const firstGroupedTab = createTab('first-grouped');
    const secondGroupedTab = createTab('second-grouped');
    firstGroup.label = 'Zulu';
    secondGroup.label = 'Alpha';
    firstGroupedTab.groupId = firstGroup.id;
    secondGroupedTab.groupId = secondGroup.id;
    firstGroup.children = [firstGroupedTab];
    secondGroup.children = [secondGroupedTab];
    const treeState = new TreeState();
    treeState.setState([firstRootTab, firstGroup, secondRootTab, secondGroup]);

    expect(
      treeState.sortGroups((leftGroup, rightGroup) =>
        leftGroup.label.localeCompare(rightGroup.label),
      ),
    ).toBe(true);
    expect(treeState.getState()).toEqual([firstRootTab, secondGroup, secondRootTab, firstGroup]);
    expect(firstGroup.children).toEqual([firstGroupedTab]);

    expect(
      treeState.sortGroups((leftGroup, rightGroup) =>
        rightGroup.label.localeCompare(leftGroup.label),
      ),
    ).toBe(true);
    expect(treeState.getState()).toEqual([firstRootTab, firstGroup, secondRootTab, secondGroup]);
    expect(firstGroup.children).toEqual([firstGroupedTab]);
    expect(secondGroup.children).toEqual([secondGroupedTab]);
    expect(secondGroup.children).toEqual([secondGroupedTab]);
  });

  test('sorts tabs in one group without changing root tabs or another group', () => {
    const firstGroup = createGroup('first-group');
    const secondGroup = createGroup('second-group');
    const firstRootTab = createTab('root-zulu');
    const secondRootTab = createTab('root-alpha');
    const firstGroupZuluTab = createTab('zulu');
    const firstGroupAlphaTab = createTab('alpha');
    const secondGroupZuluTab = createTab('second-zulu');
    const secondGroupAlphaTab = createTab('second-alpha');
    firstGroupZuluTab.groupId = firstGroup.id;
    firstGroupAlphaTab.groupId = firstGroup.id;
    secondGroupZuluTab.groupId = secondGroup.id;
    secondGroupAlphaTab.groupId = secondGroup.id;
    firstGroup.children = [firstGroupZuluTab, firstGroupAlphaTab];
    secondGroup.children = [secondGroupZuluTab, secondGroupAlphaTab];
    const treeState = new TreeState();
    treeState.setState([firstRootTab, firstGroup, secondRootTab, secondGroup]);

    expect(
      treeState.sortTabs(
        (leftTab, rightTab) => leftTab.id.localeCompare(rightTab.id),
        firstGroup.id,
      ),
    ).toBe(true);
    expect(treeState.getState()).toEqual([firstRootTab, firstGroup, secondRootTab, secondGroup]);
    expect(firstGroup.children).toEqual([firstGroupAlphaTab, firstGroupZuluTab]);
    expect(secondGroup.children).toEqual([secondGroupZuluTab, secondGroupAlphaTab]);
  });

  test('sorts root tabs and every group without changing group membership', () => {
    const firstRootTab = createTab('root-zulu');
    const secondRootTab = createTab('root-alpha');
    const firstGroup = createGroup('first-group');
    const secondGroup = createGroup('second-group');
    const firstGroupZuluTab = createTab('first-zulu');
    const firstGroupAlphaTab = createTab('first-alpha');
    const secondGroupZuluTab = createTab('second-zulu');
    const secondGroupAlphaTab = createTab('second-alpha');
    firstGroupZuluTab.groupId = firstGroup.id;
    firstGroupAlphaTab.groupId = firstGroup.id;
    secondGroupZuluTab.groupId = secondGroup.id;
    secondGroupAlphaTab.groupId = secondGroup.id;
    firstGroup.children = [firstGroupZuluTab, firstGroupAlphaTab];
    secondGroup.children = [secondGroupZuluTab, secondGroupAlphaTab];
    const treeState = new TreeState();
    treeState.setState([firstRootTab, firstGroup, secondRootTab, secondGroup]);

    expect(
      treeState.sortAllTabs((leftTab, rightTab) => leftTab.id.localeCompare(rightTab.id)),
    ).toBe(true);
    expect(treeState.getState()).toEqual([secondRootTab, firstGroup, firstRootTab, secondGroup]);
    expect(firstGroup.children).toEqual([firstGroupAlphaTab, firstGroupZuluTab]);
    expect(secondGroup.children).toEqual([secondGroupAlphaTab, secondGroupZuluTab]);
    expect(firstGroupAlphaTab.groupId).toBe(firstGroup.id);
    expect(secondGroupAlphaTab.groupId).toBe(secondGroup.id);
  });

  test('does not report a state change when every tab is already sorted', () => {
    const firstTab = createTab('alpha');
    const secondTab = createTab('bravo');
    const treeState = new TreeState();
    treeState.setState([firstTab, secondTab]);

    expect(treeState.sortTabs((leftTab, rightTab) => leftTab.id.localeCompare(rightTab.id))).toBe(
      false,
    );
    expect(treeState.getState()).toEqual([firstTab, secondTab]);
  });

  test('does not report a state change when every group is already sorted', () => {
    const firstGroup = createGroup('alpha');
    const secondGroup = createGroup('bravo');
    const firstGroupedTab = createTab('first-grouped');
    const secondGroupedTab = createTab('second-grouped');
    firstGroupedTab.groupId = firstGroup.id;
    secondGroupedTab.groupId = secondGroup.id;
    firstGroup.children = [firstGroupedTab];
    secondGroup.children = [secondGroupedTab];
    const treeState = new TreeState();
    treeState.setState([firstGroup, secondGroup]);

    expect(
      treeState.sortGroups((leftGroup, rightGroup) =>
        leftGroup.label.localeCompare(rightGroup.label),
      ),
    ).toBe(false);
    expect(treeState.getState()).toEqual([firstGroup, secondGroup]);
  });
});

describe('TreeState appending', () => {
  test('appends a new tab to the root when a group exists', () => {
    const group = createGroup('G');
    const existingTab = createTab('A');
    group.children = [existingTab];
    existingTab.groupId = group.id;

    const treeState = new TreeState();
    treeState.setState([group]);
    treeState.appendTab('B');

    const appendedTab = treeState.getTab('B');
    expect(appendedTab?.groupId).toBeNull();
    expect(group.children).toEqual([existingTab]);
    expect(treeState.getState()).toEqual([group, appendedTab]);
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

describe('TreeState saved group restoration', () => {
  test('creates a new group with saved metadata and moves tabs in saved order', () => {
    const firstTab = createTab('first');
    const previousGroup = createGroup('previous');
    const secondTab = createTab('second');
    const remainingTab = createTab('remaining');
    secondTab.groupId = previousGroup.id;
    previousGroup.children = [secondTab];

    const treeState = new TreeState();
    treeState.setState([firstTab, previousGroup, remainingTab]);

    const restoredGroup = treeState.restoreGroup([secondTab, firstTab], {
      colorId: 'charts.green',
      label: 'Saved group',
      collapsed: true,
    });

    expect(restoredGroup).toMatchObject({
      type: TreeItemType.Group,
      colorId: 'charts.green',
      label: 'Saved group',
      collapsed: true,
      children: [secondTab, firstTab],
    });
    expect(restoredGroup?.id).not.toBe(previousGroup.id);
    expect(treeState.getState()).toEqual([remainingTab, restoredGroup]);
  });

  test('reuses a saved group source id instead of creating a second live group', () => {
    const firstTab = createTab('first');
    const secondTab = createTab('second');
    const extraTab = createTab('extra');
    const treeState = new TreeState();
    treeState.setState([firstTab, secondTab, extraTab]);
    const savedGroup = {
      colorId: 'charts.green',
      label: 'Saved group',
      collapsed: false,
    };

    const firstRestore = treeState.restoreGroup([firstTab, secondTab], savedGroup, 'source-group');
    treeState.group(firstRestore!, [extraTab]);
    const secondRestore = treeState.restoreGroup([secondTab, firstTab], savedGroup, 'source-group');

    expect(firstRestore?.id).toBe('source-group');
    expect(secondRestore).toBe(firstRestore);
    expect(secondRestore?.children).toEqual([secondTab, firstTab]);
    expect(extraTab.groupId).toBeNull();
    expect(treeState.getState()).toEqual([firstRestore, extraTab]);
  });
});
