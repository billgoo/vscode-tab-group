export function resolvePrereleaseVersion(stableVersion: string, existingTags?: string[]): string;

export function preparePrereleaseChangelog(
  changelog: string,
  version: string,
  stableVersion: string,
  notes: string,
): string;
