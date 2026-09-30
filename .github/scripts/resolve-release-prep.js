const { execFileSync } = require('node:child_process');
const { appendFileSync } = require('node:fs');
const { hasNonEmptyChangelogSection } = require('../../scripts/release-metadata');

function resolveReleasePreparation({
  stableVersion,
  devPackage,
  devLock,
  changelog,
  existingTags,
}) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(stableVersion);
  if (!match || Number(match[2]) % 2 !== 0) {
    throw new Error(
      `Expected main to have a stable even-minor X.Y.Z version, got ${stableVersion}.`,
    );
  }

  const releaseVersion = `${match[1]}.${Number(match[2]) + 2}.0`;
  if (![stableVersion, releaseVersion].includes(devPackage.version)) {
    throw new Error(
      `Expected dev to use ${stableVersion} or ${releaseVersion}, got ${devPackage.version}.`,
    );
  }

  if (
    devPackage.version === releaseVersion &&
    (devLock.version !== releaseVersion || devLock.packages?.['']?.version !== releaseVersion)
  ) {
    throw new Error(`package-lock.json does not match ${releaseVersion} on dev.`);
  }

  if (existingTags.has(releaseVersion) || existingTags.has(`v${releaseVersion}`)) {
    throw new Error(`Stable release tag ${releaseVersion} already exists.`);
  }

  return {
    version: releaseVersion,
    shouldPrepare:
      devPackage.version !== releaseVersion ||
      !hasNonEmptyChangelogSection(changelog, releaseVersion),
  };
}

function readFileAtRef(ref, path) {
  return execFileSync('git', ['show', `${ref}:${path}`], { encoding: 'utf8' });
}

if (require.main === module) {
  const stableVersion = JSON.parse(readFileAtRef('origin/main', 'package.json')).version;
  const devPackage = JSON.parse(readFileAtRef('origin/dev', 'package.json'));
  const devLock = JSON.parse(readFileAtRef('origin/dev', 'package-lock.json'));
  const changelog = readFileAtRef('origin/dev', 'CHANGELOG.md');
  const existingTags = new Set(
    execFileSync('git', ['tag', '--list'], { encoding: 'utf8' }).split('\n').filter(Boolean),
  );
  const result = resolveReleasePreparation({
    stableVersion,
    devPackage,
    devLock,
    changelog,
    existingTags,
  });

  if (!process.env.GITHUB_OUTPUT) {
    throw new Error('GITHUB_OUTPUT is required when resolving workflow release metadata.');
  }

  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `version=${result.version}\nshould_prepare=${result.shouldPrepare}\n`,
  );
}

module.exports = { resolveReleasePreparation };
