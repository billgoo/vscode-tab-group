interface ReleaseMetadataInput {
  version: string;
  packageJson: { version?: string };
  packageLock: {
    version?: string;
    packages?: Record<string, { version?: string } | undefined>;
  };
  changelog: string;
  requireStableVersion?: boolean;
}

export function getReleaseMetadataErrors(input: ReleaseMetadataInput): string[];
export function hasNonEmptyChangelogSection(changelog: string, version: string): boolean;
