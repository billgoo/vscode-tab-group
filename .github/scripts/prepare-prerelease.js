const { readFileSync, writeFileSync } = require('node:fs');

function resolvePrereleaseVersion(stableVersion, runNumber) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(stableVersion);
  if (!match || !/^\d+$/.test(runNumber)) {
    throw new Error(
      `Expected a stable X.Y.Z version and numeric run number, got ${stableVersion} and ${runNumber}.`,
    );
  }

  const [, major, minor] = match;
  const stableMinor = Number(minor);
  if (stableMinor % 2 !== 0) {
    throw new Error(
      `Stable release versions must use an even minor version; got ${stableVersion}.`,
    );
  }

  return `${major}.${stableMinor + 1}.${Number(runNumber)}`;
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
    console.log(resolvePrereleaseVersion(args[0], args[1]));
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
