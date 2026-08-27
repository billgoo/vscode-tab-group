import * as vscode from 'vscode';
import { isSavedGroupsState, SavedGroup, SavedGroupsState } from '../models/SavedGroup';

export class SavedGroupsStore {
  private static readonly stateKey = 'tabs.workspace.saved-groups.key';

  constructor(private readonly workspaceState: vscode.Memento) {}

  load(): readonly SavedGroup[] | undefined {
    const value = this.workspaceState.get<unknown>(SavedGroupsStore.stateKey);
    return isSavedGroupsState(value) ? value.groups : undefined;
  }

  save(groups: readonly SavedGroup[]): Thenable<void> {
    const currentState = this.workspaceState.get<unknown>(SavedGroupsStore.stateKey);
    if (currentState !== undefined && !isSavedGroupsState(currentState)) {
      return Promise.reject(
        new Error('Saved tab groups use a newer version or invalid format and cannot be changed.'),
      );
    }

    const state: SavedGroupsState = { version: 1, groups: [...groups] };
    return this.workspaceState.update(SavedGroupsStore.stateKey, state);
  }
}
