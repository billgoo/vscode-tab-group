import * as vscode from 'vscode';

export function setTabDecoration(treeItem: vscode.TreeItem, tab: vscode.Tab): void {
  if (!tab.isDirty && !tab.isPinned) {
    return;
  }

  const label = treeItem.label;
  if (!label) {
    return;
  }

  const prefix = tab.isPinned ? (tab.isDirty ? '📌︎⏺' : '📌︎') : '⏺';
  if (typeof label === 'string') {
    treeItem.label = `${prefix} ${label}`;
    return;
  }

  const labelOffset = prefix.length + 1;
  treeItem.label = {
    label: `${prefix} ${label.label}`,
    highlights: label.highlights?.map(([start, end]): [number, number] => [
      start + labelOffset,
      end + labelOffset,
    ]),
  };
}
