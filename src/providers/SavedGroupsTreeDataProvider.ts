import * as vscode from 'vscode';
import { SavedGroup, SavedTab } from '../models/SavedGroup';
import { SavedGroupsStore } from '../services/SavedGroupsStore';
import { Disposable } from '../utils/disposable';
import { getFilePathDescription } from '../utils/filePath';

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

  getTreeItem(element: SavedGroupsTreeItem): vscode.TreeItem {
    if (isSavedTabTreeItem(element)) {
      return this.createSavedTabTreeItem(element.savedGroup, element.savedTab);
    }

    const savedGroup = element;
    const treeItem = new vscode.TreeItem(savedGroup.name);
    const tabCount = savedGroup.tabs.length;
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
    const resourceUri = vscode.Uri.parse(this.getSavedTabUri(savedTab));
    const label = this.getSavedTabLabel(savedTab);
    const treeItem = new vscode.TreeItem(label);
    treeItem.contextValue = 'saved-tab';
    treeItem.description = this.getSavedTabDescription(savedGroup, savedTab, label);
    treeItem.resourceUri = resourceUri;
    treeItem.tooltip = resourceUri.toString();
    return treeItem;
  }

  private getSavedTabUri(savedTab: SavedTab): string {
    return 'uri' in savedTab ? savedTab.uri : savedTab.modifiedUri;
  }

  private getSavedTabLabel(savedTab: SavedTab): string {
    if ('label' in savedTab && savedTab.label) {
      return savedTab.label;
    }

    const path = vscode.Uri.parse(this.getSavedTabUri(savedTab)).path;
    return path.substring(path.lastIndexOf('/') + 1) || path;
  }

  private getSavedTabDescription(
    savedGroup: SavedGroup,
    savedTab: SavedTab,
    label: string,
  ): string | undefined {
    const matchingTabs = savedGroup.tabs.filter(tab => this.getSavedTabLabel(tab) === label);
    return getFilePathDescription(
      vscode.Uri.parse(this.getSavedTabUri(savedTab)).path.split('/'),
      matchingTabs.map(tab => vscode.Uri.parse(this.getSavedTabUri(tab)).path.split('/')),
    );
  }
}
