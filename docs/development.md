# Development and Release

## Local validation

Use Node.js 20 or newer. Install dependencies from the committed lockfile and run the same checks as CI:

```bash
npm ci
npm run lint
npm run compile
npm run test:unit
npm run test:e2e
```

`test:unit` validates the grouping model without VS Code. `test:e2e` uses the locally installed VS Code application on macOS, then activates the extension and verifies its public commands are registered. Set `VSCODE_TEST_EXECUTABLE` to use a local executable on another platform. In CI it downloads and starts a clean VS Code Extension Development Host. Set `VSCODE_TEST_DOWNLOAD=true` to use the downloaded runtime locally. On headless Linux, run it through `xvfb-run -a npm run test:e2e`.

## Packaging

Run `npm run package` to compile the extension and create an installable `.vsix`. Install that file with **Extensions: Install from VSIX...** for manual acceptance testing. The package excludes source, test, CI, and development-only files through `.vscodeignore`.

## Continuous Integration

`.github/workflows/ci.yml` runs lint, unit tests, extension-host tests, and packaging on Ubuntu, macOS, and Windows for pull requests and pushes to `main`. The Ubuntu job uploads the built VSIX as a workflow artifact.

## Marketplace Release

1. Update the version in `package.json` and `CHANGELOG.md`.
2. Verify `npm ci && npm run test:all && npm run package` locally.
3. Commit the release changes, create an annotated matching version tag, and push it:

   ```bash
   git tag -a v<package-version> -m "v<package-version>"
   git push origin v<package-version>
   ```

4. Pushing a `v*` tag starts `.github/workflows/release.yml`. The workflow verifies that the tag matches `package.json`, runs validation, builds the VSIX, uploads it as a workflow artifact, and publishes that exact package to the Marketplace.

For a local release, set `VSCE_PAT` in the environment and run `npm run publish:local`. The script runs linting, unit tests, the extension-host test, and packaging before publishing the exact `tab-group-<package-version>.vsix`. `vsce` reads `VSCE_PAT` from the environment.

To run the same checks and create the VSIX without publishing, use:

```bash
npm run publish:local -- --package-only
```

If the local VS Code download is unavailable, `--skip-e2e` can be combined with `--package-only` for package validation. Do not use it as a substitute for the required extension-host check in CI or the tag-based release workflow.

The configured `publisher` must already exist in the Visual Studio Marketplace and have permission to publish `jiapeiyao.tab-group`. Rotate `VSCE_PAT` regularly; migrate the release process to Microsoft Entra workload identity before Azure DevOps global PAT retirement in December 2026.
