import { describe, expect, test } from '@jest/globals';
import { getGroupColorOption, getNextColorId, groupColorOptions } from '../utils/color';

describe('group color palette', () => {
  test('uses a balanced, selectable color palette', () => {
    expect(groupColorOptions.map(color => color.label)).toEqual([
      'Blue',
      'Green',
      'Yellow',
      'Orange',
      'Red',
      'Purple',
    ]);
    expect(getNextColorId()).toBe('charts.blue');
    expect(getGroupColorOption('charts.orange')).toMatchObject({
      swatch: '🟠',
      themeColorId: 'terminal.ansiYellow',
    });
  });

  test('uses an unassigned color before reusing a color', () => {
    const usedColorIds = groupColorOptions.slice(0, -1).map(color => color.id);

    expect(getNextColorId(usedColorIds)).toBe('charts.purple');
  });
});
