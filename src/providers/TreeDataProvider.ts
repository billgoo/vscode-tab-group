import * as vscode from 'vscode';
import { join, sep } from 'node:path';

import { Disposable } from '../utils/disposable';
import {
  FilePathNode,
  Group,
  isGroup,
  isSlot,
  isTab,
  Slot,
  Tab,
  TreeItemType,
} from '../models/types';
import { TreeState } from '../services/TreeState';
import { getHandler, getNormalizedTabId } from './TabTypeHandler';
import { GroupColorId, getGroupColorOption } from '../utils/color';
import { findLongestCommonFilePathPrefixIndex } from '../utils/filePath';

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
  implements
    vscode.TreeDataProvider<Tab | Group | Slot>,
    vscode.TreeDragAndDropController<Tab | Group | Slot>
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

  dropMimeTypes = [TabDropMimeType, RecentTabsTreeMimeType];
  dragMimeTypes = [TabDropMimeType];

  getChildren(element?: Tab | Group): Array<Tab | Group | Slot> | null {
    const children = this.treeState.getChildren(element);

    if (this.sortMode && Array.isArray(children) && children.length > 0) {
      const groupId = isGroup(children[0]) ? null : children[0].groupId;
      const slottedChildren: Array<Tab | Group | Slot> = children.slice(0);
      slottedChildren.push({ type: TreeItemType.Slot, index: children.length, groupId });
      return slottedChildren;
    }

    return children;
  }

  getTreeItem(element: Tab | Group | Slot): vscode.TreeItem {
    if (element.type === TreeItemType.Tab) {
      const newTreeItem = this.createTabTreeItem(element);
      const tabId = element.id;

      newTreeItem.contextValue = element.groupId === null ? 'tab' : 'grouped-tab';

      if (newTreeItem.resourceUri) {
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

      return this.treeItemMap[tabId];
    }

    if (element.type === TreeItemType.Slot) {
      const treeItem = new vscode.TreeItem('');
      treeItem.iconPath = new vscode.ThemeIcon('indent');
      return treeItem;
    }

    const groupColor = getGroupColorOption(element.colorId);
    if (!this.treeItemMap[element.id]) {
      const treeItem = new vscode.TreeItem(
        element.label,
        element.collapsed
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.Expanded,
      );
      treeItem.contextValue = 'group';
      treeItem.iconPath = new vscode.ThemeIcon(
        'layout-sidebar-left',
        groupColor ? new vscode.ThemeColor(groupColor.themeColorId) : undefined,
      );
      treeItem.description = groupColor?.label;
      this.treeItemMap[element.id] = treeItem;
    } else {
      const treeItem = this.treeItemMap[element.id];
      treeItem.label = element.label;
      treeItem.iconPath = new vscode.ThemeIcon(
        'layout-sidebar-left',
        groupColor ? new vscode.ThemeColor(groupColor.themeColorId) : undefined,
      );
      treeItem.description = groupColor?.label;
    }

    return this.treeItemMap[element.id];
  }

  getParent(element: Tab | Group) {
    return this.treeState.getParent(element);
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
    source: Array<Tab | Group | Slot>,
    treeDataTransfer: vscode.DataTransfer,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    treeDataTransfer.set(
      TabDropMimeType,
      new vscode.DataTransferItem(source.filter(item => !isSlot(item))),
    );
  }

  async handleDrop(
    target: Tab | Group | Slot | undefined,
    treeDataTransfer: vscode.DataTransfer,
    _token: vscode.CancellationToken,
  ) {
    const draggeds: Array<Group | Tab> = (
      treeDataTransfer.get(TabDropMimeType)?.value ?? []
    ).filter((tab: any) => tab !== target);
    if (draggeds.length === 0) {
      return;
    }

    if (this.sortMode) {
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

  public toggleSortMode(sortMode: boolean) {
    this.sortMode = sortMode;
    this.triggerRerender();
  }

  public isAllCollapsed(): boolean {
    return this.treeState.isAllCollapsed();
  }

  public setCollapsedState(group: Group, collapsed: boolean) {
    this.treeState.setCollapsedState(group, collapsed);
    // sync data from tree view, so rerendering is not needed
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
