import * as vscode from 'vscode';
import { randomUUID } from 'node:crypto';
import { getNormalizedTabId, matchesTabId, reopenSavedTab, toSavedTab } from './TabTypeHandler';
import { WorkspaceStateStore } from '../services/WorkspaceStateStore';
import { SavedGroupsStore } from '../services/SavedGroupsStore';
import { RecentTabs } from '../services/RecentTabs';
import { ExclusiveHandle } from '../utils/event';
import { asPromise } from '../utils/async';
import { Group, isGroup, Tab, TreeItemType } from '../models/types';
import { SavedGroup, SavedTab } from '../models/SavedGroup';
import { getNativeTabs, TreeDataProvider } from './TreeDataProvider';
import { RecentTabsTreeDataProvider } from './RecentTabsTreeDataProvider';
import { SavedGroupsTreeDataProvider } from './SavedGroupsTreeDataProvider';
import { Disposable } from '../utils/disposable';
import { ContextKeys, setContext } from '../utils/context';
import { getTabFileDecorationProvider } from '../decorators/TabFileDecorationProvider';
import { GroupColorId, groupColorOptions } from '../utils/color';
import { getSavedTabId, getSavedTabLabel } from '../utils/savedTab';
import { TabSortDirection } from '../utils/tabSort';

type GroupColorQuickPickItem = vscode.QuickPickItem & {
  colorId: GroupColorId;
};

type SavedGroupQuickPickItem = vscode.QuickPickItem & {
  savedGroup: SavedGroup;
};

type SavedGroupRestoreResult = {
  readonly restoredTabIds: readonly string[];
  readonly failedTabs: readonly SavedTab[];
};

export class TabsView extends Disposable {
  private treeDataProvider: TreeDataProvider = this._register(new TreeDataProvider());
  private recentTabs = new RecentTabs();
  private recentTabsTreeDataProvider = this._register(
    new RecentTabsTreeDataProvider(this.treeDataProvider, this.recentTabs),
  );
  private readonly savedGroupsTreeDataProvider: SavedGroupsTreeDataProvider;
  private exclusiveHandle = new ExclusiveHandle();
  private selectedGroup: Group | undefined;
  private expandedSavedGroupIds = new Set<string>();

