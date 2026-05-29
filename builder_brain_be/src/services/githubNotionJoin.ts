import type { NotionIntegration } from "../coral/integrations/notion.js";
import type { NotionSearchHit } from "../coral/integrations/notion.types.js";

export type NotionPageLink = {
  id: string;
  url?: string;
  title?: string;
  last_edited_time?: string;
};

export function extractPlainText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(extractPlainText).join(" ");
  }
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (typeof o.plain_text === "string") return o.plain_text;
    if (typeof o.content === "string") return o.content;
    return Object.values(o).map(extractPlainText).join(" ");
  }
  return "";
}

export function notionPageSearchBlob(hit: NotionSearchHit): string {
  return extractPlainText(hit.properties).toLowerCase();
}

export function titleFromNotionUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const segment = new URL(url).pathname.split("/").filter(Boolean).pop();
    if (!segment || segment.length < 3) return undefined;
    const words = segment
      .replace(/[0-9a-f]{32}$/i, "")
      .replace(/-/g, " ")
      .trim();
    return words.length >= 3 ? words : undefined;
  } catch {
    return undefined;
  }
}

export function inferNotionPageTitle(hit: NotionSearchHit): string | undefined {
  const props = hit.properties;
  if (props && typeof props === "object") {
    for (const value of Object.values(props as Record<string, unknown>)) {
      const text = extractPlainText(value).trim();
      if (text.length > 0 && text.length < 200) return text;
    }
  }
  return titleFromNotionUrl(hit.url);
}

export function notionPageLabel(link: NotionPageLink): string {
  return link.title ?? titleFromNotionUrl(link.url) ?? link.id;
}

/** Match repo slug variants in Notion page title/properties. */
export function repoJoinTokens(repoName: string): string[] {
  const key = repoName.toLowerCase();
  const slugWords = key.split(/[-_]+/).filter((w) => w.length >= 4);
  return [
    key,
    key.replace(/-/g, " "),
    key.replace(/-/g, ""),
    ...slugWords,
  ].filter((t) => t.length >= 4);
}

function notionPageHaystack(page: NotionSearchHit): string {
  const title = inferNotionPageTitle(page);
  return `${notionPageSearchBlob(page)} ${title ?? ""}`.toLowerCase();
}

function repoMatchesNotionHaystack(repoName: string, haystack: string): boolean {
  const tokens = repoJoinTokens(repoName);
  if (tokens.some((token) => haystack.includes(token))) return true;

  const slugWords = repoName
    .toLowerCase()
    .split(/[-_]+/)
    .filter((w) => w.length >= 4);
  if (slugWords.length >= 2) {
    return slugWords.every((w) => haystack.includes(w));
  }
  return false;
}

export function notionPagesMatchingRepo(
  repoName: string,
  pages: NotionSearchHit[],
): NotionPageLink[] {
  const matches: NotionPageLink[] = [];
  const seen = new Set<string>();

  for (const page of pages) {
    if (page.in_trash) continue;
    const haystack = notionPageHaystack(page);
    if (!repoMatchesNotionHaystack(repoName, haystack)) continue;
    if (seen.has(page.id)) continue;
    seen.add(page.id);
    matches.push({
      id: page.id,
      url: page.url,
      title: inferNotionPageTitle(page),
      last_edited_time: page.last_edited_time,
    });
  }

  return matches.sort((a, b) =>
    (b.last_edited_time ?? "").localeCompare(a.last_edited_time ?? ""),
  );
}

export type LoadNotionPageIndexOptions = {
  /** Extra Notion search queries (e.g. "ideas" from the user message). */
  extraQueries?: string[];
};

/** Pages visible to Coral, plus optional per-repo searches for join coverage. */
export async function loadNotionPageIndex(
  notion: NotionIntegration,
  repoNames: string[] = [],
  options: LoadNotionPageIndexOptions = {},
): Promise<NotionSearchHit[]> {
  const seen = new Set<string>();
  const hits: NotionSearchHit[] = [];

  const add = (batch: NotionSearchHit[]) => {
    for (const hit of batch) {
      if (hit.in_trash || seen.has(hit.id)) continue;
      seen.add(hit.id);
      hits.push(hit);
    }
  };

  add(await notion.listVisible(100));

  const uniqueRepos = [...new Set(repoNames.map((n) => n.trim()).filter(Boolean))];
  for (const slug of uniqueRepos.slice(0, 20)) {
    add(await notion.searchObjects(slug, "page"));
    const spaced = slug.replace(/-/g, " ");
    if (spaced !== slug) {
      add(await notion.searchObjects(spaced, "page"));
    }
  }

  for (const q of [...new Set(options.extraQueries ?? [])].slice(0, 4)) {
    if (q.length >= 3) {
      add(await notion.searchObjects(q, "page"));
    }
  }

  return hits;
}
