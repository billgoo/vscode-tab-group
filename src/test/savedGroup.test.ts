import { describe, expect, test } from '@jest/globals';
import { SavedGroup } from '../models/SavedGroup';
import { Group, TreeItemType } from '../models/types';
import {
  createSavedGroupSnapshot,
  filterRestorableTabs,
  sortSavedGroups,
  updateSavedGroupSnapshotName,
  upsertSavedGroupSnapshot,
} from '../utils/savedGroup';

function createGroup(overrides: Partial<Group> = {}): Group {
  return {
    type: TreeItemType.Group,
    id: 'live-group',
    label: 'Work files',
    colorId: 'charts.green',
    collapsed: false,
    children: [],
    ...overrides,
  };
}

const tabs = [{ kind: 'text', id: 'file-id', uri: 'file:///workspace/file.ts' }] as const;

describe('saved group snapshots', () => {
  test('omits live-only tabs that cannot be restored', () => {
    const secondTab = {
      kind: 'text' as const,
      id: 'second-file-id',
      uri: 'file:///workspace/second-file.ts',
    };

    expect(filterRestorableTabs([tabs[0], undefined, secondTab])).toEqual([tabs[0], secondTab]);
  });

  test('uses the live group ID and label without requiring a snapshot name', () => {
    const snapshot = createSavedGroupSnapshot(createGroup(), tabs);

    expect(snapshot).toEqual({
      id: 'live-group',
      sourceGroupId: 'live-group',
      name: 'Work files',
      groupLabel: 'Work files',
      colorId: 'charts.green',
      collapsed: false,
      tabs,
    });
  });

  test('uses untitled for an unnamed group', () => {
    expect(createSavedGroupSnapshot(createGroup({ label: '   ' }), tabs).name).toBe('untitled');
  });

  test('sorts saved groups by display name in both directions', () => {
    const zuluGroup: SavedGroup = {
      ...createSavedGroupSnapshot(createGroup({ id: 'zulu', label: 'Zulu' }), tabs),
    };
    const alphaGroup: SavedGroup = {
      ...createSavedGroupSnapshot(createGroup({ id: 'alpha', label: 'alpha' }), tabs),
    };
    const bravoGroup: SavedGroup = {
      ...createSavedGroupSnapshot(createGroup({ id: 'bravo', label: 'Bravo' }), tabs),
    };

    expect(
      sortSavedGroups([zuluGroup, alphaGroup, bravoGroup], 'ascending').map(group => group.id),
    ).toEqual(['alpha', 'bravo', 'zulu']);
    expect(
      sortSavedGroups([zuluGroup, alphaGroup, bravoGroup], 'descending').map(group => group.id),
    ).toEqual(['zulu', 'bravo', 'alpha']);
  });

  test('updates an existing snapshot for the same live group', () => {
    const existingGroup: SavedGroup = {
      id: 'legacy-snapshot',
      sourceGroupId: 'live-group',
      name: 'Old name',
      groupLabel: 'Old label',
      colorId: 'charts.blue',
      collapsed: true,
      tabs,
    };

    const snapshotUpdate = upsertSavedGroupSnapshot(
      [existingGroup],
      createGroup({ label: 'Updated label' }),
      tabs,
    );

    expect(snapshotUpdate).toMatchObject({
      savedGroup: {
        id: 'live-group',
        sourceGroupId: 'live-group',
        name: 'Updated label',
      },
      updated: true,
    });
    expect(snapshotUpdate.savedGroups).toEqual([snapshotUpdate.savedGroup]);
  });

  test('updates a saved snapshot title from the live group name', () => {
    const existingGroup: SavedGroup = {
      id: 'saved-snapshot',
      sourceGroupId: 'live-group',
      name: 'Pinned files',
      groupLabel: 'Old label',
      colorId: 'charts.blue',
      collapsed: true,
      tabs,
    };

    const snapshots = updateSavedGroupSnapshotName([existingGroup], 'live-group', 'New label');
    const snapshot = snapshots[0];

    expect(snapshot).toMatchObject({
      id: 'saved-snapshot',
      sourceGroupId: 'live-group',
      name: 'New label',
      groupLabel: 'New label',
    });
  });

  test('updates a saved snapshot title to untitled when the group is cleared', () => {
    const existingGroup: SavedGroup = {
      id: 'saved-snapshot',
      sourceGroupId: 'live-group',
      name: 'Old label',
      groupLabel: 'Old label',
      colorId: 'charts.blue',
      collapsed: true,
      tabs,
    };

    expect(updateSavedGroupSnapshotName([existingGroup], 'live-group', ' ')[0]).toMatchObject({
      name: 'untitled',
      groupLabel: ' ',
    });
  });
});
