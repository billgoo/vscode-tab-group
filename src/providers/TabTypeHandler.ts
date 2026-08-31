import * as path from 'node:path';
import * as vscode from 'vscode';
import { setTabDecoration } from '../decorators/TabFileDecorationProvider';
import {
  SavedCustomTab,
  SavedNotebookDiffTab,
  SavedNotebookTab,
  SavedTab,
  SavedTextDiffTab,
  SavedTextTab,
} from '../models/SavedGroup';
import { findLongestCommonFilePathPrefixIndex } from '../utils/fileTree';
import { createTabSortKey, TabSortKey } from '../utils/tabSort';
import { getCustomTabId, getNormalizedNotebookDiffId, getNotebookTabId } from '../utils/tabId';

export type InputType = vscode.Tab['input'];

type TypedTab<T extends InputType> = vscode.Tab & {
  input: T;
};

export interface TabTypeHandler<T extends InputType> {
  readonly name: string;
  readonly savedTabKind?: SavedTab['kind'];

  is(tab: vscode.Tab): tab is TypedTab<T>;

  /**
   * The unique id to bind an tree data with an actual tab or editor
   * @param tab
   */
  getNormalizedId(tab: TypedTab<T>): string;
  getSortKey(tab: TypedTab<T>): TabSortKey;
  getLegacyNormalizedIds?(tab: TypedTab<T>): readonly string[];
  toSavedTab?(tab: TypedTab<T>): SavedTab;
  openSavedTab?(savedTab: SavedTab): Promise<void>;
  createTreeItem(tab: TypedTab<T>): vscode.TreeItem;
  openEditor(tab: TypedTab<T>): Promise<void>;
}

const handlers: TabTypeHandler<InputType>[] = [];

function getNormalizedIdForUnknownObject(input: object): string {
  const getNormalizedObject = (object: any, depth: number = 2) => {
    const result: Record<string, any> = {};

    for (const key of Object.keys(object).sort()) {
      if (typeof object[key] === 'object' && !Array.isArray(object[key]) && object[key] !== null) {
        result[key] =
          depth > 0 ? getNormalizedObject(object[key], depth - 1) : object[key].toString();
      }
      result[key] = object[key];
    }

    return result;
  };

  return JSON.stringify(getNormalizedObject(input));
}

function getUriSortKey(uri: vscode.Uri, id: string): TabSortKey {
  return createTabSortKey(uri.toString(), id);
}

/**
 * This class is a default for logic safety.
 * Unknown-typed tab won't be added to the tree data, because we cannot find the way to find a unique id which can bind tree data and actual tab.
 */
export class UnknownInputTypeHandler implements TabTypeHandler<unknown> {
  name = 'unknownInputType';
  is(_tab: vscode.Tab): _tab is TypedTab<unknown> {
    return true;
  }

  getNormalizedId(tab: TypedTab<unknown>) {
    if (typeof tab.input === 'object' && tab.input !== null) {
      return `${tab.label}:${getNormalizedIdForUnknownObject(tab.input)}`;
    }
    if (tab.input === undefined) {
      return tab.label;
    }
    return `${tab.label}:${(tab.input as any).toString()}`;
  }

  getSortKey(tab: TypedTab<unknown>): TabSortKey {
    return createTabSortKey(tab.label, this.getNormalizedId(tab));
  }

  createTreeItem(tab: TypedTab<unknown>) {
    return new vscode.TreeItem(tab.label);
  }

  openEditor(_tab: TypedTab<unknown>): Promise<void> {
    return Promise.resolve();
  }
}

export const unknownInputTypeHandler = new UnknownInputTypeHandler();

export function getHandler(tab: vscode.Tab): TabTypeHandler<InputType> | undefined;
export function getHandler(tab: vscode.Tab, useDefault: true): TabTypeHandler<InputType>;
export function getHandler(
  tab: vscode.Tab,
  useDefault?: boolean,
): TabTypeHandler<InputType> | undefined {
  for (const handler of handlers) {
    if (handler.is(tab)) {
      return handler;
    }
  }

  return useDefault ? unknownInputTypeHandler : undefined;
}

