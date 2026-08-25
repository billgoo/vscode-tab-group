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
