const { defineConfig } = require('@vscode/test-cli');
const { existsSync } = require('node:fs');

const macOSCodeExecutable = '/Applications/Visual Studio Code.app/Contents/MacOS/Code';
const localCodeExecutable =
  process.env.VSCODE_TEST_EXECUTABLE ??
  (process.platform === 'darwin' && existsSync(macOSCodeExecutable)
    ? macOSCodeExecutable
    : undefined);
const useLocalCode = !process.env.CI && process.env.VSCODE_TEST_DOWNLOAD !== 'true';

module.exports = defineConfig({
  files: 'out/test/e2e/**/*.test.js',
  workspaceFolder: __dirname,
  download: {
    timeout: 120000,
  },
  useInstallation:
    useLocalCode && localCodeExecutable ? { fromPath: localCodeExecutable } : undefined,
  launchArgs: ['--disable-extensions'],
  mocha: {
    ui: 'tdd',
    timeout: 30000,
  },
});
