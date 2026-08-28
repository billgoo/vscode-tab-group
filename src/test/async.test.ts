import { describe, expect, test } from '@jest/globals';
import { SerialTaskQueue } from '../utils/async';

describe('SerialTaskQueue', () => {
  test('serializes tasks and continues after a failure', async () => {
    const queue = new SerialTaskQueue();
    const events: string[] = [];
    let releaseFirstTask!: () => void;
    const firstTaskReleased = new Promise<void>(resolve => {
      releaseFirstTask = resolve;
    });

    const firstTask = queue.run(async () => {
      events.push('first:start');
      await firstTaskReleased;
      events.push('first:end');
      throw new Error('first task failed');
    });
    const secondTask = queue.run(async () => {
      events.push('second');
      return 'completed';
    });

    await Promise.resolve();
    expect(events).toEqual(['first:start']);

    releaseFirstTask();
    await expect(firstTask).rejects.toThrow('first task failed');
    await expect(secondTask).resolves.toBe('completed');
    expect(events).toEqual(['first:start', 'first:end', 'second']);
  });
});
