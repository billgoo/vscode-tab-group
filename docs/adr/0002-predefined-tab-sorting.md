# ADR-0002: Toggle Tab Sorting by Resource URI

- **Status:** Accepted
- **Date:** 2026-08-27
- **Related issue:** [#22 - Pre-defined sorting options](https://github.com/billgoo/vscode-tab-group/issues/22)

## Context

Manual Sort Mode supports custom drag-and-drop ordering, but it is inefficient for the common task of ordering tabs consistently. Users chose resource URI order over filename-only and path-only alternatives, and asked for a single click instead of a direction picker.

The extension owns the order in its Tabs tree. VS Code owns the native editor-tab strip, so the feature must not try to reorder native tabs.

## Decision

Add an alternating sort action at the root and on each group:

- The ascending action starts with resource URI order A-Z.
- After sorting, it changes to the descending action for resource URI order Z-A.
- Each control switches to the opposite direction shown for its next click.

The Tabs view title action sorts root tabs and every group's children by URI, and root groups by name. Each group has its own inline action that sorts only that group's tabs by URI. Group controls track their next direction independently and do not change the root control. A root sort resets every group control to the root action's next direction. Sorting is explicit: activation and tree refreshes do not apply a remembered sort, and newly opened tabs retain the existing append behavior. Sorting affects only the extension tree:

- Root tabs sort among their existing root-tab positions, and groups sort among their existing group positions.
- A group action sorts only that group's children.
- Group membership is preserved.
- No sort preference is persisted. The sorted tree order is persisted, but direction indicators start in their ascending state after activation or reload.

Each supported tab handler provides a sort key from the full resource URI. Text, custom, and notebook editors use their resource URI, while text and notebook diffs use their modified resource URI. URI comparisons are case-insensitive. URI ties, including ties caused by case-insensitive comparison, use the normalized tab ID as a deterministic tie-breaker, with the selected direction applied to both comparisons.

## Consequences

### Positive

- Common URI ordering is one click instead of a picker or a sequence of drag operations.
- Manual Sort Mode remains available for custom ordering.
- The existing persisted tree order records the selected result without a schema change.
- Root and group sorting have explicit, predictable scopes.
- Dynamic group contexts keep each inline direction icon independent without creating a global context key per group.

### Trade-offs

- A root preset reorders groups by name, so it can replace a manually arranged group order.
- The native VS Code editor-tab order is unchanged.
- A root sort intentionally resets group direction indicators.

## Alternatives Considered

### Use a direction picker

Rejected. An alternating arrow is faster to use and avoids an extra interaction for two directions.

### Persist an automatic sort preference

Rejected. It would continually reorder newly opened tabs and conflict with users' manual ordering choices.

### Reorder native VS Code editor tabs

Rejected. The extension does not own that UI order through a suitable public API.

## Implementation Notes

- [src/utils/tabSort.ts](../../src/utils/tabSort.ts) defines URI sort directions and deterministic comparison.
- [src/providers/TabTypeHandler.ts](../../src/providers/TabTypeHandler.ts) supplies resource-based sort keys.
- [src/services/TreeState.ts](../../src/services/TreeState.ts) sorts within existing tree containers.
- [src/providers/TreeDataProvider.ts](../../src/providers/TreeDataProvider.ts) applies sorting and tracks the next direction for each group control.
- [src/providers/TreeView.ts](../../src/providers/TreeView.ts) tracks the root control's next direction.

See [testing.md](../testing.md) for automated and manual acceptance coverage.
