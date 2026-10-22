interface ReleasePreparationInput {
  stableVersion: string;
  devPackage: { version: string };
  devLock: {
    version?: string;
    packages?: Record<string, { version?: string } | undefined>;
  };
  changelog: string;
  existingTags: Set<string>;
}

export function resolveReleasePreparation(input: ReleasePreparationInput): {
  version: string;
  shouldPrepare: boolean;
};