  constructor(
    private readonly workspaceStateStore: WorkspaceStateStore,
    private readonly savedGroupsStore: SavedGroupsStore,
  ) {
    super();

    this.savedGroupsTreeDataProvider = this._register(
      new SavedGroupsTreeDataProvider(this.savedGroupsStore),
    );

    const initialState = this.initializeState();

    this.recentTabs.setState(this.workspaceStateStore.loadRecentTabs() ?? []);
    this.saveState(initialState);
    this.treeDataProvider.setState(initialState);
    this.refreshRecentTabs(this.getActiveNativeTab());

    setContext(ContextKeys.AllCollapsed, this.treeDataProvider.isAllCollapsed());
    setContext(ContextKeys.SavedGroupsAllExpanded, false);
    setContext(ContextKeys.SelectedGroup, false);
    setContext(ContextKeys.NextRootSortAscending, true);

    const view = this._register(
      vscode.window.createTreeView('tabsTreeView', {
        treeDataProvider: this.treeDataProvider,
        dragAndDropController: this.treeDataProvider,
        canSelectMany: true,
      }),
    );
    const recentView = this._register(
      vscode.window.createTreeView('recentTabsTreeView', {
        treeDataProvider: this.recentTabsTreeDataProvider,
        dragAndDropController: this.recentTabsTreeDataProvider,
        canSelectMany: true,
      }),
    );
    const savedGroupsView = this._register(
      vscode.window.createTreeView('savedGroupsTreeView', {
        treeDataProvider: this.savedGroupsTreeDataProvider,
      }),
    );

    this._register(
      this.treeDataProvider.onDidChangeState(() => {
        this.saveState(this.treeDataProvider.getState());
        this.recentTabsTreeDataProvider.refresh();
      }),
    );

    const tabFileDecorationProvider = this._register(getTabFileDecorationProvider());

    this._register(
      tabFileDecorationProvider.onDidChangeFileDecorations(uris => {
        if (uris.length > 0) {
          this.treeDataProvider.triggerRerender();
          this.recentTabsTreeDataProvider.refresh();
        }
      }),
    );

    this._register(
      vscode.commands.registerCommand('tabsTreeView.tab.close', (tab: Tab) =>
        vscode.window.tabGroups.close(getNativeTabs(tab)),
      ),
    );

    this._register(
      vscode.commands.registerCommand('tabsTreeView.tab.ungroup', (tab: Tab) =>
        this.treeDataProvider.ungroup(tab),
      ),
    );

    this._register(
      vscode.commands.registerCommand('tabsTreeView.group.rename', (group: Group) => {
        vscode.window
          .showInputBox({ placeHolder: 'Name this Group', value: group.label })
          .then(input => {
            if (input) {
              this.treeDataProvider.renameGroup(group, input);
            }
          });
      }),
    );

    this._register(
      vscode.commands.registerCommand('tabsTreeView.group.changeColor', async (group?: Group) => {
        const targetGroup = group ?? this.selectedGroup;
        if (!targetGroup) {
          return;
        }

        const selectedColor = await vscode.window.showQuickPick<GroupColorQuickPickItem>(
          groupColorOptions.map(color => ({
            label: `${color.swatch} ${color.label}`,
            description: color.id === targetGroup.colorId ? 'Current color' : undefined,
            colorId: color.id,
          })),
          { placeHolder: `Choose a color for ${targetGroup.label || 'this group'}` },
        );

        if (selectedColor) {
          this.treeDataProvider.setGroupColor(targetGroup, selectedColor.colorId);
        }
      }),
    );

    this._register(
      vscode.commands.registerCommand('tabsTreeView.sortTabsAscending', (group?: Group) =>
        this.sortTabs('ascending', group),
      ),
    );

    this._register(
      vscode.commands.registerCommand('tabsTreeView.sortTabsDescending', (group?: Group) =>
        this.sortTabs('descending', group),
      ),
    );

    this._register(
      vscode.commands.registerCommand('tabsTreeView.group.save', async (group?: Group) => {
        if (group) {
          await this.saveGroup(group);
        }
      }),
    );

    this._register(
      vscode.commands.registerCommand(
        'tabsTreeView.savedGroup.restore',
        (savedGroup?: SavedGroup) => this.restoreSavedGroup(savedGroup),
      ),
    );

    this._register(
      vscode.commands.registerCommand('tabsTreeView.savedGroup.delete', (savedGroup?: SavedGroup) =>
        this.deleteSavedGroup(savedGroup),
      ),
    );

    this._register(
      vscode.commands.registerCommand('tabsTreeView.savedGroups.restoreAll', () =>
        this.restoreAllSavedGroups(),
      ),
    );

    this._register(
      vscode.commands.registerCommand('tabsTreeView.savedGroups.deleteAll', () =>
        this.deleteAllSavedGroups(),
      ),
    );

    this._register(
      vscode.commands.registerCommand('tabsTreeView.group.cancelGroup', (group: Group) =>
        this.treeDataProvider.cancelGroup(group),
      ),
    );

    this._register(
      vscode.commands.registerCommand('tabsTreeView.group.close', (group: Group) => {
        vscode.window.tabGroups.close(group.children.map((tab: Tab) => getNativeTabs(tab)).flat());
      }),
    );

    this._register(
      vscode.commands.registerCommand('tabsTreeView.reset', () => {
        this.selectedGroup = undefined;
        setContext(ContextKeys.SelectedGroup, false);
        const initialState = this.mergeState([], this.getNativeTabs());
        this.treeDataProvider.setState(initialState);
      }),
    );

    this._register(
      vscode.commands.registerCommand('tabsTreeView.enableSortMode', () => {
        setContext(ContextKeys.SortMode, true);
        view.title = (view.title ?? '') + ' (Sorting)';
        this.treeDataProvider.toggleSortMode(true);
      }),
    );

    this._register(
      vscode.commands.registerCommand('tabsTreeView.disableSortMode', () => {
        setContext(ContextKeys.SortMode, false);
        view.title = (view.title ?? '').replace(' (Sorting)', '');
        this.treeDataProvider.toggleSortMode(false);
      }),
    );

    this._register(
      vscode.window.tabGroups.onDidChangeTabs(e => {
        const openedTabsChanged = this.treeDataProvider.appendTabs(e.opened);
        const closedTabsChanged = this.treeDataProvider.closeTabs(e.closed);

        if (e.changed[0] && e.changed[0].isActive) {
          const tab = this.treeDataProvider.getTab(e.changed[0]);
          if (tab) {
            if (view.visible) {
              this.exclusiveHandle.run(() =>
                asPromise(view.reveal(tab, { select: true, expand: true })),
              );
            }
          }
        }

        this.treeDataProvider.triggerRerender();
        this.refreshRecentTabs(this.getActiveNativeTab());
        if (openedTabsChanged || closedTabsChanged) {
          this.saveState(this.treeDataProvider.getState());
        }
      }),
    );

    this._register(
      vscode.window.tabGroups.onDidChangeTabGroups(() => {
        this.refreshRecentTabs(this.getActiveNativeTab());
      }),
    );

    this._register(
      recentView.onDidChangeSelection(e => {
        const item = e.selection.length > 0 ? e.selection[e.selection.length - 1] : undefined;
        if (item?.type === TreeItemType.Tab) {
          this.exclusiveHandle.run(() => asPromise(this.treeDataProvider.activate(item)));
        }
      }),
    );

    this._register(
      view.onDidChangeSelection(e => {
        const item = e.selection.length > 0 ? e.selection[e.selection.length - 1] : undefined;
        this.selectedGroup = item && isGroup(item) ? item : undefined;
        setContext(ContextKeys.SelectedGroup, Boolean(this.selectedGroup));

        if (item?.type === TreeItemType.Tab) {
          this.exclusiveHandle.run(() => asPromise(this.treeDataProvider.activate(item)));
        }
      }),
    );

    this._register(
      vscode.commands.registerCommand('tabsTreeView.collapseAll', () =>
        vscode.commands.executeCommand('list.collapseAll'),
      ),
    );

    this._register(
      vscode.commands.registerCommand('tabsTreeView.expandAll', () => {
        for (const item of this.treeDataProvider.getState()) {
          if (isGroup(item) && item.children.length > 0) {
            view.reveal(item, { expand: true });
          }
        }
      }),
    );

    this._register(
      vscode.commands.registerCommand('tabsTreeView.savedGroups.collapseAll', async () => {
        this.expandedSavedGroupIds.clear();
        await setContext(ContextKeys.SavedGroupsAllExpanded, false);
        await vscode.commands.executeCommand('list.collapseAll');
      }),
    );

    this._register(
      vscode.commands.registerCommand('tabsTreeView.savedGroups.expandAll', async () => {
        this.expandedSavedGroupIds.clear();
        for (const item of this.savedGroupsTreeDataProvider.getChildren()) {
          if ('tabs' in item && item.tabs.length > 0) {
            this.expandedSavedGroupIds.add(item.id);
            savedGroupsView.reveal(item, { expand: true });
          }
        }
        await this.updateSavedGroupsExpansionContext();
      }),
    );

    this._register(
      savedGroupsView.onDidExpandElement(element => {
        if ('tabs' in element.element) {
          this.expandedSavedGroupIds.add(element.element.id);
          void this.updateSavedGroupsExpansionContext();
        }
      }),
    );

    this._register(
      savedGroupsView.onDidCollapseElement(element => {
        if ('tabs' in element.element) {
          this.expandedSavedGroupIds.delete(element.element.id);
          void this.updateSavedGroupsExpansionContext();
        }
      }),
    );

    this._register(
      view.onDidExpandElement(element => {
        if (isGroup(element.element)) {
          this.treeDataProvider.setCollapsedState(element.element, false);
          this.saveState(this.treeDataProvider.getState());
          setContext(ContextKeys.AllCollapsed, false);
        }
      }),
    );

    this._register(
      view.onDidCollapseElement(element => {
        if (isGroup(element.element)) {
          this.treeDataProvider.setCollapsedState(element.element, true);
          this.saveState(this.treeDataProvider.getState());
          setContext(ContextKeys.AllCollapsed, this.treeDataProvider.isAllCollapsed());
        }
      }),
    );
  }

