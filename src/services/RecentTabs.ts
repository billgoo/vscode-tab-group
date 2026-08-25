import { Tab } from '../models/types';

export class RecentTabs {
  private tabIds: string[] = [];

  constructor(tabIds: readonly string[] = []) {
    this.setState(tabIds);
  }

  public setState(tabIds: readonly string[]): void {
    this.tabIds = [];
    tabIds.forEach(tabId => {
      if (!this.tabIds.includes(tabId)) {
        this.tabIds.push(tabId);
      }
    });
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

    tabIds.forEach(tabId => {
      if (!reconciledTabIds.includes(tabId)) {
        reconciledTabIds.push(tabId);
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
    return tabs.slice().sort((leftTab, rightTab) => {
      const leftIndex = tabIndex.get(leftTab.id) ?? this.tabIds.length;
      const rightIndex = tabIndex.get(rightTab.id) ?? this.tabIds.length;
      return leftIndex - rightIndex;
    });
  }
}
