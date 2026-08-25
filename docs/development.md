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

See [testing.md](testing.md) for the automated-check matrix and manual acceptance checklist.

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

4. Pushing a `v*` tag starts `.github/workflows/release.yml`. The workflow verifies that the tag matches `package.json`, runs validation, builds the VSIX, and uploads it as a workflow artifact. Marketplace publishing then waits for approval through the `marketplace-publish` GitHub environment before it publishes that exact package.

### Marketplace Approval

GitHub Environment reviewers are repository settings, not workflow YAML. After this workflow is merged into the default branch, configure the one-time approval gate:

1. Open the repository **Settings** -> **Environments** -> **New environment**.
2. Create `marketplace-publish`.
3. Enable **Required reviewers** and add the repository owner, `@billgoo` (Bill Gu).
4. Add `VSCE_PAT` as an environment secret named `VSCE_PAT`, then remove any repository-level secret with the same name. This keeps the token unavailable until the deployment is approved.

The publisher owner must approve each Marketplace publication from the workflow's **Review deployments** prompt.

### Tagged Recovery And Rollback

Use **Actions** -> **Publish Tagged Release** -> **Run workflow** to validate and package an existing tag. Enter the exact `vX.Y.Z` tag and leave **Publish the selected tag** disabled to obtain a reviewable VSIX artifact.

Marketplace versions are immutable and VS Code clients do not downgrade to an older version. To roll back the public extension, restore the desired tag's code on a new release commit, increment `package.json` to a version higher than the current Marketplace version, create a matching new tag, and publish that new tag. Enable the manual **Publish the selected tag** option only when recovering a tag that has not already been published.

For a local release, set `VSCE_PAT` in the environment and run `npm run publish:local`. The script runs linting, unit tests, the extension-host test, and packaging before publishing the exact `tab-group-<package-version>.vsix`. `vsce` reads `VSCE_PAT` from the environment.

To run the same checks and create the VSIX without publishing, use:

```bash
npm run publish:local -- --package-only
```

If the local VS Code download is unavailable, `--skip-e2e` can be combined with `--package-only` for package validation. Do not use it as a substitute for the required extension-host check in CI or the tag-based release workflow.

The configured `publisher` must already exist in the Visual Studio Marketplace and have permission to publish `jiapeiyao.tab-group`. Rotate `VSCE_PAT` regularly; migrate the release process to Microsoft Entra workload identity before Azure DevOps global PAT retirement in December 2026.
