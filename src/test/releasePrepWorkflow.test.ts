import { describe, expect, it } from '@jest/globals';
import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const workflow = readFileSync(join(__dirname, '../../.github/workflows/release-prep.yml'), 'utf8');

describe('release preparation checkout', () => {
  it.each([false, true])('uses dev as the working base when the prep branch exists: %s', exists => {
    const directory = mkdtempSync(join(tmpdir(), 'release-prep-test-'));
    const git = (...args: string[]) =>
      execFileSync('git', args, { cwd: directory, encoding: 'utf8', stdio: 'pipe' }).trim();

    try {
      git('init', '-b', 'main');
      git('config', 'user.name', 'Release Test');
      git('config', 'user.email', 'release-test@example.com');
      writeFileSync(join(directory, 'metadata'), 'main');
      git('add', 'metadata');
      git('commit', '-m', 'main');
      writeFileSync(join(directory, 'metadata'), 'dev');
      git('commit', '-am', 'dev');
      const devCommit = git('rev-parse', 'HEAD');
      git('update-ref', 'refs/remotes/origin/dev', devCommit);
      if (exists) {
        git('update-ref', 'refs/remotes/origin/release-prep/3.6.0', git('rev-parse', 'HEAD^'));
      }

      const checkout = workflow.match(/^\s*(git checkout -B .+)$/m)?.[1];
      if (!checkout) {
        throw new Error('Release preparation checkout command not found');
      }
      execFileSync('bash', ['-e', '-c', checkout], {
        cwd: directory,
        env: { ...process.env, RELEASE_VERSION: '3.6.0' },
        stdio: 'pipe',
      });

      expect(git('branch', '--show-current')).toBe('dev');
      expect(git('rev-parse', 'HEAD')).toBe(devCommit);
      expect(workflow).toMatch(
        /branch: release-prep\/\$\{\{ steps\.metadata\.outputs\.version \}\}/,
      );
      expect(workflow).toMatch(/base: dev/);
      expect(
        git('for-each-ref', '--format=%(refname)', 'refs/remotes/origin/release-prep/3.6.0') !== '',
      ).toBe(exists);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
