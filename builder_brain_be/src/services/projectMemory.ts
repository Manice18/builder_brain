import type { CoralClient } from "../coral/client.js";
import { createGithubIntegration } from "../coral/integrations/github.js";
import type { GithubRepo } from "../coral/integrations/github.types.js";
import { createNotionIntegration } from "../coral/integrations/notion.js";
import {
  asksForGithubNotionJoin,
  extractProjectFilterTerms,
  extractQueryTerms,
  extractRecentDaysWindow,
  hasExplicitActivityWindow,
} from "../intents/extractTerms.js";
import {
  inferNotionPageTitle,
  loadNotionPageIndex,
  notionPageLabel,
  notionPageSearchBlob,
  notionPagesMatchingRepo,
} from "./githubNotionJoin.js";
import { filterTrackableRepos } from "./githubRepoFilter.js";
import type { ProjectMemoryResult, ProjectMemoryRow } from "./projectMemory.types.js";

const STALE_DAYS_THRESHOLD = 28;

function daysSince(isoDate: string | undefined): number | undefined {
  if (!isoDate) return undefined;
  const then = Date.parse(isoDate);
  if (Number.isNaN(then)) return undefined;
  return Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
}

function parseOwnerRepo(fullName: string): { owner: string; repo: string } | null {
  const parts = fullName.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { owner: parts[0], repo: parts[1] };
}

function rowMatchesTerms(row: ProjectMemoryRow, terms: string[]): boolean {
  if (terms.length === 0) return true;
  const blob = [
    row.repo_name,
    row.full_name,
    row.description,
    ...row.notion_pages.map((p) => notionPageLabel(p)),
  ]
    .join(" ")
    .toLowerCase();
  return terms.some((t) => blob.includes(t));
}

async function enrichRepo(
  github: ReturnType<typeof createGithubIntegration>,
  repo: GithubRepo,
  notionPages: Awaited<ReturnType<typeof loadNotionPageIndex>>,
  fetchCommits: boolean,
): Promise<ProjectMemoryRow> {
  const notion_pages = notionPagesMatchingRepo(repo.name, notionPages);
  let last_activity = repo.pushed_at;
  let last_activity_source: "commit" | "push" = "push";
  let latest_commit_message: string | undefined;
  let stale_days = daysSince(repo.pushed_at);

  const coords =
    repo.full_name && parseOwnerRepo(repo.full_name)
      ? parseOwnerRepo(repo.full_name)!
      : repo.owner
        ? { owner: repo.owner, repo: repo.name }
        : null;

  if (coords && fetchCommits) {
    const commits = await github.getCommits(coords.owner, coords.repo, 3);
    const latest = commits[0];
    if (latest?.author_date) {
      last_activity = latest.author_date;
      last_activity_source = "commit";
      stale_days = daysSince(last_activity);
    }
    latest_commit_message = latest?.message;
  }

  const is_stale =
    stale_days !== undefined && stale_days >= STALE_DAYS_THRESHOLD;

  return {
    project_slug: repo.name.toLowerCase(),
    repo_name: repo.name,
    full_name: repo.full_name,
    html_url: repo.html_url,
    description: repo.description,
    last_activity,
    last_activity_source,
    pushed_at: repo.pushed_at,
    stale_days,
    is_stale,
    notion_pages,
    latest_commit_message,
  };
}

export type BuildProjectMemoryOptions = {
  message?: string;
  mode?: "overview" | "abandoned";
};

/**
 * Core read model: GitHub repos enriched with linked Notion pages.
 */
