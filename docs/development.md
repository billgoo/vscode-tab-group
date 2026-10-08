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

Running `npm ci` or `npm install` also installs the Husky pre-commit hook. The hook runs `npm run pre-commit`, which checks linting, unit tests, and strict TypeScript compilation. Run that script directly to reproduce the commit-time validation.

`test:unit` validates grouping, manual sorting, URI sorting, all-container tab sorting, group-name sorting, saved-group name sorting, saved-group persistence, and filtering of live-only tabs from saved snapshots without VS Code. `test:e2e` uses the locally installed VS Code application on macOS, then activates the extension and verifies public commands, List/Tree view switching, active grouped-tab selection synchronization with targeted group and folder-path expansion, derived workspace-relative root and grouped folder trees, direct handling of external resource tabs, Recent Tabs, the default-collapsed expandable Saved Groups panel and its expand/collapse and sort toolbar actions, root URI sorting across root and grouped tabs, visible-label group-name sorting, independent root and group direction controls, full-URI supported-tab identity, saved-tab descriptor capture, complete and partial text-tab restoration, input-less system-tab listing and mixed snapshot filtering, and webview and terminal-input rejection. Set `VSCODE_TEST_EXECUTABLE` to use a local executable on another platform. In CI it downloads and starts a clean VS Code Extension Development Host. Set `VSCODE_TEST_DOWNLOAD=true` to use the downloaded runtime locally. On headless Linux, run it through `xvfb-run -a npm run test:e2e`.

See [testing.md](testing.md) for the automated-check matrix and manual acceptance checklist.

## Group Command IDs

- `tabsTreeView.tab.close` closes the selected tab or live group from the Tabs or Recent Tabs view when invoked without an explicit item.
- `tabsTreeView.tab.removeFromGroup` removes a tab from its group.
- `tabsTreeView.group.ungroup` dissolves a group while leaving its tabs open.

The previous IDs, `tabsTreeView.tab.ungroup` and `tabsTreeView.group.cancelGroup`, remain registered as compatibility aliases but are not contributed to menus. New integrations should use the IDs above. Internal methods use `removeFromGroup` (one tab), `removeTabsFromGroup` (multiple tabs), and `ungroup` (a whole group).

## Packaging

Run `npm run package` to compile the extension and create an installable `.vsix`. Install that file with **Extensions: Install from VSIX...** for manual acceptance testing. The package excludes source, test, CI, and development-only files through `.vscodeignore`.

## Continuous Integration

`.github/workflows/ci.yml` runs lint, unit tests, extension-host tests, and packaging on Ubuntu, macOS, and Windows for pull requests and pushes to `main`. The Ubuntu job uploads the built VSIX as a workflow artifact. Stable release tags use numeric `X.Y.Z` or `vX.Y.Z` names; namespaced `pre-release/` tags do not start the stable workflow.

## Development Pre-releases

Use a long-lived `dev` branch as the integration target for feature work. Open pull requests against `dev`; the regular CI workflow validates pull requests, and each push to `dev` runs `.github/workflows/pre-release.yml`. That workflow reruns lint, unit and extension-host tests, packages the extension as a Marketplace pre-release, publishes it, and creates a GitHub pre-release containing the VSIX. GitHub releases use a namespaced `pre-release/<version>` tag and a `<version> (Pre-release)` title, for example `pre-release/3.3.54` and `3.3.54 (Pre-release)`.

VS Code Marketplace pre-release packages require plain `major.minor.patch` versions; SemVer suffixes such as `-beta.1` are not supported. The `--pre-release` publish flag marks the Marketplace package as a pre-release. Following VS Code's recommended version ordering, stable releases use an even minor number and pre-releases use the next odd minor number. The pre-release patch increments from existing `pre-release/<version>` tags in that odd-minor lane and starts at `.1` when there are no tags. For example, stable `3.2.1` starts previews at `3.3.1`; with the already-published `pre-release/3.3.4`, the next preview is `3.3.5`. Promotion prepares stable `3.4.0`, and previews after that stable release start at `3.5.1`. Preview numbering comes from fetched Git tags, not the workflow's total run number. The pre-release workflow derives its version from `main` and adds generated notes to the packaged `CHANGELOG.md`; it does not commit those preview changes.

## Automated Stable Promotion

Open a pull request from `dev` to `main` when the changes are ready for stable promotion. `.github/workflows/release-prep.yml` calculates the next even-minor stable version from `main` by advancing the minor number by two and setting the patch to `.0`, updates `package.json` and `package-lock.json`, and promotes the existing `Unreleased` changelog notes into a versioned section. If `Unreleased` has no bullet entries, it uses generated notes since the latest stable tag. The workflow opens or updates a `release-prep/<version>` pull request into `dev` and enables auto-merge; that PR still has to pass CI. Its merge updates the open `dev` to `main` pull request, whose checks rerun. Opening, reviewing, and merging the promotion PR remain human actions.

After that promotion PR is merged, `.github/workflows/tag-promoted-release.yml` validates the package and changelog metadata and pushes a matching stable version tag to the merged commit. The tag starts `.github/workflows/release.yml`, which builds the VSIX and creates the GitHub Release. Publishing to the Marketplace still waits for human approval in `marketplace-publish`.

One-time repository setup:

