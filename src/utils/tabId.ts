export interface TabUri {
  readonly scheme: string;
  readonly authority: string;
  readonly path: string;
  readonly query: string;
  readonly fragment: string;
}

export function getNormalizedUri(uri: TabUri): TabUri {
  return {
    scheme: uri.scheme,
    authority: uri.authority,
    path: uri.path,
    query: uri.query,
    fragment: uri.fragment,
  };
}

export function getCustomTabId(uri: string, viewType: string): string {
  return JSON.stringify({ uri, viewType });
}

export function getNotebookTabId(uri: string, notebookType: string): string {
  return JSON.stringify({ uri, notebookType });
}

export function getNormalizedNotebookDiffId(
  original: TabUri,
  modified: TabUri,
  notebookType: string,
): string {
  return JSON.stringify({
    original: getNormalizedUri(original),
    modified: getNormalizedUri(modified),
    notebookType,
  });
}
