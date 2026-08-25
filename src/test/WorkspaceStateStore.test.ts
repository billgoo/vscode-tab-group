import { describe, expect, jest, test } from '@jest/globals';
import type { Memento } from 'vscode';
import { TreeItemType } from '../models/types';
import { WorkspaceStateStore } from '../services/WorkspaceStateStore';

function createStore(value: unknown): WorkspaceStateStore {
  const workspaceState = {
    get: jest.fn().mockReturnValue(value),
  } as unknown as Memento;
  return new WorkspaceStateStore(workspaceState);
}

describe('WorkspaceStateStore', () => {
  test('loads a valid main state', () => {
    const state = [
      {
        type: TreeItemType.Group,
        id: 'group',
        colorId: 'charts.blue',
        label: 'Group',
        children: [{ type: TreeItemType.Tab, groupId: 'group', id: 'first' }],
        collapsed: false,
      },
      { type: TreeItemType.Tab, groupId: null, id: 'second' },
    ];

    expect(createStore(state).load()).toEqual(state);
  });

  test('ignores a non-array main state value', () => {
    expect(
      createStore({ type: TreeItemType.Tab, groupId: null, id: 'first' }).load(),
    ).toBeUndefined();
  });

  test('rejects malformed main state items', () => {
    expect(createStore([{ type: TreeItemType.Tab, groupId: 'group' }]).load()).toBeUndefined();
    expect(
      createStore([
        {
          type: TreeItemType.Group,
          id: 'group',
          colorId: 'charts.blue',
          label: 'Group',
          children: {},
          collapsed: false,
        },
      ]).load(),
    ).toBeUndefined();
  });

  test('rejects duplicate or inconsistent persisted IDs', () => {
    expect(
      createStore([
        { type: TreeItemType.Tab, groupId: null, id: 'first' },
        { type: TreeItemType.Tab, groupId: null, id: 'first' },
      ]).load(),
    ).toBeUndefined();
    expect(
      createStore([
        {
          type: TreeItemType.Group,
          id: 'group',
          colorId: 'charts.blue',
          label: 'Group',
          children: [{ type: TreeItemType.Tab, groupId: null, id: 'first' }],
          collapsed: false,
        },
      ]).load(),
    ).toBeUndefined();
  });

  test('filters invalid recent tab entries at the storage boundary', () => {
    expect(createStore(['first', 42, null, 'second']).loadRecentTabs()).toEqual([
      'first',
      'second',
    ]);
  });

  test('ignores a non-array recent tab value', () => {
    expect(createStore({ tabId: 'first' }).loadRecentTabs()).toBeUndefined();
  });
});
