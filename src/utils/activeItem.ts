export type ActiveItem = {
  readonly isActive: boolean;
};

export function findActiveItem<T extends ActiveItem>(items: readonly T[]): T | undefined {
  return items.find(item => item.isActive);
}
