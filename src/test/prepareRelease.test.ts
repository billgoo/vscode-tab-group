import { describe, expect, it } from '@jest/globals';
import { prepareChangelog } from '../../.github/scripts/prepare-release';

describe('prepareChangelog', () => {
  it('promotes curated unreleased notes and preserves older versions', () => {
    const changelog = [
      '# Change Log',
      '',
      '## Unreleased',
      '',
      '- Fix a pending issue.',
      '',
      '## 3.2.1',
      '',
      '- Previous release.',
      '',
    ].join('\n');

    expect(prepareChangelog(changelog, '3.4.0')).toBe(
      [
        '# Change Log',
        '',
        '## Unreleased',
        '',
        '## 3.4.0',
        '',
        '- Fix a pending issue.',
        '',
        '## 3.2.1',
        '',
        '- Previous release.',
        '',
      ].join('\n'),
    );
  });

  it('uses generated notes when Unreleased is empty', () => {
    const changelog = '# Change Log\n\n## Unreleased\n\n## 3.2.1\n\n- Previous release.\n';
    const generatedNotes = "## What's Changed\n* Add a new capability (#42)\n";

    expect(prepareChangelog(changelog, '3.4.0', generatedNotes)).toContain(
      '- Add a new capability (#42)',
    );
  });

  it('rejects duplicate versions and empty generated notes', () => {
    const changelog = '# Change Log\n\n## Unreleased\n\n## 3.4.0\n\n- Already released.\n';

    expect(() => prepareChangelog(changelog, '3.4.0')).toThrow('already contains a section');
    expect(() => prepareChangelog('# Change Log\n\n## Unreleased\n', '3.6.0')).toThrow(
      'No release notes found',
    );
  });
});
