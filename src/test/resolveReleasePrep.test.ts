import { describe, expect, it } from '@jest/globals';
import { resolveReleasePreparation } from '../../.github/scripts/resolve-release-prep';

const initialState = {
  stableVersion: '3.4.0',
  devPackage: { version: '3.4.0' },
  devLock: { version: '3.4.0', packages: { '': { version: '3.4.0' } } },
  changelog: '# Change Log\n\n## Unreleased\n\n- Work in progress.\n',
  existingTags: new Set(['3.4.0']),
};

describe('resolveReleasePreparation', () => {
  it('increments the patch when the current stable is tagged and no next-lane preview exists', () => {
    expect(resolveReleasePreparation(initialState)).toEqual({
      version: '3.4.1',
      shouldPrepare: true,
    });
  });

  it.each(['3.4.0', 'v3.4.0'])('recognizes the current stable tag %s', tag => {
    expect(
      resolveReleasePreparation({
        ...initialState,
        existingTags: new Set([tag]),
      }),
    ).toEqual({ version: '3.4.1', shouldPrepare: true });
  });

  it.each(['pre-release/3.5.1', 'pre-release/3.5.10'])(
    'advances to the next even minor after published preview %s',
    tag => {
      expect(
        resolveReleasePreparation({
          ...initialState,
          existingTags: new Set(['3.4.0', tag]),
        }),
      ).toEqual({ version: '3.6.0', shouldPrepare: true });
    },
  );

  it.each([
    'pre-release/3.3.10',
    'pre-release/3.7.1',
    'pre-release/4.5.1',
    'pre-release/3.5.99-beta.1',
    'pre-release/3.5.99/extra',
    'prefix/pre-release/3.5.99',
  ])('does not advance the minor for unrelated or malformed preview tag %s', tag => {
    expect(
      resolveReleasePreparation({
        ...initialState,
        existingTags: new Set(['3.4.0', tag]),
      }),
    ).toEqual({ version: '3.4.1', shouldPrepare: true });
  });

  it.each([
    { name: 'no tags', tags: [] },
    { name: 'older releases only', tags: ['3.2.1', 'pre-release/3.3.10'] },
    { name: 'a newer preview but no stable tag', tags: ['pre-release/3.5.1'] },
  ])('reuses an untagged stable version with $name', ({ tags }) => {
    expect(resolveReleasePreparation({ ...initialState, existingTags: new Set(tags) })).toEqual({
      version: '3.4.0',
      shouldPrepare: true,
    });
  });

  it('marks recovery ready when the untagged stable version already has complete metadata', () => {
    expect(
      resolveReleasePreparation({
        ...initialState,
        changelog: '# Change Log\n\n## 3.4.0\n\n- Pending stable release.\n',
        existingTags: new Set<string>(),
      }),
    ).toEqual({ version: '3.4.0', shouldPrepare: false });
  });

  it('skips preparation when dev already has complete patch-release metadata', () => {
    expect(
      resolveReleasePreparation({
        ...initialState,
        devPackage: { version: '3.4.1' },
        devLock: { version: '3.4.1', packages: { '': { version: '3.4.1' } } },
        changelog: '# Change Log\n\n## 3.4.1\n\n- Fix release preparation.\n',
      }),
    ).toEqual({ version: '3.4.1', shouldPrepare: false });
  });

  it('skips preparation when dev already has complete preview-promotion metadata', () => {
    expect(
      resolveReleasePreparation({
        ...initialState,
        devPackage: { version: '3.6.0' },
        devLock: { version: '3.6.0', packages: { '': { version: '3.6.0' } } },
        changelog: '# Change Log\n\n## 3.6.0\n\n- Promote preview changes.\n',
        existingTags: new Set(['v3.4.0', 'pre-release/3.5.1']),
      }),
    ).toEqual({ version: '3.6.0', shouldPrepare: false });
  });

  it.each([
    { tags: ['3.4.7'], version: '3.4.8' },
    { tags: ['v3.4.7', 'pre-release/3.5.2'], version: '3.6.0' },
  ])('selects $version after a nonzero stable patch', ({ tags, version }) => {
    expect(
      resolveReleasePreparation({
        ...initialState,
        stableVersion: '3.4.7',
        devPackage: { version: '3.4.7' },
        devLock: { version: '3.4.7', packages: { '': { version: '3.4.7' } } },
        existingTags: new Set(tags),
      }),
    ).toEqual({ version, shouldPrepare: true });
  });

  it.each(['3.4.1', 'v3.4.1'])('rejects an already tagged patch release %s', tag => {
    expect(() =>
      resolveReleasePreparation({
        ...initialState,
        existingTags: new Set(['3.4.0', tag]),
      }),
    ).toThrow('Stable release tag 3.4.1 already exists');
  });

  it('rejects an already tagged preview-promotion target', () => {
    expect(() =>
      resolveReleasePreparation({
        ...initialState,
        existingTags: new Set(['3.4.0', 'pre-release/3.5.1', 'v3.6.0']),
      }),
    ).toThrow('Stable release tag 3.6.0 already exists');
  });

  it('rejects an odd-minor main version', () => {
    expect(() => resolveReleasePreparation({ ...initialState, stableVersion: '3.5.0' })).toThrow(
      'stable even-minor X.Y.Z version',
    );
  });

  it('rejects unexpected dev versions and mismatched locks', () => {
    expect(() =>
      resolveReleasePreparation({
        ...initialState,
        devPackage: { version: '3.5.0' },
      }),
    ).toThrow('Expected dev to use 3.4.0 or 3.4.1');

    expect(() =>
      resolveReleasePreparation({
        ...initialState,
        devPackage: { version: '3.4.1' },
      }),
    ).toThrow('package-lock.json does not match 3.4.1');
  });

  it('validates lockfile versions when recovering the current stable release', () => {
    expect(() =>
      resolveReleasePreparation({
        ...initialState,
        devLock: { version: '3.2.1', packages: { '': { version: '3.2.1' } } },
        existingTags: new Set<string>(),
      }),
    ).toThrow('package-lock.json does not match 3.4.0');
  });
});
