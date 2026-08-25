import * as assert from 'assert';
import * as vscode from 'vscode';
import { getHandler, getNormalizedTabId } from '../../providers/TabTypeHandler';

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
