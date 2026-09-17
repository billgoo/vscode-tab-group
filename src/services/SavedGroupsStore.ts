import * as vscode from 'vscode';
import { isSavedGroupsState, SavedGroup, SavedGroupsState } from '../models/SavedGroup';
import { SerialTaskQueue } from '../utils/async';

export class SavedGroupsStore {
  private static readonly stateKey = 'tabs.workspace.saved-groups.key';

  constructor(
    private readonly workspaceState: vscode.Memento,
    private readonly writeQueue = new SerialTaskQueue(),
  ) {}

  load(): readonly SavedGroup[] | undefined {
    const value = this.workspaceState.get<unknown>(SavedGroupsStore.stateKey);
    return isSavedGroupsState(value) ? value.groups : undefined;
  }

  save(groups: readonly SavedGroup[]): Promise<void> {
    return this.update(() => groups).then(() => undefined);
  }

  update(
    mutator: (groups: readonly SavedGroup[]) => readonly SavedGroup[],
  ): Promise<readonly SavedGroup[]> {
    return this.writeQueue.run(async () => {
      const currentState = this.workspaceState.get<unknown>(SavedGroupsStore.stateKey);
      if (currentState !== undefined && !isSavedGroupsState(currentState)) {
        throw new Error(
          'Saved tab groups use a newer version or invalid format and cannot be changed.',
        );
      }

      const currentGroups = currentState?.groups ?? [];
      const groups = mutator(currentGroups);
      if (groups === currentGroups) {
        return currentGroups;
      }

      const state: SavedGroupsState = { version: 1, groups: [...groups] };
      await this.workspaceState.update(SavedGroupsStore.stateKey, state);
      return state.groups;
    });
  }
}
