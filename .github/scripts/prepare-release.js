const { readFileSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeGeneratedNotes(notes) {
  return notes
    .trim()
    .split('\n')
    .map(line => line.replace(/^(\s*)\*\s+/, '$1- '))
    .join('\n')
    .trim();
}

function prepareChangelog(changelog, version, generatedNotes = '') {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`Expected a stable X.Y.Z version, got ${version}.`);
  }

  const title = '# Change Log\n';
  if (!changelog.startsWith(title)) {
    throw new Error('CHANGELOG.md must start with "# Change Log".');
  }

  const versionHeading = new RegExp(`^##[ \\t]+${escapeRegex(version)}[ \\t]*$`, 'm');
  if (versionHeading.test(changelog)) {
    throw new Error(`CHANGELOG.md already contains a section for ${version}.`);
  }

  const unreleasedHeading = /^## Unreleased[ \t]*$/m;
  const match = unreleasedHeading.exec(changelog);
  if (!match) {
    throw new Error('CHANGELOG.md must contain an "## Unreleased" section.');
  }

  const sectionStart = match.index + match[0].length;
  const afterHeading = changelog.slice(sectionStart);
  const nextHeading = /^##\s+/m.exec(afterHeading);
  const unreleasedBody = afterHeading.slice(0, nextHeading ? nextHeading.index : undefined).trim();
  const releaseNotes = /^\s*-\s+\S/m.test(unreleasedBody)
    ? unreleasedBody
    : normalizeGeneratedNotes(generatedNotes);

  if (!/^\s*-\s+\S/m.test(releaseNotes)) {
    throw new Error(`No release notes found for ${version}.`);
  }

  const history = nextHeading ? afterHeading.slice(nextHeading.index).replace(/^\s*/, '') : '';
  const prefix = changelog.slice(0, sectionStart);
  const result = `${prefix}\n\n## ${version}\n\n${releaseNotes}${history ? `\n\n${history}` : ''}`;

  return result.endsWith('\n') ? result : `${result}\n`;
}

if (require.main === module) {
  const [version, notesPath, projectRootArg] = process.argv.slice(2);
  if (!version) {
    throw new Error(
      'Usage: node .github/scripts/prepare-release.js <version> [generated-notes-file] [project-root]',
    );
  }

  const projectRoot = resolve(projectRootArg || process.cwd());
  const changelogPath = resolve(projectRoot, 'CHANGELOG.md');
  const generatedNotes = notesPath ? readFileSync(notesPath, 'utf8') : '';
  const changelog = readFileSync(changelogPath, 'utf8');
  writeFileSync(changelogPath, prepareChangelog(changelog, version, generatedNotes));
}

module.exports = { prepareChangelog };