  private __tabsview_construct_end() {}

  private async sortTabs(direction: TabSortDirection, group?: Group): Promise<void> {
    this.treeDataProvider.sortTabs(direction, group);
    if (!group) {
      await setContext(ContextKeys.NextRootSortAscending, direction === 'descending');
    }
  }

  private async updateSavedGroupsExpansionContext(): Promise<void> {
    const savedGroupIds = new Set(this.getSavedGroups().map(savedGroup => savedGroup.id));
    for (const savedGroupId of this.expandedSavedGroupIds) {
      if (!savedGroupIds.has(savedGroupId)) {
        this.expandedSavedGroupIds.delete(savedGroupId);
      }
    }

    const allExpanded =
      savedGroupIds.size > 0 &&
      [...savedGroupIds].every(savedGroupId => this.expandedSavedGroupIds.has(savedGroupId));
    await setContext(ContextKeys.SavedGroupsAllExpanded, allExpanded);
  }

  private async saveGroup(group: Group): Promise<void> {
    const tabs: SavedTab[] = [];
    for (const tab of group.children) {
      const nativeTab = getNativeTabs(tab)[0];
      const savedTab = nativeTab && toSavedTab(nativeTab);
      if (!savedTab) {
        void vscode.window.showWarningMessage(
          'Cannot save this group because one or more tabs are no longer open.',
        );
        return;
      }
      tabs.push(savedTab);
    }

    if (tabs.length === 0) {
      void vscode.window.showWarningMessage('Cannot save an empty group.');
      return;
    }

    const savedGroups = this.getSavedGroups();
    const existingGroup = savedGroups.find(savedGroup => savedGroup.sourceGroupId === group.id);
    const name =
      existingGroup?.name ??
      (
        await vscode.window.showInputBox({
          placeHolder: 'Name this saved group',
          value: group.label,
        })
      )?.trim();
    if (!name) {
      return;
    }

    const groupWithSameName = savedGroups.find(savedGroup => savedGroup.name === name);
    if (!existingGroup && groupWithSameName) {
      const choice = await vscode.window.showWarningMessage(
        `Replace the saved tab group "${name}"?`,
        { modal: true },
        'Replace',
      );
      if (choice !== 'Replace') {
        return;
      }
    }

    const groupToReplace = existingGroup ?? groupWithSameName;

    const savedGroup: SavedGroup = {
      id: groupToReplace?.id ?? randomUUID(),
      sourceGroupId: group.id,
      name,
      groupLabel: group.label,
      colorId: group.colorId,
      collapsed: group.collapsed,
      tabs,
    };
    const nextSavedGroups = groupToReplace
      ? savedGroups.map(candidate => (candidate.id === groupToReplace.id ? savedGroup : candidate))
      : [...savedGroups, savedGroup];

    await this.saveSavedGroups(
      nextSavedGroups,
      `${existingGroup ? 'Updated' : 'Saved'} tab group "${name}".`,
      `Could not save tab group "${name}".`,
    );
  }