export function toSavedTab(tab: vscode.Tab): SavedTab | undefined {
  return getHandler(tab)?.toSavedTab?.(tab);
}

export function matchesTabId(tab: vscode.Tab, tabId: string): boolean {
  const handler = getHandler(tab);
  return Boolean(
    handler &&
    (handler.getNormalizedId(tab) === tabId ||
      handler.getLegacyNormalizedIds?.(tab).includes(tabId)),
  );
}

export async function reopenSavedTab(savedTab: SavedTab): Promise<void> {
  const handler = handlers.find(candidate => candidate.savedTabKind === savedTab.kind);
  if (!handler?.openSavedTab) {
    throw new UnimplementedError(`Cannot reopen saved tab type ${savedTab.kind}`);
  }

  await handler.openSavedTab(savedTab);
}

/**
 * Register handler
 * Note: The order matters. Place more specific handlers before general ones.
 * @param ctor
 */
function Registered(ctor: new () => TabTypeHandler<InputType>) {
  handlers.push(new ctor());
}

@Registered
export class TabInputTextHandler implements TabTypeHandler<vscode.TabInputText> {
  name = 'TabInputText';
  readonly savedTabKind = 'text';

  is(tab: vscode.Tab): tab is TypedTab<vscode.TabInputText> {
    return tab.input instanceof vscode.TabInputText;
  }

  getNormalizedId(tab: TypedTab<vscode.TabInputText>): string {
    return tab.input.uri.toString();
  }

  getSortKey(tab: TypedTab<vscode.TabInputText>): TabSortKey {
    return getUriSortKey(tab.input.uri, this.getNormalizedId(tab));
  }

  toSavedTab(tab: TypedTab<vscode.TabInputText>): SavedTextTab {
    return {
      kind: 'text',
      id: this.getNormalizedId(tab),
      uri: tab.input.uri.toString(),
    };
  }

  async openSavedTab(savedTab: SavedTab): Promise<void> {
    if (savedTab.kind !== 'text') {
      throw new UnimplementedError('Expected a saved text tab');
    }

    await vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(savedTab.uri), {
      preview: false,
    });
  }

  createTreeItem(tab: TypedTab<vscode.TabInputText>): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(tab.input.uri);

    treeItem.label = tab.label;
    setTabDecoration(treeItem, tab.input.uri, 'file');

    return treeItem;
  }

  async openEditor(tab: TypedTab<vscode.TabInputText>): Promise<void> {
    await vscode.commands
      .executeCommand('vscode.open', tab.input.uri, { viewColumn: tab.group.viewColumn })
      .then(undefined, e => console.error(e));
    return;
  }
}

@Registered
export class TabInputTextDiffHandler implements TabTypeHandler<vscode.TabInputTextDiff> {
  name = 'TabInputTextDiff';
  readonly savedTabKind = 'textDiff';

  is(tab: vscode.Tab): tab is TypedTab<vscode.TabInputTextDiff> {
    return tab.input instanceof vscode.TabInputTextDiff;
  }

  getNormalizedId(tab: TypedTab<vscode.TabInputTextDiff>): string {
    const serializeUri = (uri: vscode.Uri) => {
      // Omit specific metadata keys not always present upon the original diff action
      const { scheme, authority, path, query, fragment } = uri.toJSON();
      return { scheme, authority, path, query, fragment };
    };
    return JSON.stringify({
      original: serializeUri(tab.input.original),
      modified: serializeUri(tab.input.modified),
    });
  }

  getSortKey(tab: TypedTab<vscode.TabInputTextDiff>): TabSortKey {
    return getUriSortKey(tab.input.modified, this.getNormalizedId(tab));
  }

  toSavedTab(tab: TypedTab<vscode.TabInputTextDiff>): SavedTextDiffTab {
    return {
      kind: 'textDiff',
      id: this.getNormalizedId(tab),
      originalUri: tab.input.original.toString(),
      modifiedUri: tab.input.modified.toString(),
      label: tab.label,
    };
  }

  async openSavedTab(savedTab: SavedTab): Promise<void> {
    if (savedTab.kind !== 'textDiff') {
      throw new UnimplementedError('Expected a saved text diff tab');
    }

    await vscode.commands.executeCommand(
      'vscode.diff',
      vscode.Uri.parse(savedTab.originalUri),
      vscode.Uri.parse(savedTab.modifiedUri),
      savedTab.label,
      { preview: false },
    );
  }

