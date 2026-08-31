import { isTab, Tab, TreeElement } from '../models/types';

export type ActiveItem = {
  readonly isActive: boolean;
};

export function findActiveItem<T extends ActiveItem>(items: readonly T[]): T | undefined {
  return items.find(item => item.isActive);
}

export function getSelectedTab(selection: readonly TreeElement[]): Tab | undefined {
  const item = selection[selection.length - 1];
  return item && isTab(item) ? item : undefined;
}