  private async restoreSavedGroup(selectedSavedGroup?: SavedGroup): Promise<void> {
    const savedGroup =
      selectedSavedGroup ?? (await this.pickSavedGroup('Choose a saved tab group to restore'));
    if (!savedGroup) {
      return;
    }

    const result = await this.restoreSavedGroupTabs(savedGroup);
    this.showRestoreResult(savedGroup, result);
  }

  private async restoreSavedGroupTabs(savedGroup: SavedGroup): Promise<SavedGroupRestoreResult> {
    const tabs: Tab[] = [];
    const failedTabs: SavedTab[] = [];
    for (const savedTab of savedGroup.tabs) {
      const tabId = getSavedTabId(savedTab);
      let nativeTab = this.findNativeTab(tabId);
      if (!nativeTab) {
        try {
          await reopenSavedTab(savedTab);
          nativeTab = this.findNativeTab(tabId);
        } catch (error) {
          console.error('Failed to restore saved tab', error);
        }
      }

      if (!nativeTab) {
        failedTabs.push(savedTab);
        continue;
      }

      this.treeDataProvider.appendTabs([nativeTab]);
      const tab = this.treeDataProvider.getTab(nativeTab);
      if (tab) {
        tabs.push(tab);
      } else {
        failedTabs.push(savedTab);
      }
    }

    const restoredGroup = this.treeDataProvider.restoreGroup(
      tabs,
      {
        colorId: savedGroup.colorId,
        label: savedGroup.groupLabel,
        collapsed: savedGroup.collapsed,
      },
      savedGroup.sourceGroupId,
    );
    if (!restoredGroup) {
      return { restoredTabIds: [], failedTabs };
    }

    setContext(ContextKeys.AllCollapsed, this.treeDataProvider.isAllCollapsed());
    return { restoredTabIds: tabs.map(tab => tab.id), failedTabs };
  }