- Install a GitHub App on this repository with **Contents: read and write** and **Pull requests: read and write**. Add `RELEASE_APP_ID` and `RELEASE_APP_PRIVATE_KEY` as repository Actions secrets. The App creates the release-prep PR and pushes the stable tag so the resulting GitHub events start their workflows.
- Enable **Allow auto-merge** in repository settings.
- Split the branch rules so `dev` requires a pull request and the passing, up-to-date `ubuntu-latest`, `macos-latest`, and `windows-latest` checks, but requires no approving review. Keep deletion and force-push protection. This lets the release-prep PR auto-merge without a bypass.
- Keep `main` protected by a pull request, one approval, the same required checks, and the additional `stable-release-prep` status check. Enable stale-approval dismissal and resolved review conversations so the release-prep commit must be reviewed. Repository administrators retain their configured bypass.
- Keep `marketplace-prerelease` restricted to `dev` with `VSCE_PAT` and no required reviewers. Keep `marketplace-publish` approval-gated.

The PR from `dev` to `main` is the release-intent signal; release-prep is not opened for every feature PR merged into `dev`. If that promotion PR is closed without merging, its release-prep PR should also be closed or abandoned before starting a different promotion.

### Testing the Automation

Run the focused helper test and the project checks locally:

```bash
npm run test:unit -- --runInBand src/test/prepareRelease.test.ts
npm run lint
npm run compile
npm test
actionlint .github/workflows/release-prep.yml .github/workflows/tag-promoted-release.yml
```

End-to-end testing requires the GitHub App, auto-merge, and ruleset settings above. Use a dedicated test repository or non-production Marketplace credentials: merging the prep PR into `dev` triggers the Marketplace pre-release workflow.

## Dependency Updates

Dependabot is configured in [.github/dependabot.yml](../.github/dependabot.yml) to open weekly grouped updates for npm dependencies and GitHub Actions. A repository administrator must enable **Dependabot version updates** under **Settings** -> **Code security and analysis** for these configured updates to run.

## Marketplace Release

The automated `dev` to `main` promotion flow above is the normal stable-release path. Use the manual procedure below for standalone hotfixes or recovery releases that do not come through `dev`.

1. Choose the next semantic version. This repository uses bare version tags such as `2.0.5`.
2. Update `package.json` and `package-lock.json` without creating a tag:

   ```bash
   npm version patch --no-git-tag-version
   ```

   Replace `patch` with `minor`, `major`, or an explicit version when appropriate.
   If `package.json` was already edited manually, synchronize the lockfile instead:

   ```bash
   npm install --package-lock-only
   ```

3. Add a non-empty `## <package-version>` section at the top of `CHANGELOG.md`, using the existing Enhancements and Fix bugs style where applicable.
4. Run the release metadata guard and the full local release gate:

   ```bash
   npm run release:check
   npm run publish:local -- --package-only
   ```

5. Commit the release changes and merge them to `main`.

6. Create the GitHub Release for the matching tag:

   1. Open the repository **Releases** page and select **Draft a new release**.
   2. Enter `<package-version>` as the tag, create the tag from `main`, and use the same value as the release title.
   3. Add the release notes and select **Publish release**.

   Publishing the GitHub Release creates the tag and starts `.github/workflows/release.yml`. After validation, the workflow attaches the generated `tab-group-<package-version>.vsix` to that GitHub Release and retains the same file as an Actions artifact.

   A tag pushed from Git also starts the workflow; when no GitHub Release exists yet, the workflow creates one and attaches the VSIX:

   ```bash
   git checkout main
   git pull --ff-only origin main
   git tag -a <package-version> -m "<package-version>"
   git push origin <package-version>
   ```

7. The workflow accepts semantic version tags such as `2.0.5` and also accepts an optional `v` prefix. It verifies that the tag matches `package.json`, runs validation, builds the VSIX, attaches it to the GitHub Release, and uploads it as a workflow artifact. Marketplace publishing then waits for approval through the `marketplace-publish` GitHub environment before it publishes that exact package.

### Marketplace Approval

GitHub Environment reviewers are repository settings, not workflow YAML. After this workflow is merged into the default branch, configure the one-time approval gate:

1. Open the repository **Settings** -> **Environments** -> **New environment**.
2. Create `marketplace-publish`.
3. Enable **Required reviewers** and add the repository owner, `@billgoo` (Bill Gu).
4. Add `VSCE_PAT` as an environment secret named `VSCE_PAT`, then remove any repository-level secret with the same name. This keeps the token unavailable until the deployment is approved.

The publisher owner must approve each Marketplace publication from the workflow's **Review deployments** prompt.

### Tagged Recovery And Rollback

Use **Actions** -> **Publish Tagged Release** -> **Run workflow** to validate and package an existing tag. Enter the exact `X.Y.Z` or `vX.Y.Z` tag and leave **Publish the selected tag** disabled to obtain a reviewable VSIX artifact.

Marketplace versions are immutable and VS Code clients do not downgrade to an older version. To roll back the public extension, restore the desired tag's code on a new release commit, increment `package.json` to a version higher than the current Marketplace version, create a matching new tag, and publish that new tag. Enable the manual **Publish the selected tag** option only when recovering a tag that has not already been published.

For a local release, set `VSCE_PAT` in the environment and run `npm run publish:local`. The script runs linting, unit tests, the extension-host test, and packaging before publishing the exact `tab-group-<package-version>.vsix`. `vsce` reads `VSCE_PAT` from the environment.

To run the same checks and create the VSIX without publishing, use:

```bash
npm run publish:local -- --package-only
```

If the local VS Code download is unavailable, `--skip-e2e` can be combined with `--package-only` for package validation. Do not use it as a substitute for the required extension-host check in CI or the tag-based release workflow.

The configured `publisher` must already exist in the Visual Studio Marketplace and have permission to publish `jiapeiyao.tab-group`. Rotate `VSCE_PAT` regularly; migrate the release process to Microsoft Entra workload identity before Azure DevOps global PAT retirement in December 2026.
