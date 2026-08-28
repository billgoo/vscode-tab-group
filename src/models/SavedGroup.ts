export type SavedTextTab = {
  readonly kind: 'text';
  readonly id: string;
  readonly uri: string;
};

export type SavedTextDiffTab = {
  readonly kind: 'textDiff';
  readonly id: string;
  readonly originalUri: string;
  readonly modifiedUri: string;
  readonly label: string;
};

export type SavedCustomTab = {
  readonly kind: 'custom';
  readonly id: string;
  readonly uri: string;
  readonly viewType: string;
};

export type SavedNotebookTab = {
  readonly kind: 'notebook';
  readonly id: string;
  readonly uri: string;
  readonly notebookType: string;
};

export type SavedNotebookDiffTab = {
  readonly kind: 'notebookDiff';
  readonly id: string;
  readonly originalUri: string;
  readonly modifiedUri: string;
  readonly notebookType: string;
  readonly label: string;
};

export type SavedTab =
  SavedTextTab | SavedTextDiffTab | SavedCustomTab | SavedNotebookTab | SavedNotebookDiffTab;

export type SavedGroup = {
  readonly id: string;
  readonly sourceGroupId?: string;
  readonly name: string;
  readonly groupLabel: string;
  readonly colorId: string;
  readonly collapsed: boolean;
  readonly tabs: readonly SavedTab[];
};

export type SavedGroupsState = {
  readonly version: 1;
  readonly groups: readonly SavedGroup[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isSavedTab(value: unknown): value is SavedTab {
  if (!isRecord(value) || !isNonEmptyString(value.id)) {
    return false;
  }

  switch (value.kind) {
    case 'text':
      return isNonEmptyString(value.uri);
    case 'textDiff':
      return (
        isNonEmptyString(value.originalUri) &&
        isNonEmptyString(value.modifiedUri) &&
        isString(value.label)
      );
    case 'custom':
      return isNonEmptyString(value.uri) && isNonEmptyString(value.viewType);
    case 'notebook':
      return isNonEmptyString(value.uri) && isNonEmptyString(value.notebookType);
    case 'notebookDiff':
      return (
        isNonEmptyString(value.originalUri) &&
        isNonEmptyString(value.modifiedUri) &&
        isNonEmptyString(value.notebookType) &&
        isString(value.label)
      );
    default:
      return false;
  }
}

function isSavedGroup(value: unknown): value is SavedGroup {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.id) ||
    (value.sourceGroupId !== undefined && !isNonEmptyString(value.sourceGroupId)) ||
    !isNonEmptyString(value.name) ||
    !isString(value.groupLabel) ||
    !isString(value.colorId) ||
    typeof value.collapsed !== 'boolean' ||
    !Array.isArray(value.tabs) ||
    value.tabs.length === 0 ||
    !value.tabs.every(isSavedTab)
  ) {
    return false;
  }

  return new Set(value.tabs.map(tab => tab.id)).size === value.tabs.length;
}

export function isSavedGroupsState(value: unknown): value is SavedGroupsState {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.groups)) {
    return false;
  }

  if (!value.groups.every(isSavedGroup)) {
    return false;
  }

  const sourceGroupIds = value.groups
    .map(group => group.sourceGroupId)
    .filter((sourceGroupId): sourceGroupId is string => sourceGroupId !== undefined);
  return (
    new Set(value.groups.map(group => group.id)).size === value.groups.length &&
    new Set(sourceGroupIds).size === sourceGroupIds.length
  );
}
