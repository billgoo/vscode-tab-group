const { spawnSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const projectRoot = resolve(__dirname, '..');
const packageJsonPath = resolve(projectRoot, 'package.json');
const packageLockPath = resolve(projectRoot, 'package-lock.json');
const changelogPath = resolve(projectRoot, 'CHANGELOG.md');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getGitTags() {
  const result = spawnSync('git', ['tag', '--list'], {
    cwd: projectRoot,
    encoding: 'utf8',
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || 'Unable to list Git tags.');
  }

  return new Set(result.stdout.split('\n').filter(Boolean));
}

function hasChangelogEntry(changelog, version) {
  const heading = new RegExp(`^##\\s+${escapeRegex(version)}\\s*$`, 'm');
  const match = heading.exec(changelog);

  if (!match) {
    return false;
  }

  const sectionStart = match.index + match[0].length;
  const nextHeading = /^##\s+/m;
  nextHeading.lastIndex = sectionStart;
  const sectionEnd = nextHeading.exec(changelog.slice(sectionStart));
  const section = changelog.slice(
    sectionStart,
    sectionEnd ? sectionStart + sectionEnd.index : undefined,
  );

  return /^\s*-\s+\S/m.test(section);
}

const packageJson = readJson(packageJsonPath);
const packageLock = readJson(packageLockPath);
const changelog = readFileSync(changelogPath, 'utf8');
const version = packageJson.version;
const errors = [];

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)) {
  errors.push(`package.json version '${version}' is not a valid semantic version.`);
}

if (packageLock.version !== version) {
  errors.push(`package-lock.json version '${packageLock.version}' does not match '${version}'.`);
}

if (packageLock.packages?.['']?.version !== version) {
  errors.push(`package-lock.json root package version does not match '${version}'.`);
}

if (!hasChangelogEntry(changelog, version)) {
  errors.push(`CHANGELOG.md needs a non-empty '## ${version}' section.`);
}

const tags = getGitTags();
const existingTags = [version, `v${version}`].filter(tag => tags.has(tag));
if (existingTags.length > 0) {
  errors.push(`Release tag already exists: ${existingTags.join(', ')}.`);
}

if (errors.length > 0) {
  console.error(`Release preflight failed for ${version}:`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(`Release metadata is ready for ${version}.`);
  console.log(
    'Next: run the package-only release gate, commit the metadata, then tag and push the merged main branch.',
  );
}
