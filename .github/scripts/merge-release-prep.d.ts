export interface ReleasePrepCandidate {
  repository: string;
  run: {
    event: string;
    conclusion: string;
    head_branch: string;
    head_sha: string;
    head_repository: { full_name: string };
    pull_requests: { number: number }[];
  };
  pullRequest: {
    number: number;
    state: string;
    draft: boolean;
    changed_files: number;
    user: { login: string };
    head: { ref: string; sha: string; repo: { full_name: string } };
    base: { ref: string; sha: string; repo: { full_name: string } };
  };
  files: { filename: string; status: string }[];
  metadata: {
    basePackage: { version?: string; [key: string]: unknown };
    headPackage: { version?: string; [key: string]: unknown };
    baseLock: {
      version?: string;
      packages?: Record<string, { version?: string; [key: string]: unknown }>;
      [key: string]: unknown;
    };
    headLock: {
      version?: string;
      packages?: Record<string, { version?: string; [key: string]: unknown }>;
      [key: string]: unknown;
    };
  };
}

export function isReleasePrepReady(candidate: ReleasePrepCandidate): boolean;
