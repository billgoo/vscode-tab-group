export type TreePanelRevealOptions = {
  readonly expand?: boolean | number;
  readonly focus?: boolean;
  readonly select?: boolean;
};

export type TreePanelView<T> = {
  reveal(element: T, options?: TreePanelRevealOptions): PromiseLike<void>;
};

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

export async function expandAllTreeItems<TElement, TItem extends TElement>(
  treeView: TreePanelView<TElement>,
  items: readonly TItem[],
  isExpandable: (item: TItem) => boolean,
  options: TreePanelRevealOptions = {},
  didExpand?: (item: TItem) => void,
): Promise<void> {
  await Promise.all(
    items.filter(isExpandable).map(async item => {
      await treeView.reveal(item, { ...options, expand: true });
      didExpand?.(item);
    }),
  );
}

export async function collapseAllTreeItems<TElement, TItem extends TElement>(
  treeView: TreePanelView<TElement>,
  collapseAll: () => PromiseLike<unknown>,
  focusItem?: TItem,
): Promise<void> {
  if (focusItem) {
    await treeView.reveal(focusItem, { focus: true, select: false });
  }

  await collapseAll();
}
