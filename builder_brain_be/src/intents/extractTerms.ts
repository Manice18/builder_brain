const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "from",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "can",
  "what",
  "which",
  "who",
  "whom",
  "whose",
  "where",
  "when",
  "why",
  "how",
  "all",
  "each",
  "every",
  "both",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "no",
  "not",
  "only",
  "own",
  "same",
  "so",
  "than",
  "too",
  "very",
  "just",
  "about",
  "into",
  "through",
  "during",
  "before",
  "after",
  "above",
  "below",
  "up",
  "down",
  "out",
  "off",
  "over",
  "under",
  "again",
  "further",
  "then",
  "once",
  "here",
  "there",
  "any",
  "my",
  "your",
  "our",
  "their",
  "this",
  "that",
  "these",
  "those",
  "i",
  "me",
  "we",
  "you",
  "he",
  "she",
  "it",
  "they",
  "them",
  "am",
  "show",
  "tell",
  "give",
  "list",
  "get",
  "find",
  "summarize",
  "summary",
  "contents",
  "content",
  "inside",
]);

/** Keywords from the user message for Notion search and project filtering. */
export function extractQueryTerms(message: string): string[] {
  const tokens = message
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));

  return [...new Set(tokens)].slice(0, 5);
}

/** Drop GitHub/Notion meta words so filters target real project names (e.g. "ideas"). */
const PROJECT_META_TERMS = new Set([
  "github",
  "notion",
  "repo",
  "repos",
  "repository",
  "matching",
  "match",
  "pages",
  "page",
  "which",
  "correspond",
  "connect",
  "link",
  "linked",
  "projects",
  "project",
  "used",
  "days",
  "day",
]);

export function extractProjectFilterTerms(message: string): string[] {
  return extractQueryTerms(message).filter((t) => !PROJECT_META_TERMS.has(t));
}

/** User wants repos cross-linked to Notion (not a single-page body read). */
/** Parse "last 30 days", "past week", etc. Defaults to 30 when unspecified. */
export function extractRecentDaysWindow(message: string): number {
  const text = message.toLowerCase();
  const lastN = text.match(/(?:last|past)\s+(\d+)\s*days?/);
  if (lastN) {
    const n = Number.parseInt(lastN[1] ?? "30", 10);
    if (Number.isFinite(n) && n > 0) return Math.min(n, 365);
  }
  if (/last week|past week|this week/.test(text)) return 7;
  if (/last month|past month/.test(text)) return 30;
  if (/last year|past year/.test(text)) return 365;
  return 30;
}

/** User said "last 30 days" etc.; otherwise show latest repos by activity. */
export function hasExplicitActivityWindow(message: string): boolean {
  const text = message.toLowerCase();
  return /last \d+\s*days?|past \d+\s*days?|last week|past week|this week|last month|past month|last year|past year|used in|worked on/.test(
    text,
  );
}

/** Recent GitHub usage (commits/pushes), not Notion-only or cross-link questions. */
export function asksForRecentGithubActivity(message: string): boolean {
  const text = message.toLowerCase();
  const mentionsGithub =
    /github|repos?|projects?|coding|committed|pushed/.test(text);
  const mentionsRecency =
    /last \d+\s*days?|past \d+\s*days?|recent|this week|last week|last month|used in|worked on|activit/.test(
      text,
    );
  return mentionsGithub && mentionsRecency;
}

export function asksForGithubNotionJoin(message: string): boolean {
  const text = message.toLowerCase();
  const mentionsBoth =
    /github|repo|repos|repository/.test(text) &&
    /notion|notes?|ideas?|pages?|docs?|wiki/.test(text);
  const wantsLink =
    /match|matching|link|linked|connect|correspond|map|pair|associate|which/.test(
      text,
    );
  return mentionsBoth && wantsLink;
}
