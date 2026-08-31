import { describe, expect, test } from '@jest/globals';
import { getCustomTabId, getNormalizedNotebookDiffId, getNotebookTabId } from '../utils/tabId';

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

  test('creates stable custom and notebook IDs from their full resources', () => {
    const customUri = 'vscode-remote://ssh-remote%2Bworkspace/project/example.custom';
    const notebookUri = 'vscode-remote://ssh-remote%2Bworkspace/project/example.ipynb';

    expect(getCustomTabId(customUri, 'example.custom')).toBe(
      JSON.stringify({ uri: customUri, viewType: 'example.custom' }),
    );
    expect(getNotebookTabId(notebookUri, 'jupyter-notebook')).toBe(
      JSON.stringify({ uri: notebookUri, notebookType: 'jupyter-notebook' }),
    );
  });
});
