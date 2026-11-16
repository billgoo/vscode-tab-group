const { execFileSync } = require('node:child_process');
const { appendFileSync, readFileSync } = require('node:fs');
const { isDeepStrictEqual } = require('node:util');

const releaseFiles = new Set(['CHANGELOG.md', 'package.json', 'package-lock.json']);

function isRelevantReleasePrepRun(run, repository) {
  return (
    run.event === 'pull_request' &&
    run.conclusion === 'success' &&
    /^release-prep\/\d+\.\d+\.\d+$/.test(run.head_branch || '') &&
    /^[a-f0-9]{40}$/.test(run.head_sha || '') &&
    run.head_repository?.full_name === repository &&
    run.pull_requests?.length === 1
  );
}

function isReleasePrepCandidate({ run, repository, pullRequest, files }) {
  return (
    isRelevantReleasePrepRun(run, repository) &&
    pullRequest.number === run.pull_requests[0].number &&
    pullRequest.state === 'open' &&
    pullRequest.draft === false &&
    pullRequest.user?.login === 'billgoo-tab-group-release[bot]' &&
    pullRequest.head?.ref === run.head_branch &&
    pullRequest.head?.sha === run.head_sha &&
    pullRequest.head?.repo?.full_name === repository &&
    pullRequest.base?.ref === 'dev' &&
    /^[a-f0-9]{40}$/.test(pullRequest.base?.sha || '') &&
    pullRequest.base?.repo?.full_name === repository &&
    files.length > 0 &&
    pullRequest.changed_files === files.length &&
    files.every(file => file.status === 'modified' && releaseFiles.has(file.filename))
  );
}

function withoutVersion(value) {
  const { version, ...remaining } = value;
  return remaining;
}

function isReleasePrepReady(candidate) {
  if (!isReleasePrepCandidate(candidate)) {
    return false;
  }

  const version = candidate.run.head_branch.slice('release-prep/'.length);
  const { basePackage, headPackage, baseLock, headLock } = candidate.metadata;
  const baseRoot = baseLock.packages?.[''];
  const headRoot = headLock.packages?.[''];
  if (
    !baseRoot ||
    !headRoot ||
    headPackage.version !== version ||
    headLock.version !== version ||
    headRoot.version !== version
  ) {
    return false;
  }

  const normalizeLock = (lock, root) => ({
    ...withoutVersion(lock),
    packages: { ...lock.packages, '': withoutVersion(root) },
  });
  return (
    isDeepStrictEqual(withoutVersion(basePackage), withoutVersion(headPackage)) &&
    isDeepStrictEqual(normalizeLock(baseLock, baseRoot), normalizeLock(headLock, headRoot))
  );
}

function ghJson(...args) {
  return JSON.parse(execFileSync('gh', args, { encoding: 'utf8' }));
}

function readMetadata(repository, path, sha) {
  const file = ghJson('api', `repos/${repository}/contents/${path}?ref=${sha}`);
  if (file.encoding !== 'base64' || typeof file.content !== 'string') {
    throw new Error(`Could not read ${path} at ${sha}.`);
  }
  return JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));
}

if (require.main === module) {
  const { workflow_run: run, repository } = JSON.parse(
    readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'),
  );
  if (!process.env.GITHUB_OUTPUT || !repository?.full_name || !run) {
    throw new Error('A workflow_run event, repository, and GITHUB_OUTPUT are required.');
  }

  if (!isRelevantReleasePrepRun(run, repository.full_name)) {
    console.log('Skipping CI run: it is not a successful release-prep pull request run.');
  } else {
    const number = run.pull_requests[0].number;
    if (!Number.isSafeInteger(number) || number <= 0) {
      throw new Error('The CI run has an invalid pull request number.');
    }

    const pullRequest = ghJson('api', `repos/${repository.full_name}/pulls/${number}`);
    const filePages = ghJson(
      'api',
      '--paginate',
      '--slurp',
      `repos/${repository.full_name}/pulls/${number}/files?per_page=100`,
    );
    const files = filePages.flat();
    const candidate = { run, repository: repository.full_name, pullRequest, files };
    if (!isReleasePrepCandidate(candidate)) {
      console.log(`Skipping PR #${number}: it is no longer an eligible release-prep pull request.`);
    } else {
      const metadata = {
        basePackage: readMetadata(repository.full_name, 'package.json', pullRequest.base.sha),
        headPackage: readMetadata(repository.full_name, 'package.json', run.head_sha),
        baseLock: readMetadata(repository.full_name, 'package-lock.json', pullRequest.base.sha),
        headLock: readMetadata(repository.full_name, 'package-lock.json', run.head_sha),
      };
      if (isReleasePrepReady({ ...candidate, metadata })) {
        appendFileSync(process.env.GITHUB_OUTPUT, `number=${number}\nsha=${run.head_sha}\n`);
      } else {
        console.log(`Skipping PR #${number}: package changes exceed release version updates.`);
      }
    }
  }
}

module.exports = { isReleasePrepReady };
