export interface IDisposable {
  dispose(): void;
}

export abstract class Disposable implements IDisposable {
  private readonly store = new Set<IDisposable>();
  private isDisposed = false;

  protected _register<T extends IDisposable>(disposable: T): T {
    if (this.isDisposed) {
      disposable.dispose();
      return disposable;
    }

    this.store.add(disposable);
    return disposable;
  }

  public dispose(): void {
    if (this.isDisposed) {
      return;
    }

    this.isDisposed = true;
    const disposables = [...this.store];
    this.store.clear();
    disposables.forEach(disposable => disposable.dispose());
  }
}
