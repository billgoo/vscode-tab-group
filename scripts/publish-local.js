const { spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const { resolve } = require('node:path');

const projectRoot = resolve(__dirname, '..');
const packageJson = require(resolve(projectRoot, 'package.json'));
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const vsceCommand = process.platform === 'win32' ? 'vsce.cmd' : 'vsce';
const vsixPath = resolve(projectRoot, `tab-group-${packageJson.version}.vsix`);
const options = new Set(process.argv.slice(2));
const skipE2e = options.delete('--skip-e2e');
const packageOnly = options.delete('--package-only');

if (options.size > 0) {
  throw new Error(`Unknown option: ${[...options][0]}`);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const validationScripts = ['lint', 'test:unit'];

if (!skipE2e) {
  validationScripts.push('test:e2e');
}

validationScripts.push('package');

for (const script of validationScripts) {
  run(npmCommand, ['run', script]);
}

if (!existsSync(vsixPath)) {
  throw new Error(`Expected packaged extension at ${vsixPath}.`);
}

if (packageOnly) {
  console.log(`Package created at ${vsixPath}.`);
  process.exit(0);
}

if (!process.env.VSCE_PAT) {
  throw new Error('VSCE_PAT must be set before publishing to the Marketplace.');
}

run(vsceCommand, ['publish', '--packagePath', vsixPath]);