  createTreeItem(tab: TypedTab<vscode.TabInputTextDiff>): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(tab.input.modified);
    treeItem.label = tab.label;

    // generate discription
    const originalFilePathArray = tab.input.original.fsPath.split(path.sep);
    const modifiedFilePathArray = tab.input.modified.fsPath.split(path.sep);
    const filePathArray = [];
    filePathArray.push(originalFilePathArray);
    filePathArray.push(modifiedFilePathArray);
    if (
      originalFilePathArray[originalFilePathArray.length - 1] ==
      modifiedFilePathArray[modifiedFilePathArray.length - 1]
    ) {
      const commonAncestorDirIndex = findLongestCommonFilePathPrefixIndex(filePathArray);
      treeItem.description =
        path.join(...originalFilePathArray.slice(commonAncestorDirIndex + 1, -1)) +
        ' - ' +
        path.join(...modifiedFilePathArray.slice(commonAncestorDirIndex + 1, -1));
    }

    setTabDecoration(treeItem, tab.input.modified, 'diff');

    return treeItem;
  }

  async openEditor(tab: TypedTab<vscode.TabInputTextDiff>): Promise<void> {
    await vscode.commands
      .executeCommand('vscode.diff', tab.input.original, tab.input.modified, tab.label, {
        viewColumn: tab.group.viewColumn,
      })
      .then(undefined, e => console.error(e));
    return;
  }
}

@Registered
export class TabInputNotebookDiffHandler implements TabTypeHandler<vscode.TabInputNotebookDiff> {
  name = 'TabInputNotebookDiff';
  readonly savedTabKind = 'notebookDiff';

  is(tab: vscode.Tab): tab is TypedTab<vscode.TabInputNotebookDiff> {
    return tab.input instanceof vscode.TabInputNotebookDiff;
  }

  getNormalizedId(tab: TypedTab<vscode.TabInputNotebookDiff>): string {
    return getNormalizedNotebookDiffId(
      tab.input.original,
      tab.input.modified,
      tab.input.notebookType,
    );
  }

  getSortKey(tab: TypedTab<vscode.TabInputNotebookDiff>): TabSortKey {
    return getUriSortKey(tab.input.modified, this.getNormalizedId(tab));
  }

  toSavedTab(tab: TypedTab<vscode.TabInputNotebookDiff>): SavedNotebookDiffTab {
    return {
      kind: 'notebookDiff',
      id: this.getNormalizedId(tab),
      originalUri: tab.input.original.toString(),
      modifiedUri: tab.input.modified.toString(),
      notebookType: tab.input.notebookType,
      label: tab.label,
    };
  }

  async openSavedTab(savedTab: SavedTab): Promise<void> {
    if (savedTab.kind !== 'notebookDiff') {
      throw new UnimplementedError('Expected a saved notebook diff tab');
    }

    await vscode.commands.executeCommand(
      'vscode.diff',
      vscode.Uri.parse(savedTab.originalUri),
      vscode.Uri.parse(savedTab.modifiedUri),
      savedTab.label,
      { preview: false },
    );
  }

  createTreeItem(tab: TypedTab<vscode.TabInputNotebookDiff>): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(tab.input.modified);
    treeItem.label = tab.label;
    setTabDecoration(treeItem, tab.input.modified, 'diff');

    return treeItem;
  }

  async openEditor(tab: TypedTab<vscode.TabInputNotebookDiff>): Promise<void> {
    await vscode.commands
      .executeCommand('vscode.diff', tab.input.original, tab.input.modified, tab.label, {
        viewColumn: tab.group.viewColumn,
      })
      .then(undefined, e => console.error(e));
    return;
  }
}

@Registered
export class TabInputCustomHandler implements TabTypeHandler<vscode.TabInputCustom> {
  name = 'TabInputCustom';
  readonly savedTabKind = 'custom';

  is(tab: vscode.Tab): tab is TypedTab<vscode.TabInputCustom> {
    return tab.input instanceof vscode.TabInputCustom;
  }

