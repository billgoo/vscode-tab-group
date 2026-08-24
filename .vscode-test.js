const { defineConfig } = require('@vscode/test-cli');

module.exports = defineConfig({
  files: 'out/test/e2e/**/*.test.js',
  mocha: {
    ui: 'tdd',
    timeout: 30000,
  },
});
