import { Group } from '../models/types';
import { SavedGroup, SavedTab } from '../models/SavedGroup';

type SavedGroupSource = Pick<Group, 'id' | 'label' | 'colorId' | 'collapsed'>;

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
