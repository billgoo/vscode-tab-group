import * as vscode from 'vscode';

/**
 * When an change event is fired, each handler only run onces. Prevent mutual event triggering (infinite loop)
 */
export class SyncEventHelper {
	private synced: Record<string, Promise<any>> = {};

	run<T = void>(id: string, listener: () => Promise<T> | T): Promise<T> {
		if (!(id in this.synced)) {
			this.synced[id] = Promise.resolve(listener()).finally(() => this.synced = {});
		}
		
		return this.synced[id] as Promise<T>;
	}
}