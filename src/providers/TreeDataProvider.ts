import * as vscode from 'vscode';
import { join, sep } from 'node:path';

import { Disposable } from '../utils/disposable';
import {
  FilePathNode,
  Folder,
  Group,
  isGroup,
  isFolder,
  isSlot,
  isTab,
  Slot,
  Tab,
  TreeElement,
  TreeItemType,
  ViewMode,
} from '../models/types';
import { TreeState } from '../services/TreeState';
import { getHandler, getNormalizedTabId } from './TabTypeHandler';
import { GroupColorId, getGroupColorOption } from '../utils/color';
import { findLongestCommonFilePathPrefixIndex } from '../utils/filePath';
import {
  compareSortStrings,
  compareTabSortKeys,
  TabSortDirection,
  TabSortKey,
} from '../utils/tabSort';
import { createFileTree, FileTreeItem } from '../utils/fileTree';

export function getNativeTabs(tab: Tab): vscode.Tab[] {
  const currentNativeTabs = vscode.window.tabGroups.all.flatMap(tabGroup => tabGroup.tabs);
  return currentNativeTabs.filter(nativeTab => {
    const handler = getHandler(nativeTab);
    return tab.id === handler?.getNormalizedId(nativeTab);
  });
}

export const TabDropMimeType = 'application/vnd.code.tree.tabstreeview';
export const RecentTabsTreeMimeType = 'application/vnd.code.tree.recenttabstreeview';

