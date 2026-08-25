import * as vscode from 'vscode';
import { Tab, isTab } from '../models/types';
import { RecentTabs } from '../services/RecentTabs';
import { Disposable } from '../utils/disposable';
import { TabDropMimeType, TreeDataProvider } from './TreeDataProvider';

export class RecentTabsTreeDataProvider
  extends Disposable
  implements vscode.TreeDataProvider<Tab>, vscode.TreeDragAndDropController<Tab>
{
  private readonly _onDidChangeTreeData = this._register(new vscode.EventEmitter<void>());
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  readonly dropMimeTypes: string[] = [];
  readonly dragMimeTypes = [TabDropMimeType];

  constructor(
    private readonly treeDataProvider: TreeDataProvider,
    private readonly recentTabs: RecentTabs,
  ) {
    super();
  }

  getChildren(element?: Tab): Tab[] {
    if (element) {
      return [];
    }

    const ungroupedTabs = this.treeDataProvider
      .getState()
      .filter((item): item is Tab => isTab(item) && item.groupId === null);
    return this.recentTabs.sort(ungroupedTabs);
  }

  getTreeItem(tab: Tab): vscode.TreeItem {
    return this.treeDataProvider.getTreeItem(tab);
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  async handleDrag(
    source: Tab[],
    treeDataTransfer: vscode.DataTransfer,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    treeDataTransfer.set(TabDropMimeType, new vscode.DataTransferItem(source));
  }
}
