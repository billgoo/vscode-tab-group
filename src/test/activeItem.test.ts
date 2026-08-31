import { describe, expect, test } from '@jest/globals';
import { findActiveItem } from '../utils/activeItem';

type Item = {
  readonly id: string;
  readonly isActive: boolean;
};

describe('active item utility', () => {
  test('finds the active item when an inactive item appears first', () => {
    const inactiveItem: Item = { id: 'inactive', isActive: false };
    const activeItem: Item = { id: 'active', isActive: true };

    expect(findActiveItem([inactiveItem, activeItem])).toBe(activeItem);
  });

  test('returns undefined when no item is active', () => {
    expect(findActiveItem<Item>([{ id: 'inactive', isActive: false }])).toBeUndefined();
  });
});
