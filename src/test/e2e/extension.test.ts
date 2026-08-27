import * as assert from 'assert';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as vscode from 'vscode';
import { SavedGroup, SavedTextTab } from '../../models/SavedGroup';
import { Group, isGroup, Tab, TreeItemType } from '../../models/types';
import {
  getHandler,
  getNormalizedTabId,
  matchesTabId,
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
import { ContextKeys, getContext } from '../../utils/context';

function getOpenTabIds(): Set<string> {
  return new Set(
    vscode.window.tabGroups.all
      .flatMap(tabGroup => tabGroup.tabs)
      .flatMap(tab => {
        try {
          return [getNormalizedTabId(tab)];
        } catch {
          return [];
        }
      }),
  );
}

async function closeTabs(tabIds: readonly string[]): Promise<void> {
  const ids = new Set(tabIds);
  const tabs = vscode.window.tabGroups.all
    .flatMap(tabGroup => tabGroup.tabs)
    .filter(tab => {
      try {
        return ids.has(getNormalizedTabId(tab));
      } catch {
        return false;
      }
    });
  await vscode.window.tabGroups.close(tabs);
}

function createSavedTextTab(uri: vscode.Uri): SavedTextTab {
  return { kind: 'text', id: uri.toString(), uri: uri.toString() };
}

suite('Tab Group extension', () => {
  test('activates and registers its tab-group commands', async () => {
    const extension = vscode.extensions.getExtension('jiapeiyao.tab-group');

    assert.ok(extension, 'The Tab Group extension should be available to the extension host.');
    await extension.activate();

    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('tabsTreeView.tab.ungroup'));
    assert.ok(commands.includes('tabsTreeView.group.rename'));
    assert.ok(commands.includes('tabsTreeView.group.changeColor'));
    assert.ok(commands.includes('tabsTreeView.sortTabsAscending'));
    assert.ok(commands.includes('tabsTreeView.sortTabsDescending'));
    assert.ok(commands.includes('tabsTreeView.group.save'));
    assert.ok(commands.includes('tabsTreeView.savedGroup.restore'));
    assert.ok(commands.includes('tabsTreeView.savedGroup.delete'));
    assert.ok(commands.includes('tabsTreeView.savedGroups.restoreAll'));
    assert.ok(commands.includes('tabsTreeView.savedGroups.deleteAll'));
    assert.ok(commands.includes('tabsTreeView.enableSortMode'));
    assert.ok(commands.includes('tabsTreeView.reset'));

    const contributedCommands = extension.packageJSON.contributes.commands as Array<{
      command: string;
      icon?: string;
    }>;
    assert.equal(
      contributedCommands.find(command => command.command === 'tabsTreeView.sortTabsAscending')
        ?.icon,
      '$(sort-precedence)',
    );
    assert.equal(
      contributedCommands.find(command => command.command === 'tabsTreeView.sortTabsDescending')
        ?.icon,
      '$(sort-precedence)',
    );

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
    const itemContextMenus = extension.packageJSON.contributes.menus['view/item/context'] as Array<{
      command: string;
      when?: string;
    }>;
    assert.ok(
      itemContextMenus.some(
        menu =>
          menu.command === 'tabsTreeView.sortTabsAscending' &&
          menu.when === "view == tabsTreeView && viewItem == 'group-sort-ascending'",
      ),
    );
    assert.ok(
      itemContextMenus.some(
        menu =>
          menu.command === 'tabsTreeView.sortTabsDescending' &&
          menu.when === "view == tabsTreeView && viewItem == 'group-sort-descending'",
      ),
    );
    assert.ok(
      viewTitleMenus.some(
        menu =>
          menu.command === 'tabsTreeView.savedGroups.deleteAll' &&
          menu.when === 'view == savedGroupsTreeView',
      ),
    );
    assert.ok(
      viewTitleMenus.some(
        menu =>
          menu.command === 'tabsTreeView.sortTabsAscending' &&
          menu.when ===
            'view =~ /^tabsTreeView/ && !tabGroup.sortMode:enabled && tabGroup.sort:nextRootAscending',
      ),
    );
    assert.ok(
      viewTitleMenus.some(
        menu =>
          menu.command === 'tabsTreeView.sortTabsDescending' &&
          menu.when ===
            'view =~ /^tabsTreeView/ && !tabGroup.sortMode:enabled && !tabGroup.sort:nextRootAscending',
      ),
    );
    assert.equal(
      viewTitleMenus.some(menu => menu.command === 'tabsTreeView.savedGroup.restore'),
      false,
    );
  });

  test('keeps root and group URI sort directions independent', async () => {
    const extension = vscode.extensions.getExtension('jiapeiyao.tab-group');
    const firstGroup: Group = {
      type: TreeItemType.Group,
      id: 'first-group',
      colorId: 'charts.green',
      label: 'First group',
      children: [{ type: TreeItemType.Tab, groupId: 'first-group', id: 'first-group-tab' }],
      collapsed: false,
    };
    const secondGroup: Group = {
      type: TreeItemType.Group,
      id: 'second-group',
      colorId: 'charts.blue',
      label: 'Second group',
      children: [{ type: TreeItemType.Tab, groupId: 'second-group', id: 'second-group-tab' }],
      collapsed: false,
    };
    const treeDataProvider = new TreeDataProvider();

    assert.ok(extension, 'The Tab Group extension should be available to the extension host.');
    await extension.activate();

    treeDataProvider.setState([firstGroup, secondGroup]);
    assert.equal(getContext(ContextKeys.NextRootSortAscending), true);
    assert.equal(treeDataProvider.getTreeItem(firstGroup).contextValue, 'group-sort-ascending');
    assert.equal(treeDataProvider.getTreeItem(secondGroup).contextValue, 'group-sort-ascending');

    treeDataProvider.sortTabs('ascending', firstGroup);
    assert.equal(getContext(ContextKeys.NextRootSortAscending), true);
    assert.equal(treeDataProvider.getTreeItem(firstGroup).contextValue, 'group-sort-descending');
    assert.equal(treeDataProvider.getTreeItem(secondGroup).contextValue, 'group-sort-ascending');

    treeDataProvider.sortTabs('ascending', secondGroup);
    treeDataProvider.sortTabs('descending', firstGroup);
    assert.equal(treeDataProvider.getTreeItem(firstGroup).contextValue, 'group-sort-ascending');
    assert.equal(treeDataProvider.getTreeItem(secondGroup).contextValue, 'group-sort-descending');

    treeDataProvider.sortTabs('ascending');
    assert.equal(getContext(ContextKeys.NextRootSortAscending), true);
    assert.equal(treeDataProvider.getTreeItem(firstGroup).contextValue, 'group-sort-descending');
    assert.equal(treeDataProvider.getTreeItem(secondGroup).contextValue, 'group-sort-descending');

    await vscode.commands.executeCommand('tabsTreeView.sortTabsAscending');
    assert.equal(getContext(ContextKeys.NextRootSortAscending), false);
    await vscode.commands.executeCommand('tabsTreeView.sortTabsAscending', firstGroup);
    assert.equal(getContext(ContextKeys.NextRootSortAscending), false);
    await vscode.commands.executeCommand('tabsTreeView.sortTabsDescending');
    assert.equal(getContext(ContextKeys.NextRootSortAscending), true);

    treeDataProvider.dispose();
  });

  test('refreshes a group sort icon when its tabs are already sorted', async () => {
    const uri = vscode.Uri.file(join(tmpdir(), `tab-group-sort-noop-${Date.now()}.txt`));
    const groupId = `tab-group-sort-noop-${Date.now()}`;
    const group: Group = {
      type: TreeItemType.Group,
      id: groupId,
      colorId: 'charts.green',
      label: 'Group',
      children: [{ type: TreeItemType.Tab, groupId, id: uri.toString() }],
      collapsed: false,
    };
    const treeDataProvider = new TreeDataProvider();
    let refreshes = 0;

    await vscode.workspace.fs.writeFile(uri, Buffer.from(uri.fsPath));
    await vscode.commands.executeCommand('vscode.open', uri, { preview: false });

    try {
      treeDataProvider.setState([group]);
      treeDataProvider.onDidChangeTreeData(() => refreshes++);

      assert.equal(treeDataProvider.sortTabs('ascending', group), false);
      assert.equal(treeDataProvider.getTreeItem(group).contextValue, 'group-sort-descending');
      assert.equal(refreshes, 1);

      assert.equal(treeDataProvider.sortTabs('descending', group), false);
      assert.equal(treeDataProvider.getTreeItem(group).contextValue, 'group-sort-ascending');
      assert.equal(refreshes, 2);
    } finally {
      treeDataProvider.dispose();
      await closeTabs([uri.toString()]);
      await vscode.workspace.fs.delete(uri, { useTrash: false });
    }
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
      JSON.stringify({ uri: notebookUri.toString(), notebookType }),
    );
  });

  test('keeps custom and notebook tabs with different full URIs distinct', () => {
    const firstUri = vscode.Uri.from({
      scheme: 'vscode-remote',
      authority: 'ssh-remote+first',
      path: '/workspace/example',
      query: 'version=1',
      fragment: 'first',
    });
    const secondUri = vscode.Uri.from({
      scheme: 'vscode-remote',
      authority: 'ssh-remote+second',
      path: '/workspace/example',
      query: 'version=2',
      fragment: 'second',
    });
    const firstCustomTab = {
      input: new vscode.TabInputCustom(firstUri, 'example.custom'),
    } as vscode.Tab;
    const secondCustomTab = {
      input: new vscode.TabInputCustom(secondUri, 'example.custom'),
    } as vscode.Tab;
    const firstNotebookTab = {
      input: new vscode.TabInputNotebook(firstUri, 'jupyter-notebook'),
    } as vscode.Tab;
    const secondNotebookTab = {
      input: new vscode.TabInputNotebook(secondUri, 'jupyter-notebook'),
    } as vscode.Tab;

    assert.notEqual(getNormalizedTabId(firstCustomTab), getNormalizedTabId(secondCustomTab));
    assert.notEqual(getNormalizedTabId(firstNotebookTab), getNormalizedTabId(secondNotebookTab));
  });

  test('matches legacy custom and notebook tab IDs during state restoration', () => {
    const uri = vscode.Uri.from({
      scheme: 'vscode-remote',
      authority: 'ssh-remote+workspace',
      path: '/workspace/example',
      query: 'version=1',
      fragment: 'first',
    });
    const customTab = {
      input: new vscode.TabInputCustom(uri, 'example.custom'),
    } as vscode.Tab;
    const notebookTab = {
      input: new vscode.TabInputNotebook(uri, 'jupyter-notebook'),
    } as vscode.Tab;

    assert.ok(
      matchesTabId(customTab, JSON.stringify({ uri: uri.path, viewType: 'example.custom' })),
    );
    assert.ok(
      matchesTabId(
        notebookTab,
        JSON.stringify({ uri: uri.path, notebookType: 'jupyter-notebook' }),
      ),
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
    assert.equal(treeItem.id, 'saved-group:saved-group');
    assert.equal(treeItem.description, '2 tabs');
    assert.equal(treeItem.collapsibleState, vscode.TreeItemCollapsibleState.Collapsed);
    assert.equal(treeItem.command, undefined);

    const savedTabs = provider.getChildren(savedGroup);
    assert.equal(savedTabs.length, 2);
    const firstSavedTabTreeItem = provider.getTreeItem(savedTabs[0]);
    assert.equal(firstSavedTabTreeItem.contextValue, 'saved-tab');
    assert.equal(firstSavedTabTreeItem.id, 'saved-tab:saved-group:event-publisher-role');
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

  test('does not change group membership while sorting', async () => {
    const treeDataProvider = new TreeDataProvider();
    const rootTab: Tab = { type: TreeItemType.Tab, groupId: null, id: 'root' };
    const group: Group = {
      type: TreeItemType.Group,
      id: 'group',
      colorId: 'charts.green',
      label: 'Group',
      children: [],
      collapsed: false,
    };
    const groupedTab: Tab = { type: TreeItemType.Tab, groupId: group.id, id: 'grouped' };
    group.children = [groupedTab];
    const cancellation = new vscode.CancellationTokenSource();
    const dataTransfer = new vscode.DataTransfer();

    treeDataProvider.setState([rootTab, group]);
    treeDataProvider.toggleSortMode(true);
    await treeDataProvider.handleDrag([rootTab], dataTransfer, cancellation.token);
    await treeDataProvider.handleDrop(groupedTab, dataTransfer, cancellation.token);

    assert.deepStrictEqual(treeDataProvider.getState(), [rootTab, group]);
    assert.deepStrictEqual(group.children, [groupedTab]);

    cancellation.dispose();
    treeDataProvider.dispose();
  });

  test('sorts root tabs and group children by URI without moving groups', async () => {
    const prefix = `tab-group-sort-${Date.now()}`;
    const alphaUri = vscode.Uri.file(join(tmpdir(), `${prefix}-alpha.txt`));
    const bravoUri = vscode.Uri.file(join(tmpdir(), `${prefix}-bravo.txt`));
    const deltaUri = vscode.Uri.file(join(tmpdir(), `${prefix}-delta.txt`));
    const zuluUri = vscode.Uri.file(join(tmpdir(), `${prefix}-zulu.txt`));
    const rootZuluTab: Tab = { type: TreeItemType.Tab, groupId: null, id: zuluUri.toString() };
    const rootAlphaTab: Tab = { type: TreeItemType.Tab, groupId: null, id: alphaUri.toString() };
    const group: Group = {
      type: TreeItemType.Group,
      id: `${prefix}-group`,
      colorId: 'charts.green',
      label: 'Group',
      children: [],
      collapsed: false,
    };
    const groupedDeltaTab: Tab = {
      type: TreeItemType.Tab,
      groupId: group.id,
      id: deltaUri.toString(),
    };
    const groupedBravoTab: Tab = {
      type: TreeItemType.Tab,
      groupId: group.id,
      id: bravoUri.toString(),
    };
    group.children = [groupedDeltaTab, groupedBravoTab];
    const treeDataProvider = new TreeDataProvider();

    await Promise.all(
      [alphaUri, bravoUri, deltaUri, zuluUri].map(uri =>
        vscode.workspace.fs.writeFile(uri, Buffer.from(uri.fsPath)),
      ),
    );

    try {
      for (const uri of [alphaUri, bravoUri, deltaUri, zuluUri]) {
        await vscode.commands.executeCommand('vscode.open', uri, { preview: false });
      }

      treeDataProvider.setState([rootZuluTab, group, rootAlphaTab]);

      assert.equal(treeDataProvider.sortTabs('ascending'), true);
      assert.deepStrictEqual(treeDataProvider.getState(), [rootAlphaTab, group, rootZuluTab]);
      assert.deepStrictEqual(group.children, [groupedBravoTab, groupedDeltaTab]);

      assert.equal(treeDataProvider.sortTabs('descending'), true);
      assert.deepStrictEqual(treeDataProvider.getState(), [rootZuluTab, group, rootAlphaTab]);
      assert.deepStrictEqual(group.children, [groupedDeltaTab, groupedBravoTab]);

      assert.equal(treeDataProvider.sortTabs('ascending', group), true);
      assert.deepStrictEqual(treeDataProvider.getState(), [rootZuluTab, group, rootAlphaTab]);
      assert.deepStrictEqual(group.children, [groupedBravoTab, groupedDeltaTab]);
    } finally {
      treeDataProvider.dispose();
      await closeTabs([rootAlphaTab.id, groupedBravoTab.id, groupedDeltaTab.id, rootZuluTab.id]);
      await Promise.all(
        [alphaUri, bravoUri, deltaUri, zuluUri].map(uri =>
          vscode.workspace.fs.delete(uri, { useTrash: false }),
        ),
      );
    }
  });

  test('sorts root groups by name in both directions without moving root tabs', () => {
    const firstRootTab: Tab = { type: TreeItemType.Tab, groupId: null, id: 'first-root' };
    const secondRootTab: Tab = { type: TreeItemType.Tab, groupId: null, id: 'second-root' };
    const zuluGroup: Group = {
      type: TreeItemType.Group,
      id: 'zulu-group',
      colorId: 'charts.green',
      label: 'Zulu',
      children: [],
      collapsed: false,
    };
    const alphaGroup: Group = {
      type: TreeItemType.Group,
      id: 'alpha-group',
      colorId: 'charts.blue',
      label: 'Alpha',
      children: [],
      collapsed: false,
    };
    const treeDataProvider = new TreeDataProvider();

    zuluGroup.children = [
      { type: TreeItemType.Tab, groupId: zuluGroup.id, id: 'zulu-group-child' },
    ];
    alphaGroup.children = [
      { type: TreeItemType.Tab, groupId: alphaGroup.id, id: 'alpha-group-child' },
    ];

    treeDataProvider.setState([firstRootTab, zuluGroup, secondRootTab, alphaGroup]);

    assert.equal(treeDataProvider.sortTabs('ascending'), true);
    assert.deepStrictEqual(treeDataProvider.getState(), [
      firstRootTab,
      alphaGroup,
      secondRootTab,
      zuluGroup,
    ]);
    assert.deepStrictEqual(zuluGroup.children, [
      { type: TreeItemType.Tab, groupId: zuluGroup.id, id: 'zulu-group-child' },
    ]);
    assert.deepStrictEqual(alphaGroup.children, [
      { type: TreeItemType.Tab, groupId: alphaGroup.id, id: 'alpha-group-child' },
    ]);

    assert.equal(treeDataProvider.sortTabs('descending'), true);
    assert.deepStrictEqual(treeDataProvider.getState(), [
      firstRootTab,
      zuluGroup,
      secondRootTab,
      alphaGroup,
    ]);

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
    const firstSavedTab = createSavedTextTab(firstUri);
    const secondSavedTab = createSavedTextTab(secondUri);

    await vscode.workspace.fs.writeFile(firstUri, Buffer.from('first'));
    await vscode.workspace.fs.writeFile(secondUri, Buffer.from('second'));

    try {
      await reopenSavedTab(firstSavedTab);
      await reopenSavedTab(secondSavedTab);

      const openTabIds = getOpenTabIds();
      assert.ok(openTabIds.has(firstSavedTab.id));
      assert.ok(openTabIds.has(secondSavedTab.id));
    } finally {
      await closeTabs([firstSavedTab.id, secondSavedTab.id]);
      await vscode.workspace.fs.delete(firstUri, { useTrash: false });
      await vscode.workspace.fs.delete(secondUri, { useTrash: false });
    }
  });

  test('restores available tabs when a saved group is only partially restorable', async () => {
    const prefix = `tab-group-partial-restore-${Date.now()}`;
    const availableUri = vscode.Uri.file(join(tmpdir(), `${prefix}-available.txt`));
    const missingUri = vscode.Uri.file(join(tmpdir(), `${prefix}-missing.txt`));
    const availableTab = createSavedTextTab(availableUri);
    const savedGroup: SavedGroup = {
      id: `${prefix}-group`,
      sourceGroupId: `${prefix}-source`,
      name: 'Partial restore',
      groupLabel: 'Partial restore',
      colorId: 'charts.green',
      collapsed: false,
      tabs: [availableTab, createSavedTextTab(missingUri)],
    };

    await vscode.workspace.fs.writeFile(availableUri, Buffer.from('available'));

    try {
      await vscode.commands.executeCommand('tabsTreeView.savedGroup.restore', savedGroup);

      assert.ok(getOpenTabIds().has(availableTab.id));
    } finally {
      await closeTabs([availableTab.id]);
      await vscode.workspace.fs.delete(availableUri, { useTrash: false });
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
