import * as vscode from 'vscode';
import { Group, Tab, TreeItemType, ViewMode } from '../models/types';
import { SerialTaskQueue } from '../utils/async';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isViewMode(value: unknown): value is ViewMode {
  return value === 'list' || value === 'tree';
}

function isTabValue(value: unknown): value is Tab {
  return (
    isRecord(value) &&
    value.type === TreeItemType.Tab &&
    isValidId(value.id) &&
    (value.groupId === null || isValidId(value.groupId))
  );
}

function isGroupValue(value: unknown): value is Group {
  return (
    isRecord(value) &&
    value.type === TreeItemType.Group &&
    isValidId(value.id) &&
    typeof value.colorId === 'string' &&
    typeof value.label === 'string' &&
    typeof value.collapsed === 'boolean' &&
    Array.isArray(value.children) &&
    value.children.every(isTabValue)
  );
}

function isValidState(value: unknown): value is Array<Tab | Group> {
  if (!Array.isArray(value)) {
    return false;
  }

  const ids = new Set<string>();
  for (const item of value) {
    if (isTabValue(item)) {
      if (item.groupId !== null || ids.has(item.id)) {
        return false;
      }
      ids.add(item.id);
      continue;
    }

    if (!isGroupValue(item) || ids.has(item.id)) {
      return false;
    }

    ids.add(item.id);
    for (const child of item.children) {
      if (child.groupId !== item.id || ids.has(child.id)) {
        return false;
      }
      ids.add(child.id);
    }
  }

  return true;
}

export class WorkspaceStateStore {
  private static readonly stateKey = 'tabs.workspace.state.key';
  private static readonly recentTabsStateKey = 'tabs.workspace.recent-tabs.key';
  private static readonly viewModeStateKey = 'tabs.workspace.view-mode.key';

  constructor(
    private readonly workspaceState: vscode.Memento,
    private readonly writeQueue = new SerialTaskQueue(),
  ) {}

  load(): Array<Tab | Group> | undefined {
    const value = this.workspaceState.get<unknown>(WorkspaceStateStore.stateKey);
    return isValidState(value) ? value : undefined;
  }

  save(state: Array<Tab | Group>): Promise<void> {
    return this.writeQueue.run(() =>
      this.workspaceState.update(WorkspaceStateStore.stateKey, state),
    );
  }

  loadRecentTabs(): string[] | undefined {
    const value = this.workspaceState.get<unknown>(WorkspaceStateStore.recentTabsStateKey);
    if (!Array.isArray(value)) {
      return undefined;
    }

    return value.filter((tabId): tabId is string => typeof tabId === 'string');
  }

  saveRecentTabs(tabIds: readonly string[]): Promise<void> {
    return this.writeQueue.run(() =>
      this.workspaceState.update(WorkspaceStateStore.recentTabsStateKey, [...tabIds]),
    );
  }

  loadViewMode(): ViewMode | undefined {
    const value = this.workspaceState.get<unknown>(WorkspaceStateStore.viewModeStateKey);
    return isViewMode(value) ? value : undefined;
  }

  saveViewMode(viewMode: ViewMode): Promise<void> {
    return this.writeQueue.run(() =>
      this.workspaceState.update(WorkspaceStateStore.viewModeStateKey, viewMode),
    );
  }
}
