export function asPromise<T>(thenable: Thenable<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => thenable.then(resolve, reject));
}

export class SerialTaskQueue {
  private pending: Promise<void> = Promise.resolve();

  run<T>(task: () => PromiseLike<T> | T): Promise<T> {
    const result = this.pending.then(() => task());
    this.pending = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
