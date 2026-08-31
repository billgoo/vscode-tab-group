import * as vscode from 'vscode';
import { SavedGroup, SavedTab } from '../models/SavedGroup';
import { SavedGroupsStore } from '../services/SavedGroupsStore';
import { Disposable } from '../utils/disposable';
import { getFilePathDescription } from '../utils/fileTree';
import { getSavedTabLabel, getSavedTabPath, getSavedTabUri } from '../utils/savedTab';

type SavedTabTreeItem = {
  readonly savedGroup: SavedGroup;
  readonly savedTab: SavedTab;
};

type SavedGroupsTreeItem = SavedGroup | SavedTabTreeItem;

function isSavedTabTreeItem(item: SavedGroupsTreeItem): item is SavedTabTreeItem {
  return 'savedTab' in item;
}

export class SavedGroupsTreeDataProvider
  extends Disposable
  implements vscode.TreeDataProvider<SavedGroupsTreeItem>
{
  private readonly onDidChangeTreeDataEmitter = this._register(new vscode.EventEmitter<void>());
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  constructor(private readonly savedGroupsStore: SavedGroupsStore) {
    super();
  }

  getChildren(element?: SavedGroupsTreeItem): SavedGroupsTreeItem[] {
    if (!element) {
      return [...(this.savedGroupsStore.load() ?? [])];
    }

    return isSavedTabTreeItem(element)
      ? []
      : element.tabs.map(savedTab => ({ savedGroup: element, savedTab }));
  }

  getParent(element: SavedGroupsTreeItem): SavedGroupsTreeItem | undefined {
    return isSavedTabTreeItem(element) ? element.savedGroup : undefined;
  }

  getTreeItem(element: SavedGroupsTreeItem): vscode.TreeItem {
    if (isSavedTabTreeItem(element)) {
      return this.createSavedTabTreeItem(element.savedGroup, element.savedTab);
    }

    const savedGroup = element;
    const treeItem = new vscode.TreeItem(savedGroup.name);
    const tabCount = savedGroup.tabs.length;
    treeItem.id = `saved-group:${savedGroup.id}`;
    treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
    treeItem.contextValue = 'saved-group';
    treeItem.description = `${tabCount} tab${tabCount === 1 ? '' : 's'}`;
    treeItem.iconPath = new vscode.ThemeIcon('bookmark');
    return treeItem;
  }

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }

  private createSavedTabTreeItem(savedGroup: SavedGroup, savedTab: SavedTab): vscode.TreeItem {
    const resourceUri = vscode.Uri.parse(getSavedTabUri(savedTab));
    const label = getSavedTabLabel(savedTab);
    const treeItem = new vscode.TreeItem(label);
    treeItem.id = `saved-tab:${savedGroup.id}:${savedTab.id}`;
    treeItem.contextValue = 'saved-tab';
    treeItem.description = this.getSavedTabDescription(savedGroup, savedTab, label);
    treeItem.resourceUri = resourceUri;
    treeItem.tooltip = resourceUri.toString();
    return treeItem;
  }

  private getSavedTabDescription(
    savedGroup: SavedGroup,
    savedTab: SavedTab,
    label: string,
  ): string | undefined {
    const matchingTabs = savedGroup.tabs.filter(tab => getSavedTabLabel(tab) === label);
    return getFilePathDescription(
      getSavedTabPath(savedTab).split('/'),
      matchingTabs.map(tab => getSavedTabPath(tab).split('/')),
    );
  }
}
