import type { GithubRepo } from "../coral/integrations/github.types.js";

function parseOwnerLogin(repo: GithubRepo): string {
  if (repo.owner) return repo.owner.toLowerCase();
  const full = repo.full_name ?? "";
  const slash = full.indexOf("/");
  return slash > 0 ? full.slice(0, slash).toLowerCase() : "";
}

/** Optional comma-separated owner logins (e.g. Manice18). */
function allowedOwnersFromEnv(): Set<string> | null {
  const raw = process.env.GITHUB_PROJECT_OWNERS?.trim();
  if (!raw) return null;
  const owners = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return owners.length > 0 ? new Set(owners) : null;
}

/**
 * Repos BuilderBrain should treat as "yours" for project memory / abandoned flows.
 * Excludes org cohort repos you can see but not push to (e.g. solana-turbin3/* with read-only access).
 */
export function isTrackableProjectRepo(repo: GithubRepo): boolean {
  if (repo.fork) return false;

  const allowed = allowedOwnersFromEnv();
  const owner = parseOwnerLogin(repo);
  if (allowed) {
    return owner.length > 0 && allowed.has(owner);
  }

  if (repo.owner_type === "User") return true;
  if (repo.permissions_admin === true) return true;

  return false;
}

export function filterTrackableRepos(repos: GithubRepo[]): GithubRepo[] {
  return repos.filter(isTrackableProjectRepo);
}
