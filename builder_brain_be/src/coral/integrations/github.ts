import type { CoralClient } from "../client.js";
import { githubQueries } from "./github.queries.js";
import type {
  GithubCommit,
  GithubConnectionStatus,
  GithubIssue,
  GithubRepo,
  RepoIssuesContext,
} from "./github.types.js";

type RepoRef = { owner: string; repo: string };

function asRecord(row: unknown): Record<string, unknown> {
  return typeof row === "object" && row !== null
    ? (row as Record<string, unknown>)
    : {};
}

function parseOwnerRepo(fullName: string): { owner: string; repo: string } | null {
  const parts = fullName.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { owner: parts[0], repo: parts[1] };
}

function mapRepo(row: unknown): GithubRepo {
  const r = asRecord(row);
  return {
    name: String(r.name ?? ""),
    full_name: r.full_name != null ? String(r.full_name) : undefined,
    owner:
      r.owner__login != null
        ? String(r.owner__login)
        : r.owner != null
          ? String(r.owner)
          : undefined,
    description: r.description != null ? String(r.description) : undefined,
    html_url: r.html_url != null ? String(r.html_url) : undefined,
    created_at: r.created_at != null ? String(r.created_at) : undefined,
    updated_at: r.updated_at != null ? String(r.updated_at) : undefined,
    pushed_at: r.pushed_at != null ? String(r.pushed_at) : undefined,
    private: r.private === true,
    archived: r.archived === true,
    owner_type:
      r.owner__type === "User" || r.owner__type === "Organization"
        ? r.owner__type
        : undefined,
    fork: r.fork === true,
    permissions_admin: r.permissions__admin === true,
    permissions_push: r.permissions__push === true,
  };
}

function mapCommit(row: unknown): GithubCommit {
  const r = asRecord(row);
  return {
    sha: r.sha != null ? String(r.sha) : undefined,
    message:
      r.commit__message != null ? String(r.commit__message) : undefined,
    author_date:
      r.commit__author__date != null
        ? String(r.commit__author__date)
        : undefined,
    author_login:
      r.author__login != null ? String(r.author__login) : undefined,
  };
}

function mapIssue(row: unknown): GithubIssue {
  const r = asRecord(row);
  return {
    title: r.title != null ? String(r.title) : undefined,
    html_url: r.html_url != null ? String(r.html_url) : undefined,
    state: r.state != null ? String(r.state) : undefined,
    number: typeof r.number === "number" ? r.number : undefined,
    repository_url:
      r.repository_url != null ? String(r.repository_url) : undefined,
    body: r.body != null ? String(r.body) : undefined,
    created_at: r.created_at != null ? String(r.created_at) : undefined,
    updated_at: r.updated_at != null ? String(r.updated_at) : undefined,
    comments: typeof r.comments === "number" ? r.comments : undefined,
    labels: r.labels,
    assignee_login:
      r.assignee__login != null ? String(r.assignee__login) : undefined,
  };
}

/**
 * GitHub read integration via Coral SQL.
 * Token is configured in Coral (`coral source add github`), not in BuilderBrain.
 */
export class GithubIntegration {
  constructor(private readonly coral: CoralClient) {}

  async getConnectionStatus(): Promise<GithubConnectionStatus> {
    const { rows } = await this.coral.sql(githubQueries.connectionStatus());
    const inputs = (rows ?? []).map((row) => {
      const r = asRecord(row);
      return {
        key: String(r.key ?? ""),
        is_set: r.is_set === true,
      };
    });
    const configured = inputs.some(
      (i) => i.key === "GITHUB_TOKEN" && i.is_set,
    );
    return { schema: "github", configured, inputs };
  }

  async listUserRepos(limit = 50): Promise<GithubRepo[]> {
    const { rows } = await this.coral.sql(githubQueries.userRepos(limit));
    return (rows ?? []).map(mapRepo);
  }

  async getCommits(
    owner: string,
    repo: string,
    limit = 30,
  ): Promise<GithubCommit[]> {
    try {
      const { rows } = await this.coral.sql(
        githubQueries.commits(owner, repo, limit),
      );
      return (rows ?? []).map(mapCommit);
    } catch (error) {
      if (isEmptyOrUnavailableRepoError(error)) return [];
      throw error;
    }
  }

  async searchRepositories(query: string): Promise<GithubRepo[]> {
    const { rows } = await this.coral.sql(
      githubQueries.searchRepositories(query),
    );
    return (rows ?? []).map((row) => {
      const r = asRecord(row);
      const full_name = r.full_name != null ? String(r.full_name) : "";
      const parsed = parseOwnerRepo(full_name);
      return {
        name: parsed?.repo ?? full_name,
        full_name: full_name || undefined,
        owner: parsed?.owner,
        description:
          r.description != null ? String(r.description) : undefined,
        html_url: r.html_url != null ? String(r.html_url) : undefined,
        updated_at: r.updated_at != null ? String(r.updated_at) : undefined,
      };
    });
  }

  async searchIssues(query: string): Promise<GithubIssue[]> {
    const { rows } = await this.coral.sql(githubQueries.searchIssues(query));
    return (rows ?? []).map(mapIssue);
  }

  async listAssignedIssues(state?: "open" | "closed"): Promise<GithubIssue[]> {
    const { rows } = await this.coral.sql(githubQueries.assignedIssues(state));
    return (rows ?? []).map(mapIssue);
  }

  async getRepoIssues(
    owner: string,
    repo: string,
    state: "open" | "closed" | "all" = "open",
    limit = 30,
  ): Promise<GithubIssue[]> {
    const { rows } = await this.coral.sql(
      githubQueries.repoIssues(owner, repo, state, limit),
    );
    return (rows ?? []).map(mapIssue);
  }

  async resolveRepoOwner(repo: string, hintOwner?: string): Promise<RepoRef> {
    if (hintOwner) {
      return { owner: hintOwner, repo };
    }
    const all = await this.listUserRepos(100);
    const match = all.find((r) => r.name.toLowerCase() === repo.toLowerCase());
    if (match?.owner) {
      return { owner: match.owner, repo: match.name };
    }
    if (match?.full_name) {
      const parsed = parseOwnerRepo(match.full_name);
      if (parsed) return parsed;
    }
    throw new Error(`Could not resolve GitHub owner for repo: ${repo}`);
  }

  async getRepoIssuesContext(
    owner: string,
    repo: string,
    state: "open" | "closed" | "all" = "open",
  ): Promise<RepoIssuesContext> {
    const issues = await this.getRepoIssues(owner, repo, state);
    const repos = await this.listUserRepos(100);
    const meta = repos.find(
      (r) =>
        r.name.toLowerCase() === repo.toLowerCase() &&
        (!r.owner || r.owner.toLowerCase() === owner.toLowerCase()),
    );

    return {
      owner,
      repo,
      full_name: `${owner}/${repo}`,
      html_url: meta?.html_url ?? `https://github.com/${owner}/${repo}`,
      state_filter: state,
      open_issues: issues,
    };
  }
}

function isEmptyOrUnavailableRepoError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    /409/.test(message) &&
    (/empty/i.test(message) || /Git Repository is empty/i.test(message))
  );
}

export function createGithubIntegration(coral: CoralClient): GithubIntegration {
  return new GithubIntegration(coral);
}
