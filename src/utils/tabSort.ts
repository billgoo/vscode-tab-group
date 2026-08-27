export type TabSortKey = {
  readonly uri: string;
  readonly id: string;
};

export type TabSortDirection = 'ascending' | 'descending';

export function createTabSortKey(uri: string, id: string): TabSortKey {
  return { uri: uri || id, id };
}

export function compareTabSortKeys(
  leftKey: TabSortKey,
  rightKey: TabSortKey,
  direction: TabSortDirection,
): number {
  const comparison =
    compareSortStrings(leftKey.uri, rightKey.uri, direction) ||
    compareSortStrings(leftKey.id, rightKey.id, direction);
  return comparison;
}

export function compareSortStrings(
  left: string,
  right: string,
  direction: TabSortDirection,
): number {
  const comparison = left.localeCompare(right, 'en', { sensitivity: 'base' });
  return direction === 'ascending' ? comparison : -comparison;
}
