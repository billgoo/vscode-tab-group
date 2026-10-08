import { describe, expect, it } from '@jest/globals';
import {
  preparePrereleaseChangelog,
  resolvePrereleaseVersion,
} from '../../.github/scripts/prepare-prerelease';

describe('resolvePrereleaseVersion', () => {
  it('starts an odd-minor preview lane at patch one', () => {
    expect(resolvePrereleaseVersion('3.2.1')).toBe('3.3.1');
  });

  it('continues the published preview lane without reusing a version', () => {
    expect(resolvePrereleaseVersion('3.2.1', ['pre-release/3.3.3', 'pre-release/3.3.4'])).toBe(
      '3.3.5',
    );
  });

  it('starts the next odd-minor lane after a stable release', () => {
    expect(resolvePrereleaseVersion('3.4.0', ['pre-release/3.3.10'])).toBe('3.5.1');
  });

  it('increments from the latest tag in the current preview lane only', () => {
    expect(
      resolvePrereleaseVersion('3.4.0', [
        'pre-release/3.3.10',
        'pre-release/3.5.2',
        'pre-release/3.5.10',
        'pre-release/3.6.99',
      ]),
    ).toBe('3.5.11');
  });

  it('rejects invalid stable versions and odd-minor stable versions', () => {
    expect(() => resolvePrereleaseVersion('3.3.0')).toThrow('even minor version');
    expect(() => resolvePrereleaseVersion('3.x.1')).toThrow('stable X.Y.Z');
  });
});

describe('preparePrereleaseChangelog', () => {
  it('adds generated notes before the existing changelog', () => {
    const changelog = '# Change Log\n\n## Unreleased\n\n- In progress.\n';

    expect(
      preparePrereleaseChangelog(changelog, '3.3.54', '3.2.1', '## Changes\n* Add a capability'),
    ).toBe(
      '# Change Log\n\n## 3.3.54 (Pre-release)\n\n## Changes\n* Add a capability\n\n## Unreleased\n\n- In progress.\n',
    );
  });

  it('uses a fallback note when GitHub generates no notes', () => {
    expect(preparePrereleaseChangelog('# Change Log\n', '3.3.54', '3.2.1', '  ')).toBe(
      '# Change Log\n\n## 3.3.54 (Pre-release)\n\nChanges since 3.2.1.\n\n',
    );
  });

  it('rejects changelogs without the expected title', () => {
    expect(() => preparePrereleaseChangelog('Change Log\n', '3.3.54', '3.2.1', '')).toThrow(
      'Expected CHANGELOG.md to start with',
    );
  });
});
