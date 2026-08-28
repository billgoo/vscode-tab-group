export function safeRemove<U, T extends U>(array: U[], item: T): void {
  const index = array.indexOf(item);
  if (index === -1) {
    return;
  }
  array.splice(index, 1);
}

export function sortItems<T>(items: readonly T[], compare: (left: T, right: T) => number): T[] {
  return items.slice().sort(compare);
}

export function sortItemsInPlace<T>(items: T[], compare: (left: T, right: T) => number): boolean {
  const sortedItems = sortItems(items, compare);
  if (sortedItems.every((item, index) => item === items[index])) {
    return false;
  }

  items.splice(0, items.length, ...sortedItems);
  return true;
}
