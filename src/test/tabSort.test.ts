import { describe, expect, test } from '@jest/globals';
import {
  compareSortStrings,
  compareTabSortKeys,
  TabSortDirection,
  TabSortKey,
} from '../utils/tabSort';

function sortIds(keys: readonly TabSortKey[], direction: TabSortDirection): string[] {
  return keys
    .slice()
    .sort((leftKey, rightKey) => compareTabSortKeys(leftKey, rightKey, direction))
    .map(key => key.id);
}

describe('tab sort utilities', () => {
  const keys: TabSortKey[] = [
    { uri: 'file:///workspace/zebra/app.ts', id: 'zebra' },
    { uri: 'file:///workspace/readme/README.md', id: 'readme' },
    { uri: 'file:///workspace/alpha/app.ts', id: 'alpha' },
  ];

  test('sorts by URI in both directions with a stable ID tie-breaker', () => {
    expect(sortIds(keys, 'ascending')).toEqual(['alpha', 'readme', 'zebra']);
    expect(sortIds(keys, 'descending')).toEqual(['zebra', 'readme', 'alpha']);
    expect(
      sortIds(
        [
          { uri: 'file:///workspace/app.ts', id: 'second' },
          { uri: 'file:///workspace/app.ts', id: 'first' },
        ],
        'ascending',
      ),
    ).toEqual(['first', 'second']);
  });

  test('sorts group labels case-insensitively in either direction', () => {
    expect(compareSortStrings('alpha', 'Zulu', 'ascending')).toBeLessThan(0);
    expect(compareSortStrings('alpha', 'Zulu', 'descending')).toBeGreaterThan(0);
  });

  test('orders complete group-label lists in both directions', () => {
    const labels = ['Zulu', 'alpha', 'Bravo'];

    expect(
      labels
        .slice()
        .sort((leftLabel, rightLabel) => compareSortStrings(leftLabel, rightLabel, 'ascending')),
    ).toEqual(['alpha', 'Bravo', 'Zulu']);
    expect(
      labels
        .slice()
        .sort((leftLabel, rightLabel) => compareSortStrings(leftLabel, rightLabel, 'descending')),
    ).toEqual(['Zulu', 'Bravo', 'alpha']);
  });
});