export class TreeDataProvider
  extends Disposable
  implements vscode.TreeDataProvider<TreeElement>, vscode.TreeDragAndDropController<TreeElement>
{
  constructor() {
    super();
  }
  private _onDidChangeTreeData = this._register(new vscode.EventEmitter<void>());
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  private _onDidChangeState = this._register(new vscode.EventEmitter<void>());
  onDidChangeState = this._onDidChangeState.event;

  private treeState = new TreeState();

  /**
   * To reuse tree item object
   */
  private treeItemMap: Record<string, vscode.TreeItem> = {};

  /**
   * Store file path of open tab with resourceUri as tree map to use for label if duplicated file name showing
   */
  private filePathTree: Record<string, Record<string, FilePathNode>> = {};

  private sortMode = false;
  private viewMode: ViewMode = 'list';
  private defaultNextGroupSortDirection: TabSortDirection = 'ascending';
  private nextGroupSortDirectionOverrides = new Map<string, TabSortDirection>();

  dropMimeTypes = [TabDropMimeType, RecentTabsTreeMimeType];
  dragMimeTypes = [TabDropMimeType];

  getChildren(element?: TreeElement): Array<TreeElement> | null {
    if (element && isFolder(element)) {
      return this.getCurrentFolder(element)?.children ?? null;
    }

    if (element && isSlot(element)) {
      return null;
    }

    const children = this.treeState.getChildren(element);
    if (children === null) {
      return null;
    }

    if (this.viewMode === 'tree') {
      return element && isGroup(element)
        ? createFileTree(element.children, tab => this.getTabPath(tab), element.id)
        : this.createRootTree(children);
    }

    if (this.sortMode && children.length > 0) {
      const groupId = isGroup(children[0]) ? null : children[0].groupId;
      const slottedChildren: Array<TreeElement> = children.slice(0);
      slottedChildren.push({ type: TreeItemType.Slot, index: children.length, groupId });
      return slottedChildren;
    }

    return children;
  }

  getTreeItem(element: TreeElement): vscode.TreeItem {
    if (element.type === TreeItemType.Tab) {
      const newTreeItem = this.createTabTreeItem(element);
      const tabId = element.id;

      newTreeItem.contextValue = element.groupId === null ? 'tab' : 'grouped-tab';

      const resourceUri = newTreeItem.resourceUri;
      const isExternalResource =
        resourceUri !== undefined && vscode.workspace.getWorkspaceFolder(resourceUri) === undefined;

      if (resourceUri) {
        // use to update tab label if duplicated file name showing
        const filePathArray = tabId.split(sep);
        if (filePathArray.length > 1) {
          if (!this.filePathTree[filePathArray[-1]]) {
            this.filePathTree[filePathArray[-1]] = {};
          }
          if (!this.filePathTree[filePathArray[-1]][tabId]) {
            this.filePathTree[filePathArray[-1]][tabId] = { pathList: filePathArray, id: tabId };
          }
        }
      }

      if (!this.treeItemMap[tabId]) {
        this.treeItemMap[tabId] = newTreeItem;
      }

      if (isExternalResource && this.treeItemMap[tabId].tooltip === undefined) {
        this.treeItemMap[tabId].tooltip =
          resourceUri.scheme === 'file' ? resourceUri.fsPath : resourceUri.toString();
      }

      return this.treeItemMap[tabId];
    }

    if (element.type === TreeItemType.Slot) {
      const treeItem = new vscode.TreeItem('');
      treeItem.iconPath = new vscode.ThemeIcon('indent');
      return treeItem;
    }

    if (element.type === TreeItemType.Folder) {
      if (!this.treeItemMap[element.id]) {
        const treeItem = new vscode.TreeItem(
          element.label,
          vscode.TreeItemCollapsibleState.Collapsed,
        );
        treeItem.id = element.id;
        treeItem.contextValue = 'file-folder';
        treeItem.iconPath = new vscode.ThemeIcon('folder');
        this.treeItemMap[element.id] = treeItem;
      } else {
        const treeItem = this.treeItemMap[element.id];
        treeItem.label = element.label;
      }

      return this.treeItemMap[element.id];
    }

    const groupColor = getGroupColorOption(element.colorId);
    if (!this.treeItemMap[element.id]) {
      const treeItem = new vscode.TreeItem(
        element.label,
        element.collapsed
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.Expanded,
      );
      treeItem.contextValue = this.getGroupContextValue(element);
      treeItem.iconPath = new vscode.ThemeIcon(
        'layout-sidebar-left',
        groupColor ? new vscode.ThemeColor(groupColor.themeColorId) : undefined,
      );
      treeItem.description = groupColor?.label;
      this.treeItemMap[element.id] = treeItem;
    } else {
      const treeItem = this.treeItemMap[element.id];
      treeItem.label = element.label;
      treeItem.contextValue = this.getGroupContextValue(element);
      treeItem.iconPath = new vscode.ThemeIcon(
        'layout-sidebar-left',
        groupColor ? new vscode.ThemeColor(groupColor.themeColorId) : undefined,
      );
      treeItem.description = groupColor?.label;
    }

    return this.treeItemMap[element.id];
  }

  getParent(element: TreeElement): TreeElement | undefined {
    if (this.viewMode === 'tree' && (isTab(element) || isFolder(element))) {
      return this.getTreeParent(element);
    }

    return isTab(element) || isGroup(element) ? this.treeState.getParent(element) : undefined;
  }

  private createTabTreeItem(tab: Tab): vscode.TreeItem {
    const nativeTabs = getNativeTabs(tab);

    if (nativeTabs.length === 0) {
      // todo: remove tab without any native Tab
      console.warn('createTabTreeItem: no native tabs for', tab.id);
      return new vscode.TreeItem('');
    }

    const handler = getHandler(nativeTabs[0])!;
    const treeItem = handler.createTreeItem(nativeTabs[0]);

    return treeItem;
  }

  async handleDrag(
    source: Array<TreeElement>,
    treeDataTransfer: vscode.DataTransfer,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    treeDataTransfer.set(
      TabDropMimeType,
      new vscode.DataTransferItem(source.filter(item => isTab(item) || isGroup(item))),
    );
  }

  async handleDrop(
    target: TreeElement | undefined,
    treeDataTransfer: vscode.DataTransfer,
    _token: vscode.CancellationToken,
  ) {
    const draggeds: Array<Group | Tab> = (
      treeDataTransfer.get(TabDropMimeType)?.value ?? []
    ).filter((item: unknown): item is Group | Tab => {
      if (typeof item !== 'object' || item === null || item === target) {
        return false;
      }

      const treeItem = item as TreeElement;
      return isGroup(treeItem) || isTab(treeItem);
    });
    if (draggeds.length === 0) {
      return;
    }

    if (target && isFolder(target)) {
      return;
    }

    if (this.sortMode && this.viewMode === 'list') {
      if (!this.doHandleSorting(target, draggeds)) {
        return;
      }
    } else {
      if (target && isSlot(target)) {
        return; // should not have slot in group mode
      }

      this.doHandleGrouping(target, draggeds.filter<Tab>(isTab));
    }

    this.triggerStateChange();
  }

  private triggerStateChange() {
    this._onDidChangeState.fire();
    this.triggerRerender();
  }

  private doHandleSorting(
    target: Tab | Group | Slot | undefined,
    draggeds: Array<Tab | Group>,
  ): boolean {
    return this.treeState.sort(target, draggeds);
  }

  private doHandleGrouping(target: Tab | Group | undefined, tabs: Tab[]) {
    if (target === undefined) {
      this.treeState.ungroup(tabs, true);
    } else {
      const isCreatingNewGroup = isTab(target) && target.groupId === null && tabs.length > 0;
      this.treeState.group(target, tabs);

      if (isCreatingNewGroup && tabs[0].groupId !== null) {
        const group = this.treeState.getGroup(tabs[0].groupId);
        if (group) {
          vscode.window.showInputBox({ placeHolder: 'Name this Group' }).then(input => {
            if (input) {
              this.treeState.renameGroup(group, input);
              this.triggerStateChange();
            }
          });
        }
      }
    }
  }

  public triggerRerender() {
    this.treeItemMap = {}; // Clear cache to force recreation of TreeItems with updated decorations
    this._onDidChangeTreeData.fire();
    this.refreshFilePathTree();
  }

  public setState(state: Array<Tab | Group>) {
    this.treeState.setState(state);
    this.triggerStateChange();
  }

  public async activate(tab: Tab): Promise<any> {
    const nativeTabs = getNativeTabs(tab);
    const nativeTab = nativeTabs.find(candidate => candidate.isActive) ?? nativeTabs[0];
    if (!nativeTab || nativeTab.isActive) {
      return;
    }

    const handler = getHandler(nativeTab);
    if (handler) {
      return handler.openEditor(nativeTab);
    }
  }

  public appendTabs(nativeTabs: readonly vscode.Tab[]): boolean {
    let changed = false;
    nativeTabs.forEach(nativeTab => {
      try {
        const tabId = getNormalizedTabId(nativeTab);
        if (!this.treeState.getTab(tabId)) {
          this.treeState.appendTab(tabId);
          changed = true;
        }
      } catch {
        // skip
      }
    });
    return changed;
  }

  public closeTabs(nativeTabs: readonly vscode.Tab[]): boolean {
    let changed = false;
    nativeTabs.forEach(nativeTab => {
      try {
        const tabId = getNormalizedTabId(nativeTab);
        const tab = this.treeState.getTab(tabId);
        if (tab && getNativeTabs(tab).length === 0) {
          this.treeState.deleteTab(tabId);
          changed = true;
        }
      } catch {
        // skip
      }
    });
    return changed;
  }

  public getTab(nativeTab: vscode.Tab): Tab | undefined {
    try {
      const tabId = getNormalizedTabId(nativeTab);
      return this.treeState.getTab(tabId);
    } catch {
      return undefined;
    }
  }

  public getGroup(groupId: string | null): Group | undefined {
    return groupId === null ? undefined : this.treeState.getGroup(groupId);
  }

  public getState(): Array<Tab | Group> {
    return this.treeState.getState();
  }

  public ungroup(tab: Tab) {
    this.treeState.ungroup([tab]);
    this.triggerStateChange();
  }

  public renameGroup(group: Group, input: string): void {
    this.treeState.renameGroup(group, input);
    this.triggerStateChange();
  }

  public setGroupColor(group: Group, colorId: GroupColorId): void {
    this.treeState.setGroupColor(group.id, colorId);
    this.triggerStateChange();
  }

  public cancelGroup(group: Group): void {
    this.treeState.cancelGroup(group);
    this.triggerStateChange();
  }

  public restoreGroup(
    tabs: Tab[],
    group: Pick<Group, 'colorId' | 'label' | 'collapsed'>,
    sourceGroupId?: string,
  ): Group | undefined {
    const restoredGroup = this.treeState.restoreGroup(tabs, group, sourceGroupId);
    if (restoredGroup) {
      this.triggerStateChange();
    }
    return restoredGroup;
  }

  public sortTabs(direction: TabSortDirection, group?: Group): boolean {
    const directionChanged = this.setNextGroupSortDirection(direction, group);
    const tabs = group
      ? this.treeState.getGroup(group.id)?.children
      : this.getLeafNodes(this.treeState.getState());
    if (!tabs) {
      if (directionChanged) {
        this.triggerRerender();
      }
      return false;
    }

    const sortKeys = this.getTabSortKeys(tabs);
    const changed = sortKeys
      ? group
        ? this.treeState.sortTabs(
            (leftTab, rightTab) =>
              compareTabSortKeys(sortKeys.get(leftTab.id)!, sortKeys.get(rightTab.id)!, direction),
            group.id,
          )
        : this.treeState.sortAllTabs((leftTab, rightTab) =>
            compareTabSortKeys(sortKeys.get(leftTab.id)!, sortKeys.get(rightTab.id)!, direction),
          )
      : false;
    const groupsChanged =
      !group &&
      this.treeState.sortGroups((leftGroup, rightGroup) =>
        compareSortStrings(
          this.getGroupSortLabel(leftGroup),
          this.getGroupSortLabel(rightGroup),
          direction,
        ),
      );
    if (changed || groupsChanged) {
      this.triggerStateChange();
    } else if (directionChanged) {
      this.triggerRerender();
    }
    return changed || groupsChanged;
  }

  public toggleSortMode(sortMode: boolean) {
    if (sortMode && this.viewMode === 'tree') {
      return;
    }

    this.sortMode = sortMode;
    this.triggerRerender();
  }

  public setViewMode(viewMode: ViewMode) {
    if (this.viewMode === viewMode) {
      return;
    }

    this.viewMode = viewMode;
    if (viewMode === 'tree') {
      this.sortMode = false;
    }
    this.triggerRerender();
  }

  public getViewMode(): ViewMode {
    return this.viewMode;
  }

  public isSortMode(): boolean {
    return this.sortMode;
  }

  public isAllCollapsed(): boolean {
    return this.treeState.isAllCollapsed();
  }

  public setCollapsedState(group: Group, collapsed: boolean) {
    this.treeState.setCollapsedState(group, collapsed);
    // sync data from tree view, so rerendering is not needed
  }

  public getExpandableItems(): Array<Group | Folder> {
    const expandableItems: Array<Group | Folder> = [];

    const collect = (items: readonly TreeElement[]) => {
      items.forEach(item => {
        if (isGroup(item)) {
          if (item.children.length > 0) {
            expandableItems.push(item);
            collect(this.getChildren(item) ?? []);
          }
        } else if (isFolder(item) && item.children.length > 0) {
          expandableItems.push(item);
          collect(item.children);
        }
      });
    };

    collect(this.getChildren() ?? []);
    return expandableItems;
  }

  private refreshFilePathTree() {
    this.filePathTree = {};
    this.getLeafNodes(this.treeState.getState()).forEach((leafNode: Tab) => {
      const tabId = leafNode.id;
      const nativeTabs = getNativeTabs(leafNode);
      if (nativeTabs.length === 0) {
        return;
      }

      const leafItem = this.getTreeItem(leafNode);
      if (nativeTabs[0].input instanceof vscode.TabInputText && leafItem.resourceUri) {
        // use to update tab label if duplicated file name showing
        const filePathArray = leafItem.resourceUri.fsPath.split(sep);
        if (filePathArray.length > 1) {
          const fileName = filePathArray[filePathArray.length - 1];
          if (!this.filePathTree[fileName]) {
            this.filePathTree[fileName] = {};
          }
          if (!this.filePathTree[fileName][tabId]) {
            this.filePathTree[fileName][tabId] = {
              pathList: filePathArray,
              id: tabId,
            } as FilePathNode;
            this.onChangeFilePathTree(fileName);
          }
        }
      }
    });
  }

  private createRootTree(children: Array<Tab | Group>): Array<TreeElement> {
    const fileTree = createFileTree(children.filter(isTab), tab => this.getTabPath(tab), null);
    const treeItems = [...children.filter(isGroup), ...fileTree].map(item => ({
      item,
      index: children.indexOf(isGroup(item) ? item : this.getFirstTab(item)),
    }));

    return treeItems.sort((left, right) => left.index - right.index).map(({ item }) => item);
  }

  private getFirstTab(item: FileTreeItem): Tab {
    return isTab(item) ? item : this.getFirstTab(item.children[0]);
  }

  private getTreeParent(element: Tab | Folder): Group | Folder | undefined {
    const group = element.groupId === null ? undefined : this.treeState.getGroup(element.groupId);
    const fileTree = this.getFileTree(element.groupId);
    return this.findFileTreeParent(fileTree, element) ?? group;
  }

  private getCurrentFolder(folder: Folder): Folder | undefined {
    return this.findFileTreeFolder(this.getFileTree(folder.groupId), folder.id);
  }

  private getFileTree(groupId: string | null): FileTreeItem[] {
    if (groupId === null) {
      return createFileTree(
        (this.treeState.getChildren() ?? []).filter(isTab),
        tab => this.getTabPath(tab),
        null,
      );
    }

    const group = this.treeState.getGroup(groupId);
    return group ? createFileTree(group.children, tab => this.getTabPath(tab), group.id) : [];
  }

  private findFileTreeFolder(items: readonly FileTreeItem[], folderId: string): Folder | undefined {
    for (const item of items) {
      if (!isFolder(item)) {
        continue;
      }

      if (item.id === folderId) {
        return item;
      }

      const folder = this.findFileTreeFolder(item.children, folderId);
      if (folder) {
        return folder;
      }
    }

    return undefined;
  }

  private findFileTreeParent(
    items: readonly FileTreeItem[],
    target: Tab | Folder,
  ): Folder | undefined {
    for (const item of items) {
      if (!isFolder(item)) {
        continue;
      }

      if (item.children.some(child => child.id === target.id)) {
        return item;
      }

      const parent = this.findFileTreeParent(item.children, target);
      if (parent) {
        return parent;
      }
    }

    return undefined;
  }

  private getTabPath(tab: Tab): readonly string[] | undefined {
    const resourceUri = this.createTabTreeItem(tab).resourceUri;
    if (!resourceUri || !vscode.workspace.getWorkspaceFolder(resourceUri)) {
      return undefined;
    }

    return vscode.workspace
      .asRelativePath(resourceUri, false)
      .split(/[\\/]/)
      .filter(segment => segment.length > 0);
  }

  private getTabSortKeys(tabs: readonly Tab[]): Map<string, TabSortKey> | undefined {
    const sortKeys = new Map<string, TabSortKey>();
    for (const tab of tabs) {
      const nativeTab = getNativeTabs(tab)[0];
      const handler = nativeTab && getHandler(nativeTab);
      if (!handler) {
        return undefined;
      }
      sortKeys.set(tab.id, handler.getSortKey(nativeTab));
    }
    return sortKeys;
  }

  private getGroupSortLabel(group: Group): string {
    return group.label.trim() || getGroupColorOption(group.colorId)?.label || '';
  }

  private getGroupContextValue(group: Group): string {
    return `group-sort-${this.getNextGroupSortDirection(group.id)}`;
  }

  private getNextGroupSortDirection(groupId: string): TabSortDirection {
    return this.nextGroupSortDirectionOverrides.get(groupId) ?? this.defaultNextGroupSortDirection;
  }

  private setNextGroupSortDirection(direction: TabSortDirection, group?: Group): boolean {
    const nextDirection: TabSortDirection = direction === 'ascending' ? 'descending' : 'ascending';
    if (!group) {
      const changed =
        this.defaultNextGroupSortDirection !== nextDirection ||
        this.nextGroupSortDirectionOverrides.size > 0;
      this.defaultNextGroupSortDirection = nextDirection;
      this.nextGroupSortDirectionOverrides.clear();
      return changed;
    }

    if (this.getNextGroupSortDirection(group.id) === nextDirection) {
      return false;
    }

    if (nextDirection === this.defaultNextGroupSortDirection) {
      this.nextGroupSortDirectionOverrides.delete(group.id);
    } else {
      this.nextGroupSortDirectionOverrides.set(group.id, nextDirection);
    }
    return true;
  }

  private getLeafNodes(root: Array<Tab | Group>): Array<Tab> {
    const leafNodes: Array<Tab> = [];
    root.forEach((item: Tab | Group) => {
      if (isTab(item)) {
        leafNodes.push(item);
      } else {
        leafNodes.push(...this.getLeafNodes(item.children));
      }
    });
    return leafNodes;
  }

  private onChangeFilePathTree(fileName: string) {
    const distinceNodeCount = Object.keys(this.filePathTree[fileName]).length;
    if (distinceNodeCount > 1) {
      const commonAncestorDirIndex = findLongestCommonFilePathPrefixIndex(
        Object.values(this.filePathTree[fileName]).map(node => node.pathList) as Array<
          Array<string>
        >,
      );
      // map back to treeItemMap to change the description
      Object.values(this.filePathTree[fileName]).forEach((node: FilePathNode) => {
        this.updateTreeItemDescription(
          node.id,
          node.pathList.slice(commonAncestorDirIndex + 1, -1),
        );
      });
    } else if (distinceNodeCount === 1) {
      const node = Object.values(this.filePathTree[fileName])[0];
      this.updateTreeItemDescription(node.id);
    }
  }

  private updateTreeItemDescription(tabId: string, pathSequence?: Array<string>) {
    if (this.treeItemMap[tabId]) {
      this.treeItemMap[tabId].description = pathSequence?.length
        ? join(...pathSequence)
        : undefined;
    }
  }
}