  private showRestoreResult(savedGroup: SavedGroup, result: SavedGroupRestoreResult): void {
    if (result.restoredTabIds.length === 0) {
      void vscode.window.showErrorMessage(`Could not restore tab group "${savedGroup.name}".`);
      return;
    }

    if (result.failedTabs.length > 0) {
      const failedTabLabels = result.failedTabs.map(getSavedTabLabel).join(', ');
      void vscode.window.showWarningMessage(
        `Restored "${savedGroup.name}", but could not open: ${failedTabLabels}.`,
      );
      return;
    }

    void vscode.window.showInformationMessage(`Restored tab group "${savedGroup.name}".`);
  }

  private async restoreAllSavedGroups(): Promise<void> {
    const savedGroups = this.getSavedGroups();
    if (savedGroups.length === 0) {
      void vscode.window.showInformationMessage('No saved tab groups are available.');
      return;
    }

    const restoredTabIds = new Set<string>();
    let restoredGroupCount = 0;
    let overlappingTabCount = 0;
    let failedTabCount = 0;
    for (const savedGroup of savedGroups) {
      const tabs = savedGroup.tabs.filter(savedTab => !restoredTabIds.has(getSavedTabId(savedTab)));
      overlappingTabCount += savedGroup.tabs.length - tabs.length;
      if (tabs.length === 0) {
        continue;
      }

      const result = await this.restoreSavedGroupTabs({ ...savedGroup, tabs });
      result.restoredTabIds.forEach(tabId => restoredTabIds.add(tabId));
      failedTabCount += result.failedTabs.length;
      if (result.restoredTabIds.length > 0) {
        restoredGroupCount++;
      }
    }

    const message = `Restored ${restoredGroupCount} of ${savedGroups.length} saved tab groups.`;
    if (overlappingTabCount > 0 || restoredGroupCount !== savedGroups.length) {
      const details = [];
      if (overlappingTabCount > 0) {
        details.push('Shared tabs stayed with the first matching saved group.');
      }
      if (failedTabCount > 0) {
        details.push(
          `Could not restore ${failedTabCount} saved tab${failedTabCount === 1 ? '' : 's'}.`,
        );
      }
      if (restoredGroupCount !== savedGroups.length) {
        details.push('Some snapshots had no restorable tabs.');
      }
      void vscode.window.showWarningMessage(`${message} ${details.join(' ')}`);
      return;
    }

    void vscode.window.showInformationMessage(message);
  }

