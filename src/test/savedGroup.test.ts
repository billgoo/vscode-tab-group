import { describe, expect, test } from '@jest/globals';
import { SavedGroup } from '../models/SavedGroup';
import { Group, TreeItemType } from '../models/types';
import { createSavedGroupSnapshot } from '../utils/savedGroup';

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
  test('uses the live group ID and label without requiring a snapshot name', () => {
    const snapshot = createSavedGroupSnapshot(createGroup(), tabs, []);

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

  test('uses the group ID for unnamed or duplicate labels', () => {
    const existingGroup: SavedGroup = {
      id: 'other-group',
      name: 'Work files',
      groupLabel: 'Work files',
      colorId: 'charts.blue',
      collapsed: false,
      tabs,
    };

    expect(createSavedGroupSnapshot(createGroup({ label: '   ' }), tabs, []).name).toBe(
      'live-group',
    );
    expect(createSavedGroupSnapshot(createGroup(), tabs, [existingGroup]).name).toBe('live-group');
  });

  test('updates a legacy snapshot by source ID and preserves its name', () => {
    const existingGroup: SavedGroup = {
      id: 'saved-snapshot',
      sourceGroupId: 'live-group',
      name: 'Pinned files',
      groupLabel: 'Old label',
      colorId: 'charts.blue',
      collapsed: true,
      tabs,
    };

    const snapshot = createSavedGroupSnapshot(createGroup(), tabs, [existingGroup]);

    expect(snapshot.id).toBe('live-group');
    expect(snapshot.sourceGroupId).toBe('live-group');
    expect(snapshot.name).toBe('Pinned files');
  });
});
