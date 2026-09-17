import { describe, expect, test } from '@jest/globals';
import { SavedTab } from '../models/SavedGroup';
import {
  getSavedTabId,
  getSavedTabLabel,
  getSavedTabPath,
  getSavedTabUri,
} from '../utils/savedTab';

describe('saved tab utilities', () => {
  test.each(['file://', 'vscode-remote://ssh-remote+workspace'])(
    'decodes Chinese display paths without changing stored URIs for %s',
    prefix => {
      const folder = '\u6587\u6863';
      const filename = '\u8bbe\u8ba1\u7b14\u8bb0.md';
      const uri = `${prefix}/project/${encodeURIComponent(folder)}/${encodeURIComponent(filename)}`;
      const savedTab: SavedTab = { kind: 'text', id: uri, uri };

      expect({
        path: getSavedTabPath(savedTab),
        label: getSavedTabLabel(savedTab),
        uri: getSavedTabUri(savedTab),
        id: getSavedTabId(savedTab),
      }).toEqual({
        path: `/project/${folder}/${filename}`,
        label: filename,
        uri,
        id: uri,
      });
    },
  );

  test.each([
    ['notes%20%231%3F.md', 'notes #1?.md'],
    ['literal%2520.md', 'literal%20.md'],
    ['100%25.md', '100%.md'],
    ['invalid%ZZ.md', 'invalid%ZZ.md'],
    ['invalid%E6.md', 'invalid%E6.md'],
  ])('decodes %s once and tolerates malformed escapes', (encodedName, label) => {
    const uri = `file:///project/${encodedName}`;
    const savedTab: SavedTab = { kind: 'text', id: uri, uri };

    expect(getSavedTabLabel(savedTab)).toBe(label);
  });

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

  test('uses saved labels and preserved saved IDs', () => {
    const diffTab: SavedTab = {
      kind: 'textDiff',
      id: 'diff-id',
      originalUri: 'file:///project/original.ts',
      modifiedUri: 'file:///project/modified.ts',
      label: 'Compare files',
    };

    expect(getSavedTabLabel(diffTab)).toBe('Compare files');
    expect(getSavedTabId(diffTab)).toBe('diff-id');
  });
});
