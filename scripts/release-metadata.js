const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasNonEmptyChangelogSection(changelog, version) {
  const heading = new RegExp(`^##\\s+${escapeRegex(version)}\\s*$`, 'm');
  const match = heading.exec(changelog);
  if (!match) {
    return false;
  }

  const sectionStart = match.index + match[0].length;
  const rest = changelog.slice(sectionStart);
  const nextHeading = /^##\s+/m.exec(rest);
  const section = rest.slice(0, nextHeading ? nextHeading.index : undefined);
  return /^\s*-\s+\S/m.test(section);
}

function getReleaseMetadataErrors({
  version,
  packageJson,
  packageLock,
  changelog,
  requireStableVersion = false,
}) {
  const errors = [];

  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)) {
    errors.push(`package.json version '${version}' is not a valid semantic version.`);
  }

  if (requireStableVersion) {
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
    if (!match || Number(match[2]) % 2 !== 0) {
      errors.push(`Expected a stable even-minor X.Y.Z version, got ${version}.`);
    }
  }

  if (packageJson.version !== version) {
    errors.push(`package.json version '${packageJson.version}' does not match '${version}'.`);
  }

  if (packageLock.version !== version) {
    errors.push(`package-lock.json version '${packageLock.version}' does not match '${version}'.`);
  }

  if (packageLock.packages?.['']?.version !== version) {
    errors.push(`package-lock.json root package version does not match '${version}'.`);
  }

  if (!hasNonEmptyChangelogSection(changelog, version)) {
    errors.push(`CHANGELOG.md needs a non-empty '## ${version}' section.`);
  }

  return errors;
}

if (require.main === module) {
  const [version, ...options] = process.argv.slice(2);
  if (!version || options.some(option => option !== '--stable')) {
    throw new Error('Usage: node scripts/release-metadata.js <version> [--stable]');
  }

  const projectRoot = process.cwd();
  const packageJson = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8'));
  const packageLock = JSON.parse(readFileSync(resolve(projectRoot, 'package-lock.json'), 'utf8'));
  const changelog = readFileSync(resolve(projectRoot, 'CHANGELOG.md'), 'utf8');
  const errors = getReleaseMetadataErrors({
    version,
    packageJson,
    packageLock,
    changelog,
    requireStableVersion: options.includes('--stable'),
  });

  if (errors.length > 0) {
    console.error(`Release metadata validation failed for ${version}:`);
    errors.forEach(error => console.error(`- ${error}`));
    process.exitCode = 1;
  } else {
    console.log(`Release metadata is ready for ${version}.`);
  }
}

module.exports = { getReleaseMetadataErrors, hasNonEmptyChangelogSection };