  private async deleteSavedGroup(selectedSavedGroup?: SavedGroup): Promise<void> {
    const savedGroup =
      selectedSavedGroup ?? (await this.pickSavedGroup('Choose a saved tab group to delete'));
    if (!savedGroup) {
      return;
    }

    const choice = await vscode.window.showWarningMessage(
      `Delete the saved tab group "${savedGroup.name}"?`,
      { modal: true },
      'Delete',
    );
    if (choice !== 'Delete') {
      return;
    }

    const savedGroups = this.getSavedGroups();
    await this.saveSavedGroups(
      savedGroups.filter(candidate => candidate.id !== savedGroup.id),
      `Deleted saved tab group "${savedGroup.name}".`,
      `Could not delete tab group "${savedGroup.name}".`,
    );
  }

  private async deleteAllSavedGroups(): Promise<void> {
    const savedGroups = this.getSavedGroups();
    if (savedGroups.length === 0) {
      void vscode.window.showInformationMessage('No saved tab groups are available.');
      return;
    }

    const choice = await vscode.window.showWarningMessage(
      `Delete all ${savedGroups.length} saved tab groups?`,
      { modal: true },
      'Delete All',
    );
    if (choice !== 'Delete All') {
      return;
    }

    await this.saveSavedGroups(
      [],
      `Deleted ${savedGroups.length} saved tab groups.`,
      'Could not delete all saved tab groups.',
    );
  }

  private async pickSavedGroup(placeHolder: string): Promise<SavedGroup | undefined> {
    const savedGroups = this.getSavedGroups();
    if (savedGroups.length === 0) {
      void vscode.window.showInformationMessage('No saved tab groups are available.');
      return undefined;
    }

    const selected = await vscode.window.showQuickPick<SavedGroupQuickPickItem>(
      savedGroups.map(savedGroup => ({
        label: savedGroup.name,
        description: `${savedGroup.tabs.length} tab${savedGroup.tabs.length === 1 ? '' : 's'}`,
        savedGroup,
      })),
      { placeHolder },
    );
    return selected?.savedGroup;
  }

  private getSavedGroups(): readonly SavedGroup[] {
    return this.savedGroupsStore.load() ?? [];
  }

  private async saveSavedGroups(
    savedGroups: readonly SavedGroup[],
    successMessage: string,
    failureMessage: string,
  ): Promise<void> {
    try {
      await this.savedGroupsStore.save(savedGroups);
      this.savedGroupsTreeDataProvider.refresh();
      void this.updateSavedGroupsExpansionContext();
      void vscode.window.showInformationMessage(successMessage);
    } catch (error) {
      console.error(failureMessage, error);
      void vscode.window.showErrorMessage(failureMessage);
    }
  }

  private findNativeTab(tabId: string): vscode.Tab | undefined {
    return this.getNativeTabs().find(nativeTab => {
      try {
        return getNormalizedTabId(nativeTab) === tabId;
      } catch {
        return false;
      }
    });
  }

  private initializeState(): Array<Tab | Group> {
    const jsonItems = this.workspaceStateStore.load() ?? [];
    return this.mergeState(jsonItems, this.getNativeTabs());
  }

