export interface IDisposable {
	dispose(): void;
}

export abstract class Disposable implements IDisposable {
	private store = new Set<IDisposable>();

	protected _register<T extends IDisposable>(disposable: T): T {
		this.store.add(disposable);
		return disposable;
	}

	public dispose(): void {
		this.store.forEach(disposable => disposable.dispose());
		this.store.clear();
	}
}