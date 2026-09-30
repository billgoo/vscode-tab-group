import { describe, expect, it } from '@jest/globals';
import {
  preparePrereleaseChangelog,
  resolvePrereleaseVersion,
} from '../../.github/scripts/prepare-prerelease';

describe('resolvePrereleaseVersion', () => {
  it('uses the next odd minor version and workflow run number', () => {
    expect(resolvePrereleaseVersion('3.2.1', '54')).toBe('3.3.54');
  });

  it('rejects invalid stable versions and run numbers', () => {
    expect(() => resolvePrereleaseVersion('3.3.1', '54')).toThrow('even minor version');
    expect(() => resolvePrereleaseVersion('3.2.1', 'run')).toThrow('numeric run number');
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
