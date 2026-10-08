import { describe, expect, it } from '@jest/globals';
import { resolveReleasePreparation } from '../../.github/scripts/resolve-release-prep';

const initialState = {
  stableVersion: '3.2.1',
  devPackage: { version: '3.2.1' },
  devLock: { version: '3.2.1', packages: { '': { version: '3.2.1' } } },
  changelog: '# Change Log\n\n## Unreleased\n\n- Work in progress.\n',
  existingTags: new Set(['pre-release/3.3.4']),
};

describe('resolveReleasePreparation', () => {
  it('prepares the next even-minor stable version after the preview lane', () => {
    expect(resolveReleasePreparation(initialState)).toEqual({
      version: '3.4.0',
      shouldPrepare: true,
    });
  });

  it('skips preparation when dev already has complete release metadata', () => {
    expect(
      resolveReleasePreparation({
        ...initialState,
        devPackage: { version: '3.4.0' },
        devLock: { version: '3.4.0', packages: { '': { version: '3.4.0' } } },
        changelog: '# Change Log\n\n## 3.4.0\n\n- Release note.\n',
      }),
    ).toEqual({ version: '3.4.0', shouldPrepare: false });
  });

  it('advances two minors from the current stable version', () => {
    expect(
      resolveReleasePreparation({
        ...initialState,
        stableVersion: '3.4.0',
        devPackage: { version: '3.4.0' },
        devLock: { version: '3.4.0', packages: { '': { version: '3.4.0' } } },
        changelog: '# Change Log\n\n## 3.4.0\n\n- Current stable.\n',
        existingTags: new Set(['pre-release/3.3.10', 'pre-release/3.5.10']),
      }),
    ).toEqual({ version: '3.6.0', shouldPrepare: true });
  });

  it('uses the next even minor when no preview lane exists yet', () => {
    expect(resolveReleasePreparation({ ...initialState, existingTags: new Set<string>() })).toEqual(
      { version: '3.4.0', shouldPrepare: true },
    );
  });

  it('rejects an odd-minor main version', () => {
    expect(() => resolveReleasePreparation({ ...initialState, stableVersion: '3.3.0' })).toThrow(
      'stable even-minor X.Y.Z version',
    );
  });

  it('rejects unexpected dev versions and mismatched locks', () => {
    expect(() =>
      resolveReleasePreparation({
        ...initialState,
        devPackage: { version: '3.5.0' },
      }),
    ).toThrow('Expected dev to use 3.2.1 or 3.4.0');

    expect(() =>
      resolveReleasePreparation({
        ...initialState,
        devPackage: { version: '3.4.0' },
      }),
    ).toThrow('package-lock.json does not match 3.4.0');
  });

  it('rejects an existing target tag', () => {
    expect(() =>
      resolveReleasePreparation({
        ...initialState,
        existingTags: new Set([...initialState.existingTags, 'v3.4.0']),
      }),
    ).toThrow('Stable release tag 3.4.0 already exists');
  });
});