  getNormalizedId(tab: TypedTab<vscode.TabInputCustom>): string {
    return getCustomTabId(tab.input.uri.toString(), tab.input.viewType);
  }

  getSortKey(tab: TypedTab<vscode.TabInputCustom>): TabSortKey {
    return getUriSortKey(tab.input.uri, this.getNormalizedId(tab));
  }

  getLegacyNormalizedIds(tab: TypedTab<vscode.TabInputCustom>): readonly string[] {
    return [JSON.stringify({ uri: tab.input.uri.path, viewType: tab.input.viewType })];
  }

  toSavedTab(tab: TypedTab<vscode.TabInputCustom>): SavedCustomTab {
    return {
      kind: 'custom',
      id: this.getNormalizedId(tab),
      uri: tab.input.uri.toString(),
      viewType: tab.input.viewType,
    };
  }

  async openSavedTab(savedTab: SavedTab): Promise<void> {
    if (savedTab.kind !== 'custom') {
      throw new UnimplementedError('Expected a saved custom tab');
    }

    await vscode.commands.executeCommand(
      'vscode.openWith',
      vscode.Uri.parse(savedTab.uri),
      savedTab.viewType,
      { preview: false },
    );
  }

  createTreeItem(tab: TypedTab<vscode.TabInputCustom>): vscode.TreeItem {
    return new vscode.TreeItem(tab.input.uri);
  }

  async openEditor(tab: TypedTab<vscode.TabInputCustom>): Promise<void> {
    await vscode.commands
      .executeCommand('vscode.openWith', tab.input.uri, tab.input.viewType, {
        viewColumn: tab.group.viewColumn,
      })
      .then(undefined, e => console.error(e));
    return;
  }
}

@Registered
export class TabInputNotebookHandler implements TabTypeHandler<vscode.TabInputNotebook> {
  name = 'TabInputNotebook';
  readonly savedTabKind = 'notebook';

  is(tab: vscode.Tab): tab is TypedTab<vscode.TabInputNotebook> {
    return tab.input instanceof vscode.TabInputNotebook;
  }

  getNormalizedId(tab: TypedTab<vscode.TabInputNotebook>): string {
    return getNotebookTabId(tab.input.uri.toString(), tab.input.notebookType);
  }

  getSortKey(tab: TypedTab<vscode.TabInputNotebook>): TabSortKey {
    return getUriSortKey(tab.input.uri, this.getNormalizedId(tab));
  }

  getLegacyNormalizedIds(tab: TypedTab<vscode.TabInputNotebook>): readonly string[] {
    return [JSON.stringify({ uri: tab.input.uri.path, notebookType: tab.input.notebookType })];
  }

  toSavedTab(tab: TypedTab<vscode.TabInputNotebook>): SavedNotebookTab {
    return {
      kind: 'notebook',
      id: this.getNormalizedId(tab),
      uri: tab.input.uri.toString(),
      notebookType: tab.input.notebookType,
    };
  }

  async openSavedTab(savedTab: SavedTab): Promise<void> {
    if (savedTab.kind !== 'notebook') {
      throw new UnimplementedError('Expected a saved notebook tab');
    }

    await vscode.commands.executeCommand(
      'vscode.openWith',
      vscode.Uri.parse(savedTab.uri),
      savedTab.notebookType,
      { preview: false },
    );
  }

  createTreeItem(tab: TypedTab<vscode.TabInputNotebook>): vscode.TreeItem {
    return new vscode.TreeItem(tab.input.uri);
  }

  async openEditor(tab: TypedTab<vscode.TabInputNotebook>): Promise<void> {
    await vscode.commands
      .executeCommand('vscode.openWith', tab.input.uri, tab.input.notebookType, {
        viewColumn: tab.group.viewColumn,
      })
      .then(undefined, e => console.error(e));
    return;
  }
}

class UnimplementedError extends Error {
  constructor(message?: string) {
    super(message);
  }
}

export function getNormalizedTabId(tab: vscode.Tab): string {
  const handler = getHandler(tab);
  if (!handler) {
    throw new UnimplementedError();
  }
  return handler.getNormalizedId(tab);
}
