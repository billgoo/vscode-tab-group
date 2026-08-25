import { describe, expect, test } from '@jest/globals';
import { findLongestCommonFilePathPrefixIndex } from '../utils/filePath';

describe('findLongestCommonFilePathPrefixIndex', () => {
  test('finds the final common segment without reordering the input', () => {
    const paths = [
      ['workspace', 'src', 'feature', 'index.ts'],
      ['workspace', 'src', 'shared', 'index.ts'],
      ['workspace', 'README.md'],
    ];

    expect(findLongestCommonFilePathPrefixIndex(paths)).toBe(0);
    expect(paths).toEqual([
      ['workspace', 'src', 'feature', 'index.ts'],
      ['workspace', 'src', 'shared', 'index.ts'],
      ['workspace', 'README.md'],
    ]);
  });

  test('returns negative one when there are no paths', () => {
    expect(findLongestCommonFilePathPrefixIndex([])).toBe(-1);
  });
});
