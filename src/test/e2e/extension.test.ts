import * as assert from 'assert';
import * as vscode from 'vscode';
import { Group, isGroup, Tab, TreeItemType } from '../../models/types';
import { getHandler, getNormalizedTabId } from '../../providers/TabTypeHandler';
import { RecentTabsTreeDataProvider } from '../../providers/RecentTabsTreeDataProvider';
import {
  RecentTabsTreeMimeType,
  TabDropMimeType,
  TreeDataProvider,
} from '../../providers/TreeDataProvider';
import { RecentTabs } from '../../services/RecentTabs';

suite('Tab Group extension', () => {
  test('activates and registers its tab-group commands', async () => {
    const extension = vscode.extensions.getExtension('jiapeiyao.tab-group');

    assert.ok(extension, 'The Tab Group extension should be available to the extension host.');
    await extension.activate();

    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('tabsTreeView.tab.ungroup'));
    assert.ok(commands.includes('tabsTreeView.group.rename'));
    assert.ok(commands.includes('tabsTreeView.group.changeColor'));
    assert.ok(commands.includes('tabsTreeView.enableSortMode'));
    assert.ok(commands.includes('tabsTreeView.reset'));

    const contributedViews = extension.packageJSON.contributes.views.tabs as Array<{ id: string }>;
    assert.ok(
      contributedViews.some(view => view.id === 'recentTabsTreeView'),
      'The Recent Tabs view should be contributed.',
    );
  });

  test('recognizes notebook editor tabs', async () => {
    const extension = vscode.extensions.getExtension('jiapeiyao.tab-group');

    assert.ok(extension, 'The Tab Group extension should be available to the extension host.');
    await extension.activate();

    const notebookType = 'jupyter-notebook';
    const notebookUri = vscode.Uri.file('/workspace/example.ipynb');
    const notebookTab = {
      input: new vscode.TabInputNotebook(notebookUri, notebookType),
    } as vscode.Tab;

    assert.equal(
      getNormalizedTabId(notebookTab),
      JSON.stringify({ uri: notebookUri.path, notebookType }),
    );
  });

  test('uses one drag payload contract for both tab views', () => {
    const treeDataProvider = new TreeDataProvider();
    const recentTabsTreeDataProvider = new RecentTabsTreeDataProvider(
      treeDataProvider,
      new RecentTabs(),
    );

    assert.deepStrictEqual(treeDataProvider.dragMimeTypes, [TabDropMimeType]);
    assert.deepStrictEqual(treeDataProvider.dropMimeTypes, [
      TabDropMimeType,
      RecentTabsTreeMimeType,
    ]);
    assert.deepStrictEqual(recentTabsTreeDataProvider.dragMimeTypes, [TabDropMimeType]);
    assert.deepStrictEqual(recentTabsTreeDataProvider.dropMimeTypes, []);

    recentTabsTreeDataProvider.dispose();
    treeDataProvider.dispose();
  });

  test('accepts a Recent Tabs drag payload in the main tree', async () => {
    const treeDataProvider = new TreeDataProvider();
    const recentTabsTreeDataProvider = new RecentTabsTreeDataProvider(
      treeDataProvider,
      new RecentTabs(),
    );
    const target: Tab = { type: TreeItemType.Tab, groupId: null, id: 'target' };
    const source: Tab = { type: TreeItemType.Tab, groupId: null, id: 'source' };
    const cancellation = new vscode.CancellationTokenSource();

    treeDataProvider.setState([target, source]);
    const dataTransfer = new vscode.DataTransfer();
    await recentTabsTreeDataProvider.handleDrag([source], dataTransfer, cancellation.token);
    await treeDataProvider.handleDrop(target, dataTransfer, cancellation.token);

    const state = treeDataProvider.getState();
    assert.equal(state.length, 1);
    assert.equal(isGroup(state[0]), true);
    assert.deepStrictEqual((state[0] as Group).children, [target, source]);

    cancellation.dispose();
    recentTabsTreeDataProvider.dispose();
    treeDataProvider.dispose();
  });

  test('recognizes notebook diff editor tabs', async () => {
    const extension = vscode.extensions.getExtension('jiapeiyao.tab-group');

    assert.ok(extension, 'The Tab Group extension should be available to the extension host.');
    await extension.activate();

    const notebookType = 'jupyter-notebook';
    const original = vscode.Uri.file('/workspace/original.ipynb');
    const modified = vscode.Uri.file('/workspace/modified.ipynb');
    const notebookDiffTab = {
      input: new vscode.TabInputNotebookDiff(original, modified, notebookType),
    } as vscode.Tab;
    const normalizeUri = (uri: vscode.Uri) => ({
      scheme: uri.scheme,
      authority: uri.authority,
      path: uri.path,
      query: uri.query,
      fragment: uri.fragment,
    });

    assert.equal(
      getNormalizedTabId(notebookDiffTab),
      JSON.stringify({
        original: normalizeUri(original),
        modified: normalizeUri(modified),
        notebookType,
      }),
    );
  });

  test('skips tab inputs without a public identity or reopen operation', async () => {
    const extension = vscode.extensions.getExtension('jiapeiyao.tab-group');

    assert.ok(extension, 'The Tab Group extension should be available to the extension host.');
    await extension.activate();

    const webviewTab = {
      input: new vscode.TabInputWebview('tab-group-test-webview'),
    } as vscode.Tab;
    const terminalTab = {
      input: new vscode.TabInputTerminal(),
    } as vscode.Tab;

    assert.equal(getHandler(webviewTab), undefined);
    assert.equal(getHandler(terminalTab), undefined);
  });
});
