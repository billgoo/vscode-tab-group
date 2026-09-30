import { describe, expect, it } from '@jest/globals';
import {
  getReleaseMetadataErrors,
  hasNonEmptyChangelogSection,
} from '../../scripts/release-metadata';

const validMetadata = {
  version: '3.4.0',
  packageJson: { version: '3.4.0' },
  packageLock: { version: '3.4.0', packages: { '': { version: '3.4.0' } } },
  changelog: '# Change Log\n\n## 3.4.0\n\n- A stable release.\n',
};

describe('release metadata', () => {
  it('accepts matching package, lockfile, and changelog data for a stable version', () => {
    expect(getReleaseMetadataErrors({ ...validMetadata, requireStableVersion: true })).toEqual([]);
  });

  it('reports package and changelog mismatches', () => {
    const errors = getReleaseMetadataErrors({
      ...validMetadata,
      packageJson: { version: '3.2.1' },
      packageLock: { version: '3.2.1', packages: { '': { version: '3.2.1' } } },
      changelog: '# Change Log\n\n## 3.4.0\n\nNo bullet notes.\n',
    });

    expect(errors).toEqual(
      expect.arrayContaining([
        "package.json version '3.2.1' does not match '3.4.0'.",
        "package-lock.json version '3.2.1' does not match '3.4.0'.",
        "package-lock.json root package version does not match '3.4.0'.",
        "CHANGELOG.md needs a non-empty '## 3.4.0' section.",
      ]),
    );
  });

  it('accepts an even-minor stable version with a non-zero patch', () => {
    expect(
      getReleaseMetadataErrors({
        version: '3.2.1',
        packageJson: { version: '3.2.1' },
        packageLock: { version: '3.2.1', packages: { '': { version: '3.2.1' } } },
        changelog: '# Change Log\n\n## 3.2.1\n\n- Stable release.\n',
        requireStableVersion: true,
      }),
    ).toEqual([]);
  });

  it('requires an even minor version when validating a stable release', () => {
    expect(
      getReleaseMetadataErrors({
        ...validMetadata,
        version: '3.3.0',
        packageJson: { version: '3.3.0' },
        packageLock: { version: '3.3.0', packages: { '': { version: '3.3.0' } } },
        changelog: '# Change Log\n\n## 3.3.0\n\n- Preview.\n',
        requireStableVersion: true,
      }),
    ).toContain('Expected a stable even-minor X.Y.Z version, got 3.3.0.');
  });

  it('matches exact changelog headings and requires bullet notes', () => {
    expect(
      hasNonEmptyChangelogSection('# Change Log\n\n## 3x4.0\n\n- Not a match.\n', '3.4.0'),
    ).toBe(false);
    expect(hasNonEmptyChangelogSection(validMetadata.changelog, '3.4.0')).toBe(true);
  });
});
