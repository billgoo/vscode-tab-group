export type TreePanelRevealOptions = {
  readonly expand?: boolean | number;
  readonly focus?: boolean;
  readonly select?: boolean;
};

export type TreePanelView<T> = {
  reveal(element: T, options?: TreePanelRevealOptions): PromiseLike<void>;
};

export async function focusTreeItem<T>(treeView: TreePanelView<T>, item: T): Promise<void> {
  await treeView.reveal(item, { focus: true, select: false });
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
    await focusTreeItem(treeView, focusItem);
  }

  await collapseAll();
}
