import { describe, expect, test } from '@jest/globals';
import { Tab, TreeItemType } from '../models/types';
import { RecentTabs } from '../services/RecentTabs';

function createTab(id: string): Tab {
  return {
    type: TreeItemType.Tab,
    groupId: null,
    id,
  };
}

describe('RecentTabs', () => {
  test('moves a viewed tab to the front once', () => {
    const recentTabs = new RecentTabs(['first', 'second']);

    expect(recentTabs.touch('second')).toBe(true);
    expect(recentTabs.touch('second')).toBe(false);
    expect(recentTabs.getState()).toEqual(['second', 'first']);
  });

  test('removes closed tabs and appends newly discovered tabs', () => {
    const recentTabs = new RecentTabs(['first', 'closed']);

    expect(recentTabs.reconcile(['first', 'new'])).toBe(true);
    expect(recentTabs.getState()).toEqual(['first', 'new']);
  });

  test('sorts tabs by recency and keeps unknown tabs last', () => {
    const recentTabs = new RecentTabs(['second', 'first']);

    expect(recentTabs.sort([createTab('new'), createTab('first'), createTab('second')])).toEqual([
      createTab('second'),
      createTab('first'),
      createTab('new'),
    ]);
  });
});
