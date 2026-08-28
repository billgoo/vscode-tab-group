import { Tab } from '../models/types';
import { sortItems } from '../utils/Arrays';

export class RecentTabs {
  private tabIds: string[] = [];

  constructor(tabIds: readonly string[] = []) {
    this.setState(tabIds);
  }

  public setState(tabIds: readonly string[]): void {
    this.tabIds = [...new Set(tabIds)];
  }

  public getState(): string[] {
    return this.tabIds.slice();
  }

  public touch(tabId: string): boolean {
    if (this.tabIds[0] === tabId) {
      return false;
    }

    this.tabIds = [tabId, ...this.tabIds.filter(existingTabId => existingTabId !== tabId)];
    return true;
  }

  public reconcile(tabIds: readonly string[]): boolean {
    const validTabIds = new Set(tabIds);
    const reconciledTabIds = this.tabIds.filter(tabId => validTabIds.has(tabId));
    const knownTabIds = new Set(reconciledTabIds);

    tabIds.forEach(tabId => {
      if (!knownTabIds.has(tabId)) {
        reconciledTabIds.push(tabId);
        knownTabIds.add(tabId);
      }
    });

    const changed =
      reconciledTabIds.length !== this.tabIds.length ||
      reconciledTabIds.some((tabId, index) => tabId !== this.tabIds[index]);
    this.tabIds = reconciledTabIds;
    return changed;
  }

  public sort(tabs: readonly Tab[]): Tab[] {
    const tabIndex = new Map(this.tabIds.map((tabId, index) => [tabId, index]));
    return sortItems(tabs, (leftTab, rightTab) => {
      const leftIndex = tabIndex.get(leftTab.id) ?? this.tabIds.length;
      const rightIndex = tabIndex.get(rightTab.id) ?? this.tabIds.length;
      return leftIndex - rightIndex;
    });
  }
}
