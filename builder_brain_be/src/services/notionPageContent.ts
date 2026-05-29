import type { CoralClient } from "../coral/client.js";
import { createNotionIntegration } from "../coral/integrations/notion.js";
import { notionQueries } from "../coral/integrations/notion.queries.js";
import { extractNotionPageId } from "../intents/extractNotionPage.js";
import { extractNotionPageTitleQuery } from "../intents/extractNotionPageTitle.js";
import {
  inferNotionPageTitle,
  notionPageSearchBlob,
} from "./githubNotionJoin.js";
import type { NotionSearchHit } from "../coral/integrations/notion.types.js";

export { extractNotionPageId };

export type NotionPageContentQueryResult = {
  sql: string;
  rows: unknown[];
};

export type ResolvedNotionPage = {
  page_id: string;
  title?: string;
  matched_query: string;
  resolution: "uuid" | "search";
};

function scorePageHit(hit: NotionSearchHit, titleQuery: string): number {
  const queryLower = titleQuery.toLowerCase();
  const title = (inferNotionPageTitle(hit) ?? "").toLowerCase();
  const blob = notionPageSearchBlob(hit);
  let score = 0;

  if (title && (title.includes(queryLower) || queryLower.includes(title))) {
    score += 20;
  }

  for (const term of queryLower.split(/\s+/).filter((t) => t.length >= 2)) {
    if (title.includes(term)) score += 5;
    if (blob.includes(term)) score += 2;
  }

  return score;
}

export async function resolveNotionPage(
  coral: CoralClient,
  message: string,
): Promise<ResolvedNotionPage | null> {
  const uuid = extractNotionPageId(message);
  if (uuid) {
    return { page_id: uuid, matched_query: uuid, resolution: "uuid" };
  }

  const titleQuery = extractNotionPageTitleQuery(message);
  if (!titleQuery) return null;

  const notion = createNotionIntegration(coral);
  const hits = await notion.searchObjects(titleQuery, "page");
  if (hits.length === 0) return null;

  const ranked = hits
    .map((hit) => ({ hit, score: scorePageHit(hit, titleQuery) }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best || best.score < 2) return null;

  return {
    page_id: best.hit.id,
    title: inferNotionPageTitle(best.hit),
    matched_query: titleQuery,
    resolution: "search",
  };
}

export async function fetchNotionPageContent(
  coral: CoralClient,
  pageId: string,
  resolveMeta?: ResolvedNotionPage,
): Promise<NotionPageContentQueryResult> {
  const notion = createNotionIntegration(coral);
  const content = await notion.getPageContent(pageId);

  if (!content) {
    return {
      sql: notionQueries.blockChildren(pageId).trim(),
      rows: [{ error: "page_not_found", page_id: pageId }],
    };
  }

  const sql = [
    resolveMeta
      ? `-- Resolved via ${resolveMeta.resolution}: "${resolveMeta.matched_query}"`
      : `-- Page: ${pageId}`,
    notionQueries.page(pageId).trim(),
    notionQueries.blockChildren(pageId).trim(),
  ].join("\n");

  return {
    sql,
    rows: [
      {
        kind: "notion_page_content",
        page_id: content.page_id,
        title: content.title,
        url: content.page?.url,
        content_plain: content.content_plain,
        block_count: content.block_count,
        blocks: content.blocks,
        resolved_via: resolveMeta?.resolution,
        matched_query: resolveMeta?.matched_query,
      },
    ],
  };
}

export async function fetchNotionPageContentForMessage(
  coral: CoralClient,
  message: string,
): Promise<NotionPageContentQueryResult> {
  const resolved = await resolveNotionPage(coral, message);

  if (!resolved) {
    const titleQuery = extractNotionPageTitleQuery(message);
    return {
      sql: "-- Could not resolve Notion page from message",
      rows: [
        {
          error: "page_not_resolved",
          hint: "Include a page title (e.g. 'AI Agent Ideas page') or a Notion page UUID.",
          attempted_title_query: titleQuery ?? undefined,
        },
      ],
    };
  }

  return fetchNotionPageContent(coral, resolved.page_id, resolved);
}
