import { describe, expect, test } from '@jest/globals';
import { SavedTab } from '../models/SavedGroup';
import {
  getCustomTabId,
  getNotebookTabId,
  getSavedTabId,
  getSavedTabLabel,
  getSavedTabPath,
  getSavedTabUri,
} from '../utils/savedTab';

describe('saved tab utilities', () => {
  test('derives a URI, path, and label without VS Code APIs', () => {
    const savedTab: SavedTab = {
      kind: 'text',
      id: 'vscode-remote://ssh-remote%2Bworkspace/project/src/app.py?version=1#cell-2',
      uri: 'vscode-remote://ssh-remote%2Bworkspace/project/src/app.py?version=1#cell-2',
    };

    expect(getSavedTabUri(savedTab)).toBe(savedTab.uri);
    expect(getSavedTabPath(savedTab)).toBe('/project/src/app.py');
    expect(getSavedTabLabel(savedTab)).toBe('app.py');
  });

  test('uses saved labels and canonical full-resource IDs', () => {
    const diffTab: SavedTab = {
      kind: 'textDiff',
      id: 'diff-id',
      originalUri: 'file:///project/original.ts',
      modifiedUri: 'file:///project/modified.ts',
      label: 'Compare files',
    };
    const customUri = 'vscode-remote://ssh-remote%2Bworkspace/project/example.custom';
    const notebookUri = 'vscode-remote://ssh-remote%2Bworkspace/project/example.ipynb';

    expect(getSavedTabLabel(diffTab)).toBe('Compare files');
    expect(getSavedTabId(diffTab)).toBe('diff-id');
    expect(getCustomTabId(customUri, 'example.custom')).toBe(
      JSON.stringify({ uri: customUri, viewType: 'example.custom' }),
    );
    expect(getNotebookTabId(notebookUri, 'jupyter-notebook')).toBe(
      JSON.stringify({ uri: notebookUri, notebookType: 'jupyter-notebook' }),
    );
  });
});
