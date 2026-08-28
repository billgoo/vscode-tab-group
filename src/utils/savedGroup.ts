import { Group } from '../models/types';
import { SavedGroup, SavedTab } from '../models/SavedGroup';
import { compareSortStrings, TabSortDirection } from './tabSort';

type SavedGroupSource = Pick<Group, 'id' | 'label' | 'colorId' | 'collapsed'>;

export type SavedGroupSnapshotUpsert = {
  readonly savedGroups: readonly SavedGroup[];
  readonly savedGroup: SavedGroup;
  readonly updated: boolean;
};

export function findSavedGroupForSource(
  savedGroups: readonly SavedGroup[],
  sourceGroupId: string,
): SavedGroup | undefined {
  return savedGroups.find(
    savedGroup => savedGroup.id === sourceGroupId || savedGroup.sourceGroupId === sourceGroupId,
  );
}

export function getSavedGroupName(label: string): string {
  const name = label.trim();
  return name || 'untitled';
}

export function sortSavedGroups(
  savedGroups: readonly SavedGroup[],
  direction: TabSortDirection,
): SavedGroup[] {
  return [...savedGroups].sort(
    (leftGroup, rightGroup) =>
      compareSortStrings(leftGroup.name, rightGroup.name, direction) ||
      compareSortStrings(leftGroup.id, rightGroup.id, direction),
  );
}

export function createSavedGroupSnapshot(
  group: SavedGroupSource,
  tabs: readonly SavedTab[],
): SavedGroup {
  return {
    id: group.id,
    sourceGroupId: group.id,
    name: getSavedGroupName(group.label),
    groupLabel: group.label,
    colorId: group.colorId,
    collapsed: group.collapsed,
    tabs: [...tabs],
  };
}

export function upsertSavedGroupSnapshot(
  savedGroups: readonly SavedGroup[],
  group: SavedGroupSource,
  tabs: readonly SavedTab[],
): SavedGroupSnapshotUpsert {
  const existingGroup = findSavedGroupForSource(savedGroups, group.id);
  const savedGroup = createSavedGroupSnapshot(group, tabs);
  return {
    savedGroups: existingGroup
      ? savedGroups.map(candidate => (candidate.id === existingGroup.id ? savedGroup : candidate))
      : [...savedGroups, savedGroup],
    savedGroup,
    updated: existingGroup !== undefined,
  };
}

export function updateSavedGroupSnapshotName(
  savedGroups: readonly SavedGroup[],
  sourceGroupId: string,
  label: string,
): readonly SavedGroup[] {
  const savedGroup = findSavedGroupForSource(savedGroups, sourceGroupId);
  if (!savedGroup) {
    return savedGroups;
  }

  return savedGroups.map(candidate =>
    candidate.id === savedGroup.id
      ? { ...candidate, name: getSavedGroupName(label), groupLabel: label }
      : candidate,
  );
}
