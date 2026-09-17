export const ExclusiveHandlePriority = {
  Normal: 0,
  UserAction: 1,
} as const;

type Task = () => PromiseLike<void> | void;

type Deferred = {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: unknown) => void;
};

function createDeferred(): Deferred {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

/**
 * Runs one task at a time and coalesces additional requests into one pending task.
 * The latest request at the highest pending priority is the task that runs next.
 */
export class ExclusiveHandle {
  private running: Promise<void> | undefined;
  private pending: { task: Task; priority: number; completion: Deferred } | undefined;

  run(task: Task, priority: number = ExclusiveHandlePriority.Normal): Promise<void> {
    if (!this.running) {
      return this.start(task);
    }

    if (!this.pending) {
      // Every request coalesced into this pending batch observes the same completion.
      this.pending = { task, priority, completion: createDeferred() };
    } else if (priority >= this.pending.priority) {
      // Lower-priority synchronization must not replace a pending user action.
      this.pending.task = task;
      this.pending.priority = priority;
    }

    return this.pending.completion.promise;
  }

  private start(task: Task, completion: Deferred = createDeferred()): Promise<void> {
    // Invoke in a microtask so synchronous throws become promise rejections.
    const result = Promise.resolve().then(task);
    this.running = result.then(completion.resolve, completion.reject).finally(() => {
      this.running = undefined;
      const pending = this.pending;
      this.pending = undefined;
      if (pending) {
        this.start(pending.task, pending.completion);
      }
    });
    return completion.promise;
  }
}
