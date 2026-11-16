import { describe, expect, it } from '@jest/globals';
import {
  isReleasePrepReady,
  type ReleasePrepCandidate,
} from '../../.github/scripts/merge-release-prep';
import { readFileSync } from 'fs';
import { join } from 'path';

const candidate: ReleasePrepCandidate = {
  repository: 'billgoo/vscode-tab-group',
  run: {
    event: 'pull_request',
    conclusion: 'success',
    head_branch: 'release-prep/3.6.0',
    head_sha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    head_repository: { full_name: 'billgoo/vscode-tab-group' },
    pull_requests: [{ number: 126 }],
  },
  pullRequest: {
    number: 126,
    state: 'open',
    draft: false,
    changed_files: 3,
    user: { login: 'billgoo-tab-group-release[bot]' },
    head: {
      ref: 'release-prep/3.6.0',
      sha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      repo: { full_name: 'billgoo/vscode-tab-group' },
    },
    base: {
      ref: 'dev',
      sha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      repo: { full_name: 'billgoo/vscode-tab-group' },
    },
  },
  files: [
    { filename: 'package.json', status: 'modified' },
    { filename: 'package-lock.json', status: 'modified' },
    { filename: 'CHANGELOG.md', status: 'modified' },
  ],
  metadata: {
    basePackage: { version: '3.4.0', scripts: { test: 'jest' } },
    headPackage: { version: '3.6.0', scripts: { test: 'jest' } },
    baseLock: { version: '3.4.0', packages: { '': { version: '3.4.0' } } },
    headLock: { version: '3.6.0', packages: { '': { version: '3.6.0' } } },
  },
};

describe('release prep merge eligibility', () => {
  it('only requests a direct merge for the tested commit after successful CI', () => {
    const workflow = readFileSync(
      join(__dirname, '../../.github/workflows/merge-release-prep.yml'),
      'utf8',
    );
    expect(workflow).toMatch(/workflows: \[Validate Extension\]/);
    expect(workflow).toMatch(/github\.event\.workflow_run\.conclusion == 'success'/);
    expect(workflow).toMatch(/run: node \.github\/scripts\/merge-release-prep\.js/);
    expect(workflow).toMatch(/TESTED_SHA: \$\{\{ steps\.candidate\.outputs\.sha \}\}/);
    expect(workflow).toMatch(/-f sha="\$\{TESTED_SHA\}"/);
  });

  it('accepts a successful CI run for the current bot-created prep PR', () => {
    expect(isReleasePrepReady(candidate)).toBe(true);
  });

  it.each([
    { event: 'push' },
    { conclusion: 'failure' },
    { head_sha: 'outdated' },
    { head_sha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\nnumber=1' },
    { head_branch: 'feature/3.6.0' },
    { head_repository: { full_name: 'other/fork' } },
    { pull_requests: [] },
    { pull_requests: [{ number: 126 }, { number: 127 }] },
  ])('rejects an unrelated or stale CI run: %j', run => {
    expect(isReleasePrepReady({ ...candidate, run: { ...candidate.run, ...run } })).toBe(false);
  });

  it.each([
    { number: 127 },
    { state: 'closed' },
    { draft: true },
    { changed_files: 4 },
    { user: { login: 'other[bot]' } },
    { head: { ...candidate.pullRequest.head, sha: 'new-head' } },
    { head: { ...candidate.pullRequest.head, ref: 'release-prep/not-a-version' } },
    { head: { ...candidate.pullRequest.head, repo: { full_name: 'other/fork' } } },
    { base: { ...candidate.pullRequest.base, ref: 'main' } },
    { base: { ...candidate.pullRequest.base, repo: { full_name: 'other/repo' } } },
  ])('rejects an untrusted or changed pull request: %j', pullRequest => {
    expect(
      isReleasePrepReady({
        ...candidate,
        pullRequest: { ...candidate.pullRequest, ...pullRequest },
      }),
    ).toBe(false);
  });

  it.each([
    { files: [] },
    { files: [{ filename: '.github/workflows/ci.yml', status: 'modified' }] },
    { files: [{ filename: 'package.json', status: 'removed' }] },
    { files: [{ filename: 'package.json', status: 'renamed' }] },
  ])('rejects unexpected or missing release metadata changes: %j', ({ files }) => {
    expect(
      isReleasePrepReady({
        ...candidate,
        pullRequest: { ...candidate.pullRequest, changed_files: files.length },
        files,
      }),
    ).toBe(false);
  });

  it('rejects package changes beyond the selected version', () => {
    expect(
      isReleasePrepReady({
        ...candidate,
        metadata: {
          ...candidate.metadata,
          headPackage: { version: '3.6.0', scripts: { test: 'true' } },
        },
      }),
    ).toBe(false);
  });

  it('rejects a lockfile whose root version differs from the release branch', () => {
    expect(
      isReleasePrepReady({
        ...candidate,
        metadata: {
          ...candidate.metadata,
          headLock: { version: '3.6.0', packages: { '': { version: '3.4.0' } } },
        },
      }),
    ).toBe(false);
  });

  it('rejects lockfile changes beyond the release version', () => {
    expect(
      isReleasePrepReady({
        ...candidate,
        metadata: {
          ...candidate.metadata,
          headLock: {
            version: '3.6.0',
            packages: { '': { version: '3.6.0' }, 'node_modules/extra': { version: '1.0.0' } },
          },
        },
      }),
    ).toBe(false);
  });
});
