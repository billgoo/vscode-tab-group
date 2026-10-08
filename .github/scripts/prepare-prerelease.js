const { execFileSync } = require('node:child_process');
const { readFileSync, writeFileSync } = require('node:fs');

function resolvePrereleaseVersion(stableVersion, existingTags = []) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(stableVersion);
  if (!match) {
    throw new Error(`Expected a stable X.Y.Z version, got ${stableVersion}.`);
  }

  const [, major, minor] = match;
  const stableMinor = Number(minor);
  if (stableMinor % 2 !== 0) {
    throw new Error(
      `Stable release versions must use an even minor version; got ${stableVersion}.`,
    );
  }

  const prereleaseMinor = stableMinor + 1;
  const laneTag = new RegExp(`^pre-release/${major}\\.${prereleaseMinor}\\.(\\d+)$`);
  const latestPatch = existingTags.reduce((highest, tag) => {
    const tagMatch = laneTag.exec(tag);
    return tagMatch ? Math.max(highest, Number(tagMatch[1])) : highest;
  }, 0);

  return `${major}.${prereleaseMinor}.${latestPatch + 1}`;
}

function preparePrereleaseChangelog(changelog, version, stableVersion, notes) {
  const changelogPath = 'CHANGELOG.md';
  const heading = '# Change Log\n';

  if (!changelog.startsWith(heading)) {
    throw new Error(`Expected ${changelogPath} to start with "# Change Log".`);
  }

  const noteBody = notes.trim() || `Changes since ${stableVersion}.`;
  const remainder = changelog.slice(heading.length).trimStart();
  return `${heading}\n## ${version} (Pre-release)\n\n${noteBody}\n\n${remainder}`;
}

if (require.main === module) {
  const [command, ...args] = process.argv.slice(2);

  if (command === 'version') {
    const existingTags = execFileSync('git', ['tag', '--list'], { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
    console.log(resolvePrereleaseVersion(args[0], existingTags));
  } else if (command === 'changelog') {
    const [version, stableVersion, notesPath, changelogPath = 'CHANGELOG.md'] = args;
    if (!version || !stableVersion || !notesPath) {
      throw new Error(
        'Usage: node .github/scripts/prepare-prerelease.js changelog <version> <stable-version> <notes-file> [changelog-file]',
      );
    }

    const changelog = readFileSync(changelogPath, 'utf8');
    const notes = readFileSync(notesPath, 'utf8');
    writeFileSync(
      changelogPath,
      preparePrereleaseChangelog(changelog, version, stableVersion, notes),
    );
  } else {
    throw new Error('Usage: node .github/scripts/prepare-prerelease.js <version|changelog> ...');
  }
}

module.exports = { preparePrereleaseChangelog, resolvePrereleaseVersion };
