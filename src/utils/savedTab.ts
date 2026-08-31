import { URL } from 'node:url';
import { SavedTab } from '../models/SavedGroup';
import { getCustomTabId, getNotebookTabId } from './tabId';

export function getSavedTabUri(savedTab: SavedTab): string {
  return 'uri' in savedTab ? savedTab.uri : savedTab.modifiedUri;
}

export function getSavedTabPath(savedTab: SavedTab): string {
  const uri = getSavedTabUri(savedTab);
  try {
    return new URL(uri).pathname;
  } catch {
    return uri;
  }
}

export function getSavedTabLabel(savedTab: SavedTab): string {
  if ('label' in savedTab && savedTab.label) {
    return savedTab.label;
  }

  const path = getSavedTabPath(savedTab);
  return path.substring(path.lastIndexOf('/') + 1) || getSavedTabUri(savedTab);
}

export function getSavedTabId(savedTab: SavedTab): string {
  switch (savedTab.kind) {
    case 'text':
      return savedTab.uri;
    case 'custom':
      return getCustomTabId(savedTab.uri, savedTab.viewType);
    case 'notebook':
      return getNotebookTabId(savedTab.uri, savedTab.notebookType);
    default:
      return savedTab.id;
  }
}
