import { describe, expect, test } from '@jest/globals';
import { Disposable, IDisposable } from '../utils/disposable';

class TestDisposable extends Disposable {
  register<T extends IDisposable>(disposable: T): T {
    return this._register(disposable);
  }
}

describe('Disposable', () => {
  test('disposes registered resources exactly once', () => {
    let disposeCount = 0;
    const owner = new TestDisposable();
    owner.register({ dispose: () => disposeCount++ });

    owner.dispose();
    owner.dispose();

    expect(disposeCount).toBe(1);
  });

  test('immediately disposes resources registered after disposal', () => {
    let disposeCount = 0;
    const owner = new TestDisposable();
    owner.dispose();

    owner.register({ dispose: () => disposeCount++ });

    expect(disposeCount).toBe(1);
  });
});
