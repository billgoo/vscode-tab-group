import { describe, expect, test } from '@jest/globals';
import { getNormalizedNotebookDiffId } from '../utils/tabId';

describe('tab IDs', () => {
  test('keeps notebook diff resources and type distinct', () => {
    const original = {
      scheme: 'file',
      authority: '',
      path: '/workspace/original.ipynb',
      query: 'version=1',
      fragment: 'cell-1',
    };
    const modified = {
      scheme: 'file',
      authority: '',
      path: '/workspace/modified.ipynb',
      query: 'version=2',
      fragment: 'cell-2',
    };

    expect(getNormalizedNotebookDiffId(original, modified, 'jupyter-notebook')).toBe(
      JSON.stringify({
        original,
        modified,
        notebookType: 'jupyter-notebook',
      }),
    );
  });
});
