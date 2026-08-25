import * as vscode from 'vscode';
import { Group, Tab } from '../models/types';

export class WorkspaceStateStore {
  private static readonly stateKey = 'tabs.workspace.state.key';
  private static readonly recentTabsStateKey = 'tabs.workspace.recent-tabs.key';

  constructor(private readonly workspaceState: vscode.Memento) {}

  load(): Array<Tab | Group> | undefined {
    return this.workspaceState.get<Array<Tab | Group>>(WorkspaceStateStore.stateKey);
  }

  save(state: Array<Tab | Group>): Thenable<void> {
    return this.workspaceState.update(WorkspaceStateStore.stateKey, state);
  }

  loadRecentTabs(): string[] | undefined {
    return this.workspaceState.get<string[]>(WorkspaceStateStore.recentTabsStateKey);
  }

  saveRecentTabs(tabIds: readonly string[]): Thenable<void> {
    return this.workspaceState.update(WorkspaceStateStore.recentTabsStateKey, [...tabIds]);
  }
}
