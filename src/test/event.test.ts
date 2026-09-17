import { describe, expect, jest, test } from '@jest/globals';
import { ExclusiveHandle, ExclusiveHandlePriority } from '../utils/event';

describe('ExclusiveHandle', () => {
  test('runs the latest action requested while another action is active', async () => {
    const handle = new ExclusiveHandle();
    const actions: string[] = [];
    let releaseFirstAction!: () => void;
    const firstActionReleased = new Promise<void>(resolve => {
      releaseFirstAction = resolve;
    });

    const first = handle.run(async () => {
      actions.push('first:start');
      await firstActionReleased;
      actions.push('first:end');
    });
    const skipped = jest.fn(async () => {
      actions.push('skipped');
    });
    const second = handle.run(skipped);
    const latest = handle.run(async () => {
      actions.push('latest');
    });

    await Promise.resolve();
    expect(actions).toEqual(['first:start']);
    expect(second).toBe(latest);
    releaseFirstAction();
    await Promise.all([first, second, latest]);

    expect(skipped).not.toHaveBeenCalled();
    expect(actions).toEqual(['first:start', 'first:end', 'latest']);
  });

  test('runs a pending action after the active action fails', async () => {
    const handle = new ExclusiveHandle();
    let releaseFirstAction!: () => void;
    const firstActionReleased = new Promise<void>(resolve => {
      releaseFirstAction = resolve;
    });
    const pending = jest.fn(async () => {});

    const first = handle.run(async () => {
      await firstActionReleased;
      throw new Error('activation failed');
    });
    const second = handle.run(pending);

    releaseFirstAction();
    await expect(first).rejects.toThrow('activation failed');
    await expect(second).resolves.toBeUndefined();
    expect(pending).toHaveBeenCalledTimes(1);
  });

  test('does not replace a pending user action with a later normal action', async () => {
    const handle = new ExclusiveHandle();
    const actions: string[] = [];
    let releaseActiveAction!: () => void;
    const activeActionReleased = new Promise<void>(resolve => {
      releaseActiveAction = resolve;
    });

    const active = handle.run(async () => {
      actions.push('activate-a:start');
      await activeActionReleased;
      actions.push('activate-a:end');
    });
    const userSelection = handle.run(async () => {
      actions.push('activate-b');
    }, ExclusiveHandlePriority.UserAction);
    const staleReveal = jest.fn(async () => {
      actions.push('reveal-a');
    });
    const reveal = handle.run(staleReveal);

    releaseActiveAction();
    await Promise.all([active, userSelection, reveal]);

    expect(staleReveal).not.toHaveBeenCalled();
    expect(actions).toEqual(['activate-a:start', 'activate-a:end', 'activate-b']);
  });
});
