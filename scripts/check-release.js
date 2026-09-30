const { spawnSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { getReleaseMetadataErrors } = require('./release-metadata');

const projectRoot = resolve(__dirname, '..');
const packageJsonPath = resolve(projectRoot, 'package.json');
const packageLockPath = resolve(projectRoot, 'package-lock.json');
const changelogPath = resolve(projectRoot, 'CHANGELOG.md');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
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

const packageJson = readJson(packageJsonPath);
const packageLock = readJson(packageLockPath);
const changelog = readFileSync(changelogPath, 'utf8');
const version = packageJson.version;
const errors = getReleaseMetadataErrors({ version, packageJson, packageLock, changelog });

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
