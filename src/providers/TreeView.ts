import * as vscode from 'vscode';
import { randomUUID } from 'node:crypto';
import { getNormalizedTabId, reopenSavedTab, toSavedTab } from './TabTypeHandler';
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

type GroupColorQuickPickItem = vscode.QuickPickItem & {
  colorId: GroupColorId;
};

type SavedGroupQuickPickItem = vscode.QuickPickItem & {
  savedGroup: SavedGroup;
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
    setContext(ContextKeys.SelectedGroup, false);

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
    this._register(
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

    const savedGroups = this.savedGroupsStore.load() ?? [];
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

    try {
      await this.savedGroupsStore.save(nextSavedGroups);
      this.savedGroupsTreeDataProvider.refresh();
      void vscode.window.showInformationMessage(
        `${existingGroup ? 'Updated' : 'Saved'} tab group "${name}".`,
      );
    } catch (error) {
      console.error('Failed to save tab group', error);
      void vscode.window.showErrorMessage(`Could not save tab group "${name}".`);
    }
  }

  private async restoreSavedGroup(
    selectedSavedGroup?: SavedGroup,
    showResult: boolean = true,
  ): Promise<boolean> {
    const savedGroup =
      selectedSavedGroup ?? (await this.pickSavedGroup('Choose a saved tab group to restore'));
    if (!savedGroup) {
      return false;
    }

    const tabs: Tab[] = [];
    const failedTabs: SavedTab[] = [];
    for (const savedTab of savedGroup.tabs) {
      let nativeTab = this.findNativeTab(savedTab.id);
      if (!nativeTab) {
        try {
          await reopenSavedTab(savedTab);
          nativeTab = this.findNativeTab(savedTab.id);
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
      if (showResult) {
        void vscode.window.showErrorMessage(`Could not restore tab group "${savedGroup.name}".`);
      }
      return false;
    }

    setContext(ContextKeys.AllCollapsed, this.treeDataProvider.isAllCollapsed());
    if (failedTabs.length > 0) {
      const failedTabLabels = failedTabs.map(tab => this.getSavedTabLabel(tab)).join(', ');
      if (showResult) {
        void vscode.window.showWarningMessage(
          `Restored "${savedGroup.name}", but could not open: ${failedTabLabels}.`,
        );
      }
      return true;
    }

    if (showResult) {
      void vscode.window.showInformationMessage(`Restored tab group "${savedGroup.name}".`);
    }
    return true;
  }

  private async restoreAllSavedGroups(): Promise<void> {
    const savedGroups = this.savedGroupsStore.load() ?? [];
    if (savedGroups.length === 0) {
      void vscode.window.showInformationMessage('No saved tab groups are available.');
      return;
    }

    const restoredTabIds = new Set<string>();
    let restoredGroupCount = 0;
    let overlappingTabCount = 0;
    for (const savedGroup of savedGroups) {
      const tabs = savedGroup.tabs.filter(savedTab => !restoredTabIds.has(savedTab.id));
      overlappingTabCount += savedGroup.tabs.length - tabs.length;
      tabs.forEach(savedTab => restoredTabIds.add(savedTab.id));
      if (tabs.length > 0 && (await this.restoreSavedGroup({ ...savedGroup, tabs }, false))) {
        restoredGroupCount++;
      }
    }

    const message = `Restored ${restoredGroupCount} of ${savedGroups.length} saved tab groups.`;
    if (overlappingTabCount > 0 || restoredGroupCount !== savedGroups.length) {
      const details = [];
      if (overlappingTabCount > 0) {
        details.push('Shared tabs stayed with the first matching saved group.');
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

    const savedGroups = this.savedGroupsStore.load() ?? [];
    try {
      await this.savedGroupsStore.save(
        savedGroups.filter(candidate => candidate.id !== savedGroup.id),
      );
      this.savedGroupsTreeDataProvider.refresh();
      void vscode.window.showInformationMessage(`Deleted saved tab group "${savedGroup.name}".`);
    } catch (error) {
      console.error('Failed to delete saved tab group', error);
      void vscode.window.showErrorMessage(`Could not delete tab group "${savedGroup.name}".`);
    }
  }

  private async deleteAllSavedGroups(): Promise<void> {
    const savedGroups = this.savedGroupsStore.load() ?? [];
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

    try {
      await this.savedGroupsStore.save([]);
      this.savedGroupsTreeDataProvider.refresh();
      void vscode.window.showInformationMessage(`Deleted ${savedGroups.length} saved tab groups.`);
    } catch (error) {
      console.error('Failed to delete all saved tab groups', error);
      void vscode.window.showErrorMessage('Could not delete all saved tab groups.');
    }
  }

  private async pickSavedGroup(placeHolder: string): Promise<SavedGroup | undefined> {
    const savedGroups = this.savedGroupsStore.load() ?? [];
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

  private findNativeTab(tabId: string): vscode.Tab | undefined {
    return this.getNativeTabs().find(nativeTab => {
      try {
        return getNormalizedTabId(nativeTab) === tabId;
      } catch {
        return false;
      }
    });
  }

  private getSavedTabLabel(savedTab: SavedTab): string {
    if ('label' in savedTab && savedTab.label) {
      return savedTab.label;
    }

    const uri = 'uri' in savedTab ? savedTab.uri : savedTab.modifiedUri;
    const path = vscode.Uri.parse(uri).path;
    return path.substring(path.lastIndexOf('/') + 1) || uri;
  }

  private initializeState(): Array<Tab | Group> {
    const jsonItems = this.workspaceStateStore.load() ?? [];
    return this.mergeState(jsonItems, this.getNativeTabs());
  }

  private mergeState(jsonItems: Array<Tab | Group>, nativeTabs: vscode.Tab[]): Array<Tab | Group> {
    const mergedTabs: Array<Tab | Group> = [];

    for (const jsonItem of jsonItems) {
      if (jsonItem.type === TreeItemType.Tab) {
        const length = nativeTabs.length;
        nativeTabs = nativeTabs.filter(nativeTab => !this.isCorrespondingTab(nativeTab, jsonItem));
        if (nativeTabs.length < length) {
          mergedTabs.push(jsonItem);
        }
      } else {
        const children: Tab[] = [];
        jsonItem.children.forEach(tab => {
          const length = nativeTabs.length;
          nativeTabs = nativeTabs.filter(nativeTab => !this.isCorrespondingTab(nativeTab, tab));

          if (nativeTabs.length < length) {
            children.push(tab);
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
    try {
      return jsonTab.id === getNormalizedTabId(tab);
    } catch {
      return false;
    }
  }
}
