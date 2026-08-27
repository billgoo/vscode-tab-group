import * as assert from 'assert';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as vscode from 'vscode';
import { SavedGroup } from '../../models/SavedGroup';
import { Group, isGroup, Tab, TreeItemType } from '../../models/types';
import {
  getHandler,
  getNormalizedTabId,
  reopenSavedTab,
  toSavedTab,
} from '../../providers/TabTypeHandler';
import { RecentTabsTreeDataProvider } from '../../providers/RecentTabsTreeDataProvider';
import {
  RecentTabsTreeMimeType,
  TabDropMimeType,
  TreeDataProvider,
} from '../../providers/TreeDataProvider';
import { RecentTabs } from '../../services/RecentTabs';
import { SavedGroupsTreeDataProvider } from '../../providers/SavedGroupsTreeDataProvider';
import { SavedGroupsStore } from '../../services/SavedGroupsStore';

suite('Tab Group extension', () => {
  test('activates and registers its tab-group commands', async () => {
    const extension = vscode.extensions.getExtension('jiapeiyao.tab-group');

    assert.ok(extension, 'The Tab Group extension should be available to the extension host.');
    await extension.activate();

    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('tabsTreeView.tab.ungroup'));
    assert.ok(commands.includes('tabsTreeView.group.rename'));
    assert.ok(commands.includes('tabsTreeView.group.changeColor'));
    assert.ok(commands.includes('tabsTreeView.group.save'));
    assert.ok(commands.includes('tabsTreeView.savedGroup.restore'));
    assert.ok(commands.includes('tabsTreeView.savedGroup.delete'));
    assert.ok(commands.includes('tabsTreeView.savedGroups.restoreAll'));
    assert.ok(commands.includes('tabsTreeView.savedGroups.deleteAll'));
    assert.ok(commands.includes('tabsTreeView.enableSortMode'));
    assert.ok(commands.includes('tabsTreeView.reset'));

    const contributedViews = extension.packageJSON.contributes.views.tabs as Array<{
      id: string;
      visibility?: string;
    }>;
    assert.ok(
      contributedViews.some(view => view.id === 'recentTabsTreeView'),
      'The Recent Tabs view should be contributed.',
    );
    const savedGroupsView = contributedViews.find(view => view.id === 'savedGroupsTreeView');
    assert.ok(savedGroupsView, 'The Saved Groups view should be contributed.');
    assert.equal(savedGroupsView.visibility, 'collapsed');

    const viewTitleMenus = extension.packageJSON.contributes.menus['view/title'] as Array<{
      command: string;
      when?: string;
    }>;
    assert.ok(
      viewTitleMenus.some(
        menu =>
          menu.command === 'tabsTreeView.savedGroups.restoreAll' &&
          menu.when === 'view == savedGroupsTreeView',
      ),
    );
    assert.ok(
      viewTitleMenus.some(
        menu =>
          menu.command === 'tabsTreeView.savedGroups.deleteAll' &&
          menu.when === 'view == savedGroupsTreeView',
      ),
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

  test('shows saved groups with restore and delete actions', () => {
    const savedGroup: SavedGroup = {
      id: 'saved-group',
      name: 'Saved group',
      groupLabel: 'Live group',
      colorId: 'charts.green',
      collapsed: false,
      tabs: [
        {
          kind: 'text',
          id: 'event-publisher-role',
          uri: 'file:///workspace/event-publisher-role/app.py',
        },
        {
          kind: 'text',
          id: 'cleanup-workflow',
          uri: 'file:///workspace/cleanup-workflow/app.py',
        },
      ],
    };
    const workspaceState = {
      get: () => ({ version: 1, groups: [savedGroup] }),
    } as unknown as vscode.Memento;
    const provider = new SavedGroupsTreeDataProvider(new SavedGroupsStore(workspaceState));
    let refreshed = false;
    provider.onDidChangeTreeData(() => (refreshed = true));

    assert.deepStrictEqual(provider.getChildren(), [savedGroup]);
    const treeItem = provider.getTreeItem(savedGroup);
    assert.equal(treeItem.contextValue, 'saved-group');
    assert.equal(treeItem.description, '2 tabs');
    assert.equal(treeItem.collapsibleState, vscode.TreeItemCollapsibleState.Collapsed);
    assert.equal(treeItem.command, undefined);

    const savedTabs = provider.getChildren(savedGroup);
    assert.equal(savedTabs.length, 2);
    const firstSavedTabTreeItem = provider.getTreeItem(savedTabs[0]);
    assert.equal(firstSavedTabTreeItem.contextValue, 'saved-tab');
    assert.equal(firstSavedTabTreeItem.label, 'app.py');
    assert.equal(firstSavedTabTreeItem.description, 'event-publisher-role');
    const secondSavedTabTreeItem = provider.getTreeItem(savedTabs[1]);
    assert.equal(secondSavedTabTreeItem.description, 'cleanup-workflow');

    provider.refresh();
    assert.equal(refreshed, true);
    provider.dispose();
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

  test('creates saved descriptors for supported editor tabs', () => {
    const textUri = vscode.Uri.file('/workspace/example.ts');
    const originalTextUri = vscode.Uri.file('/workspace/original.ts');
    const modifiedTextUri = vscode.Uri.file('/workspace/modified.ts');
    const customUri = vscode.Uri.file('/workspace/example.custom');
    const notebookUri = vscode.Uri.file('/workspace/example.ipynb');
    const originalNotebookUri = vscode.Uri.file('/workspace/original.ipynb');
    const modifiedNotebookUri = vscode.Uri.file('/workspace/modified.ipynb');

    const tabs = [
      { input: new vscode.TabInputText(textUri) },
      {
        input: new vscode.TabInputTextDiff(originalTextUri, modifiedTextUri),
        label: 'Compare text',
      },
      { input: new vscode.TabInputCustom(customUri, 'example.custom') },
      { input: new vscode.TabInputNotebook(notebookUri, 'jupyter-notebook') },
      {
        input: new vscode.TabInputNotebookDiff(
          originalNotebookUri,
          modifiedNotebookUri,
          'jupyter-notebook',
        ),
        label: 'Compare notebooks',
      },
    ] as vscode.Tab[];

    assert.deepStrictEqual(tabs.map(toSavedTab), [
      { kind: 'text', id: textUri.toString(), uri: textUri.toString() },
      {
        kind: 'textDiff',
        id: getNormalizedTabId(tabs[1]),
        originalUri: originalTextUri.toString(),
        modifiedUri: modifiedTextUri.toString(),
        label: 'Compare text',
      },
      {
        kind: 'custom',
        id: getNormalizedTabId(tabs[2]),
        uri: customUri.toString(),
        viewType: 'example.custom',
      },
      {
        kind: 'notebook',
        id: getNormalizedTabId(tabs[3]),
        uri: notebookUri.toString(),
        notebookType: 'jupyter-notebook',
      },
      {
        kind: 'notebookDiff',
        id: getNormalizedTabId(tabs[4]),
        originalUri: originalNotebookUri.toString(),
        modifiedUri: modifiedNotebookUri.toString(),
        notebookType: 'jupyter-notebook',
        label: 'Compare notebooks',
      },
    ]);
  });

  test('reopens every saved text tab instead of replacing a previous tab', async () => {
    const prefix = `tab-group-saved-tabs-${Date.now()}`;
    const firstUri = vscode.Uri.file(join(tmpdir(), `${prefix}-first.txt`));
    const secondUri = vscode.Uri.file(join(tmpdir(), `${prefix}-second.txt`));
    const firstSavedTab = {
      kind: 'text' as const,
      id: firstUri.toString(),
      uri: firstUri.toString(),
    };
    const secondSavedTab = {
      kind: 'text' as const,
      id: secondUri.toString(),
      uri: secondUri.toString(),
    };

    await vscode.workspace.fs.writeFile(firstUri, Buffer.from('first'));
    await vscode.workspace.fs.writeFile(secondUri, Buffer.from('second'));

    try {
      await reopenSavedTab(firstSavedTab);
      await reopenSavedTab(secondSavedTab);

      const openTabIds = new Set(
        vscode.window.tabGroups.all
          .flatMap(tabGroup => tabGroup.tabs)
          .map(tab => {
            try {
              return getNormalizedTabId(tab);
            } catch {
              return undefined;
            }
          }),
      );
      assert.ok(openTabIds.has(firstSavedTab.id));
      assert.ok(openTabIds.has(secondSavedTab.id));
    } finally {
      const tabsToClose = vscode.window.tabGroups.all
        .flatMap(tabGroup => tabGroup.tabs)
        .filter(tab => {
          try {
            return (
              getNormalizedTabId(tab) === firstSavedTab.id ||
              getNormalizedTabId(tab) === secondSavedTab.id
            );
          } catch {
            return false;
          }
        });
      await vscode.window.tabGroups.close(tabsToClose);
      await vscode.workspace.fs.delete(firstUri, { useTrash: false });
      await vscode.workspace.fs.delete(secondUri, { useTrash: false });
    }
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
