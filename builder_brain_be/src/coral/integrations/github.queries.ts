import { sqlLiteral } from "../sql.js";

export const githubQueries = {
  connectionStatus: () => `
    SELECT key, is_set
    FROM coral.inputs
    WHERE schema_name = 'github'
  `,

  staleUserReposByPush: (cutoffIso: string, limit = 50) => `
    SELECT
      name AS repo_name,
      full_name,
      html_url,
      description,
      pushed_at AS last_activity,
      updated_at
    FROM github.user_repos
    WHERE pushed_at < ${sqlLiteral(cutoffIso)}
    ORDER BY pushed_at ASC
    LIMIT ${Math.min(limit, 100)}
  `,

  userRepos: (limit = 50) => `
    SELECT
      name,
      full_name,
      owner__login,
      owner__type,
      description,
      html_url,
      created_at,
      updated_at,
      pushed_at,
      private,
      archived,
      fork,
      permissions__admin,
      permissions__push
    FROM github.user_repos
    ORDER BY pushed_at DESC
    LIMIT ${Math.min(limit, 100)}
  `,

  commits: (owner: string, repo: string, limit = 30) => `
    SELECT
      sha,
      commit__message,
      commit__author__date,
      author__login
    FROM github.commits
    WHERE owner = ${sqlLiteral(owner)}
      AND repo = ${sqlLiteral(repo)}
    LIMIT ${Math.min(limit, 100)}
  `,

  searchRepositories: (query: string) => `
    SELECT
      full_name,
      html_url,
      description,
      language,
      stargazers_count,
      updated_at,
      score
    FROM github.search_repositories(q => ${sqlLiteral(query)})
    LIMIT 20
  `,

  searchIssues: (query: string) => `
    SELECT
      title,
      html_url,
      state,
      number,
      repository_url,
      score
    FROM github.search_issues(q => ${sqlLiteral(query)})
    LIMIT 20
  `,

  assignedIssues: (state?: "open" | "closed") => {
    const filters = state ? `WHERE state = ${sqlLiteral(state)}` : "";
    return `
      SELECT title, html_url, state, number, repository_url
      FROM github.issues
      ${filters}
      LIMIT 50
    `;
  },

  repoIssues: (
    owner: string,
    repo: string,
    state: "open" | "closed" | "all" = "open",
    limit = 30,
  ) => {
    const filters = [
      `owner = ${sqlLiteral(owner)}`,
      `repo = ${sqlLiteral(repo)}`,
    ];
    if (state !== "all") {
      filters.push(`state = ${sqlLiteral(state)}`);
    }
    return `
      SELECT
        number,
        title,
        state,
        html_url,
        body,
        created_at,
        updated_at,
        comments,
        labels,
        assignee__login
      FROM github.issues
      WHERE ${filters.join(" AND ")}
      ORDER BY updated_at DESC
      LIMIT ${Math.min(limit, 100)}
    `;
  },
};