export async function buildProjectMemory(
  coral: CoralClient,
  options: BuildProjectMemoryOptions = {},
): Promise<ProjectMemoryResult> {
  const { message = "", mode = "overview" } = options;
  const terms = extractProjectFilterTerms(message);
  const linkOnly = asksForGithubNotionJoin(message);
  const github = createGithubIntegration(coral);
  const notion = createNotionIntegration(coral);

  const allRepos = filterTrackableRepos(await github.listUserRepos(100));
  const extraNotionQueries = [
    ...terms,
    ...(/ideas/i.test(message) && !terms.includes("ideas") ? ["ideas"] : []),
  ];
  const notionPages = await loadNotionPageIndex(
    notion,
    allRepos.map((r) => r.name),
    { extraQueries: extraNotionQueries },
  );

  const rows: ProjectMemoryRow[] = [];

  for (const repo of allRepos) {
    const notion_pages = notionPagesMatchingRepo(repo.name, notionPages);
    const shouldFetchCommits =
      mode === "abandoned" || notion_pages.length > 0;

    const row = await enrichRepo(
      github,
      repo,
      notionPages,
      shouldFetchCommits,
    );

    if (mode === "abandoned") {
      if (!row.is_stale || row.notion_pages.length === 0) continue;
    } else if (mode === "overview") {
      let notion_pages = row.notion_pages;

      if (linkOnly) {
        if (/ideas/i.test(message)) {
          notion_pages = notion_pages.filter((p) =>
            /ideas/i.test(notionPageLabel(p)),
          );
        }
        if (notion_pages.length === 0) continue;
        rows.push({ ...row, notion_pages });
        continue;
      }

      const linked = notion_pages.length > 0;
      const keywordHit = rowMatchesTerms(row, terms);
      if (!linked && !keywordHit) continue;
      if (terms.length > 0 && !keywordHit) continue;
    }

    rows.push(row);
  }

  rows.sort((a, b) => {
    if (mode === "abandoned") {
      return (b.stale_days ?? 0) - (a.stale_days ?? 0);
    }
    const aRecent = a.notion_pages[0]?.last_edited_time ?? "";
    const bRecent = b.notion_pages[0]?.last_edited_time ?? "";
    return bRecent.localeCompare(aRecent);
  });

  const sql = [
    `-- Project memory (${mode}): your GitHub repos + Notion cross-links`,
    `-- Repo scope: personal account or admin; excludes read-only org repos`,
    process.env.GITHUB_PROJECT_OWNERS
      ? `-- GITHUB_PROJECT_OWNERS: ${process.env.GITHUB_PROJECT_OWNERS}`
      : "",
    `-- Notion index: ${notionPages.length} page(s)`,
    terms.length > 0 ? `-- Query terms: ${terms.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    sql,
    rows: rows.slice(0, 30),
    notion_index_size: notionPages.length,
  };
}

export async function searchNotionForMessage(
  coral: CoralClient,
  message: string,
): Promise<{ sql: string; rows: unknown[] }> {
  const notion = createNotionIntegration(coral);
  const terms = extractQueryTerms(message);
  const seen = new Set<string>();
  const hits: unknown[] = [];

  for (const q of terms.slice(0, 4)) {
    const batch = await notion.searchObjects(q, "page");
    for (const hit of batch) {
      if (seen.has(hit.id)) continue;
      seen.add(hit.id);
      hits.push({
        object: hit.object,
        id: hit.id,
        url: hit.url,
        title: inferNotionPageTitle(hit),
        last_edited_time: hit.last_edited_time,
        matched_query: q,
        snippet: notionPageSearchBlob(hit).slice(0, 200),
      });
    }
  }

  if (hits.length === 0) {
    const visible = await notion.listVisible(25);
    for (const hit of visible) {
      hits.push({
        object: hit.object,
        id: hit.id,
        url: hit.url,
        title: inferNotionPageTitle(hit),
        last_edited_time: hit.last_edited_time,
      });
    }
  }

  const sql = [
    "-- Notion search via Coral",
    ...terms.map((q) => `notion.search_objects(query => '${q}', object => 'page')`),
  ].join("\n");

  return { sql, rows: hits };
}

function activityCutoffIso(windowDays: number): string {
  const ms = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}

function isOnOrAfter(isoDate: string | undefined, cutoffIso: string): boolean {
  if (!isoDate) return false;
  const t = Date.parse(isoDate);
  const c = Date.parse(cutoffIso);
  if (Number.isNaN(t) || Number.isNaN(c)) return false;
  return t >= c;
}

/** Repos you own/admin with recent commit or push activity. */
export async function listRecentGithubProjects(
  coral: CoralClient,
  message: string,
): Promise<{ sql: string; rows: unknown[] }> {
  const explicitWindow = hasExplicitActivityWindow(message);
  const windowDays = explicitWindow ? extractRecentDaysWindow(message) : undefined;
  const cutoffIso =
    windowDays != null ? activityCutoffIso(windowDays) : undefined;
  const github = createGithubIntegration(coral);
  const repos = filterTrackableRepos(await github.listUserRepos(100));
  const rows: unknown[] = [];
  const repoBatch = explicitWindow ? repos : repos.slice(0, 20);

  for (const repo of repoBatch) {
    const coords =
      repo.full_name && parseOwnerRepo(repo.full_name)
        ? parseOwnerRepo(repo.full_name)!
        : repo.owner
          ? { owner: repo.owner, repo: repo.name }
          : null;

    let latest_commit_message: string | undefined;
    let recent_commits: unknown[] = [];
    let latest_commit_date: string | undefined;

    const pushInWindow =
      cutoffIso == null ? true : isOnOrAfter(repo.pushed_at, cutoffIso);

    if (coords) {
      recent_commits = await github.getCommits(coords.owner, coords.repo, 5);
      const latest = recent_commits[0] as
        | { author_date?: string; message?: string }
        | undefined;
      latest_commit_date = latest?.author_date;
      latest_commit_message = latest?.message;
    }

    const commitInWindow =
      cutoffIso == null
        ? Boolean(latest_commit_date ?? repo.pushed_at)
        : isOnOrAfter(latest_commit_date, cutoffIso);

    if (explicitWindow && !pushInWindow && !commitInWindow) continue;

    const last_activity =
      [repo.pushed_at, latest_commit_date]
        .filter((d): d is string => Boolean(d))
        .sort()
        .at(-1) ?? repo.pushed_at;

    const last_activity_source =
      latest_commit_date &&
      (!repo.pushed_at || latest_commit_date >= repo.pushed_at)
        ? "commit"
        : "push";

    rows.push({
      repo_name: repo.name,
      full_name: repo.full_name,
      html_url: repo.html_url,
      description: repo.description,
      pushed_at: repo.pushed_at,
      last_activity,
      last_activity_source,
      latest_commit_message,
      active_within_days: windowDays,
      recent_commits: recent_commits.slice(0, 3),
    });
  }

  rows.sort((a, b) => {
    const aT = String((a as { last_activity?: string }).last_activity ?? "");
    const bT = String((b as { last_activity?: string }).last_activity ?? "");
    return bT.localeCompare(aT);
  });

  const sql = explicitWindow
    ? [
        `-- GitHub projects with activity in the last ${windowDays} day(s)`,
        `-- Cutoff (UTC): ${cutoffIso}`,
        `-- Scope: personal repos or repos you admin (read-only org repos excluded)`,
      ].join("\n")
    : [
        `-- Recent GitHub repo activity (latest ${Math.min(repoBatch.length, 15)} by last push/commit)`,
        `-- Scope: personal repos or repos you admin (read-only org repos excluded)`,
      ].join("\n");

  return { sql, rows: rows.slice(0, 15) };
}

export async function listRepoActivity(
  coral: CoralClient,
  message = "",
): Promise<{ sql: string; rows: unknown[] }> {
  return listRecentGithubProjects(coral, message);
}
