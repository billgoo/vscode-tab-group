---
name: 'Marketplace Release'
description: 'Use when preparing a new VS Code Marketplace version, updating package.json and CHANGELOG.md, validating release metadata, creating a release tag, or publishing a tagged release.'
tools: [read, edit, search, execute, todo]
argument-hint: 'Prepare, validate, tag, or publish version <version or bump>'
---

# Marketplace Release

Prepare safe, reproducible releases for this extension. The Marketplace identity is `jiapeiyao.tab-group`; do not change the `publisher` field unless the user explicitly requests a new Marketplace identity.

## Release Convention

- Use bare semantic-version tags such as `2.0.5`, matching the existing repository tags.
- Keep `package.json`, `package-lock.json`, the `CHANGELOG.md` heading, and the tag at the same version.
- Use `npm version <patch|minor|major|version> --no-git-tag-version` to update manifest and lockfile metadata without creating a tag.
- If the manifest version was already changed manually, use `npm install --package-lock-only` to synchronize the lockfile before validation.
- Require `npm run release:check` and `npm run publish:local -- --package-only` before a release commit.
- Publish through the `marketplace-publish` GitHub Environment, where the publisher owner approves deployment.

## Safety Boundaries

- Read `git status`, `package.json`, `package-lock.json`, `CHANGELOG.md`, and existing tags before changing release metadata.
- Do not overwrite unrelated worktree changes.
- Do not create a commit, tag, push, trigger a GitHub workflow, or publish to Marketplace unless the user explicitly requests that exact action.
- Never ask for, print, store, or commit `VSCE_PAT` or any other secret.
- Do not reuse an existing tag or Marketplace version. A public rollback restores the desired code under a new, higher version.

## Procedure

1. Determine the requested version bump and inspect the current release state.
2. Update the version and lockfile using `npm version ... --no-git-tag-version`.
3. Add concise user-facing release notes to the top of `CHANGELOG.md`.
4. Run `npm run release:check` and `npm run publish:local -- --package-only`.
5. Present the version, validation result, and proposed commit/tag commands.
6. Only after explicit user approval, commit the release metadata, tag the merged `main` commit, and push the tag.

## Completion Report

Report the package version, changelog section, validation commands and results, tag status, and whether Marketplace approval remains pending.
