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

export function createSavedGroupSnapshot(
  group: SavedGroupSource,
  tabs: readonly SavedTab[],
  savedGroups: readonly SavedGroup[],
): SavedGroup {
  const existingGroup = findSavedGroupForSource(savedGroups, group.id);
  const usedNames = new Set(
    savedGroups
      .filter(savedGroup => savedGroup.id !== existingGroup?.id)
      .map(savedGroup => savedGroup.name),
  );
  const label = group.label.trim();
  const name =
    existingGroup?.name ?? (label.length > 0 && !usedNames.has(label) ? label : group.id);

  return {
    id: group.id,
    sourceGroupId: group.id,
    name,
    groupLabel: group.label,
    colorId: group.colorId,
    collapsed: group.collapsed,
    tabs: [...tabs],
  };
}
