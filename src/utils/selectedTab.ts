import { isTab, Tab, TreeElement } from '../models/types';

export function getSelectedTab(selection: readonly TreeElement[]): Tab | undefined {
  const item = selection[selection.length - 1];
  return item && isTab(item) ? item : undefined;
}
