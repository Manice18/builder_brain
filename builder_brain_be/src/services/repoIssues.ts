import type { CoralClient } from "../coral/client.js";
import { githubQueries } from "../coral/integrations/github.queries.js";
import { createGithubIntegration } from "../coral/integrations/github.js";
import { createNotionIntegration } from "../coral/integrations/notion.js";
import { extractRepoFromMessage } from "../intents/extractRepo.js";
import {
  loadNotionPageIndex,
  notionPagesMatchingRepo,
} from "./githubNotionJoin.js";

function parseIssueState(message: string): "open" | "closed" | "all" {
  const text = message.toLowerCase();
  if (/closed|done|resolved/.test(text)) return "closed";
  if (/all issues/.test(text)) return "all";
  return "open";
}

export type RepoIssuesQueryResult = {
  sql: string;
  rows: unknown[];
};

/**
 * GitHub issues for a repo (Coral `github.issues`) plus optional Notion cross-link.
 */
export async function fetchRepoIssuesForMessage(
  coral: CoralClient,
  message: string,
): Promise<RepoIssuesQueryResult> {
  const ref = extractRepoFromMessage(message);
  if (!ref) {
    return {
      sql: "-- No repo slug found in message",
      rows: [
        {
          error: "no_repo",
          hint: "Mention a repo slug (e.g. my-project) or owner/repo.",
        },
      ],
    };
  }

  const github = createGithubIntegration(coral);
  const resolved = await github.resolveRepoOwner(
    ref.repo,
    ref.owner || undefined,
  );
  const state = parseIssueState(message);
  const context = await github.getRepoIssuesContext(
    resolved.owner,
    resolved.repo,
    state,
  );

  const notion = createNotionIntegration(coral);
  const notionPages = await loadNotionPageIndex(notion, [resolved.repo]);
  context.notion_pages = notionPagesMatchingRepo(resolved.repo, notionPages);

  const sql = [
    `-- GitHub issues: ${resolved.owner}/${resolved.repo} (${state})`,
    githubQueries
      .repoIssues(resolved.owner, resolved.repo, state)
      .trim(),
  ].join("\n");

  const rows = [
    {
      kind: "repo_issues_summary",
      full_name: context.full_name,
      html_url: context.html_url,
      state_filter: context.state_filter,
      issue_count: context.open_issues.length,
      notion_page_count: context.notion_pages?.length ?? 0,
      issues: context.open_issues.map((i) => ({
        number: i.number,
        title: i.title,
        state: i.state,
        html_url: i.html_url,
        created_at: i.created_at,
        updated_at: i.updated_at,
        comments: i.comments,
        assignee: i.assignee_login,
        body_preview: i.body?.slice(0, 200),
      })),
      notion_pages: context.notion_pages,
    },
  ];

  return { sql, rows };
}
