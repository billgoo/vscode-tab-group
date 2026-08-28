import { describe, expect, jest, test } from '@jest/globals';
import type { Memento } from 'vscode';
import { SavedGroup } from '../models/SavedGroup';
import { SavedGroupsStore } from '../services/SavedGroupsStore';

function createStore(value: unknown): SavedGroupsStore {
  const workspaceState = {
    get: jest.fn().mockReturnValue(value),
  } as unknown as Memento;
  return new SavedGroupsStore(workspaceState);
}

function createSavedGroup(): SavedGroup {
  return {
    id: 'saved-group',
    sourceGroupId: 'live-group',
    name: 'Saved group',
    groupLabel: 'Live group',
    colorId: 'charts.green',
    collapsed: true,
    tabs: [
      { kind: 'text', id: 'text-id', uri: 'file:///workspace/first.ts' },
      {
        kind: 'textDiff',
        id: 'diff-id',
        originalUri: 'file:///workspace/original.ts',
        modifiedUri: 'file:///workspace/modified.ts',
        label: 'Compare files',
      },
      {
        kind: 'custom',
        id: 'custom-id',
        uri: 'file:///workspace/custom.foo',
        viewType: 'example.custom',
      },
      {
        kind: 'notebook',
        id: 'notebook-id',
        uri: 'file:///workspace/notebook.ipynb',
        notebookType: 'jupyter-notebook',
      },
      {
        kind: 'notebookDiff',
        id: 'notebook-diff-id',
        originalUri: 'file:///workspace/original.ipynb',
        modifiedUri: 'file:///workspace/modified.ipynb',
        notebookType: 'jupyter-notebook',
        label: 'Compare notebooks',
      },
    ],
  };
}

describe('SavedGroupsStore', () => {
  test('loads a valid versioned saved-groups state', () => {
    const groups = [createSavedGroup()];

    expect(createStore({ version: 1, groups }).load()).toEqual(groups);
  });

  test('rejects malformed or duplicate saved groups', () => {
    const group = createSavedGroup();

    expect(createStore({ version: 2, groups: [group] }).load()).toBeUndefined();
    expect(createStore({ version: 1, groups: [group, { ...group }] }).load()).toBeUndefined();
    expect(
      createStore({ version: 1, groups: [group, { ...group, id: 'other-id' }] }).load(),
    ).toBeUndefined();
    expect(
      createStore({
        version: 1,
        groups: [group, { ...group, id: 'other-id', name: 'Other group' }],
      }).load(),
    ).toBeUndefined();
    expect(
      createStore({
        version: 1,
        groups: [{ ...group, tabs: [{ kind: 'text', id: 'text-id' }] }],
      }).load(),
    ).toBeUndefined();
    expect(
      createStore({ version: 1, groups: [{ ...group, sourceGroupId: '' }] }).load(),
    ).toBeUndefined();
  });

  test('loads existing snapshots without a source group id', () => {
    const legacyGroup = { ...createSavedGroup() };
    delete legacyGroup.sourceGroupId;

    expect(createStore({ version: 1, groups: [legacyGroup] }).load()).toEqual([legacyGroup]);
  });

  test('allows duplicate display names for distinct snapshots', () => {
    const firstGroup = createSavedGroup();
    const secondGroup = {
      ...firstGroup,
      id: 'other-saved-group',
      sourceGroupId: 'other-live-group',
    };

    expect(createStore({ version: 1, groups: [firstGroup, secondGroup] }).load()).toEqual([
      firstGroup,
      secondGroup,
    ]);
  });

  test('saves groups in a versioned state envelope', async () => {
    const update = jest.fn(async (_key: string, _value: unknown) => {});
    const workspaceState = {
      get: jest.fn(),
      update,
    } as unknown as Memento;
    const groups = [createSavedGroup()];

    await new SavedGroupsStore(workspaceState).save(groups);

    expect(update).toHaveBeenCalledWith('tabs.workspace.saved-groups.key', {
      version: 1,
      groups,
    });
  });

  test('does not overwrite an unsupported saved-groups state version', async () => {
    const update = jest.fn(async () => {});
    const workspaceState = {
      get: jest.fn().mockReturnValue({ version: 2, groups: [] }),
      update,
    } as unknown as Memento;

    await expect(new SavedGroupsStore(workspaceState).save([createSavedGroup()])).rejects.toThrow(
      'newer version',
    );
    expect(update).not.toHaveBeenCalled();
  });
});