  private mergeState(jsonItems: Array<Tab | Group>, nativeTabs: vscode.Tab[]): Array<Tab | Group> {
    const mergedTabs: Array<Tab | Group> = [];

    for (const jsonItem of jsonItems) {
      if (jsonItem.type === TreeItemType.Tab) {
        const nativeTab = this.findCorrespondingTab(nativeTabs, jsonItem);
        if (nativeTab) {
          mergedTabs.push(this.withNormalizedTabId(jsonItem, nativeTab));
          nativeTabs = this.removeNativeTab(nativeTabs, nativeTab);
        }
      } else {
        const children: Tab[] = [];
        jsonItem.children.forEach(tab => {
          const nativeTab = this.findCorrespondingTab(nativeTabs, tab);
          if (nativeTab) {
            children.push(this.withNormalizedTabId(tab, nativeTab));
            nativeTabs = this.removeNativeTab(nativeTabs, nativeTab);
          }
        });

        if (children.length > 0) {
          mergedTabs.push({ ...jsonItem, children });
        }
      }
    }

    const tabMap: Record<string, Tab> = {}; // if there are same resources in multiple tab group, add only one
    nativeTabs.forEach(tab => {
      try {
        const id = getNormalizedTabId(tab);
        if (!tabMap[id]) {
          tabMap[id] = { type: TreeItemType.Tab, groupId: null, id };
          mergedTabs.push(tabMap[id]);
        }
      } catch {
        // won't add unimplemented-typed tab into tree
      }
    });

    return mergedTabs;
  }

  private saveState(state: Array<Tab | Group>): void {
    void this.workspaceStateStore.save(state);
  }

  private saveRecentTabs(): void {
    void this.workspaceStateStore
      .saveRecentTabs(this.recentTabs.getState())
      .then(undefined, error => console.error('Failed to save recent tabs', error));
  }

  private refreshRecentTabs(activeTab: vscode.Tab | undefined): void {
    const nativeTabIds = this.collectNativeTabIds(this.getNativeTabs());

    let changed = this.recentTabs.reconcile([...nativeTabIds]);
    if (activeTab) {
      try {
        const tabId = getNormalizedTabId(activeTab);
        if (nativeTabIds.has(tabId)) {
          changed = this.recentTabs.touch(tabId) || changed;
        }
      } catch {
        // skip unsupported tab inputs
      }
    }

    if (changed) {
      this.saveRecentTabs();
      this.recentTabsTreeDataProvider.refresh();
    }
  }

  private getNativeTabs(): vscode.Tab[] {
    return vscode.window.tabGroups.all.flatMap(tabGroup => tabGroup.tabs);
  }

  private getActiveNativeTab(): vscode.Tab | undefined {
    return vscode.window.tabGroups.activeTabGroup?.activeTab;
  }

  private collectNativeTabIds(nativeTabs: readonly vscode.Tab[]): Set<string> {
    const nativeTabIds = new Set<string>();
    nativeTabs.forEach(nativeTab => {
      try {
        nativeTabIds.add(getNormalizedTabId(nativeTab));
      } catch {
        // skip unsupported tab inputs
      }
    });
    return nativeTabIds;
  }

  private isCorrespondingTab(tab: vscode.Tab, jsonTab: Tab): boolean {
    return matchesTabId(tab, jsonTab.id);
  }

  private findCorrespondingTab(
    nativeTabs: readonly vscode.Tab[],
    jsonTab: Tab,
  ): vscode.Tab | undefined {
    return nativeTabs.find(nativeTab => this.isCorrespondingTab(nativeTab, jsonTab));
  }

  private removeNativeTab(nativeTabs: readonly vscode.Tab[], nativeTab: vscode.Tab): vscode.Tab[] {
    const tabId = getNormalizedTabId(nativeTab);
    return nativeTabs.filter(tab => {
      try {
        return getNormalizedTabId(tab) !== tabId;
      } catch {
        return true;
      }
    });
  }

  private withNormalizedTabId(tab: Tab, nativeTab: vscode.Tab): Tab {
    return { ...tab, id: getNormalizedTabId(nativeTab) };
  }
}
