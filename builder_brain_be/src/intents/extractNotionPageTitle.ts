import { asksForRecentGithubActivity, extractQueryTerms } from "./extractTerms.js";

const TITLE_QUERY_NOISE =
  /\b(can you|please|summarize|summary|what are|what is|what's|whats|tell me|show me|read|the|contents?|content|inside|in|of|on|notion|page|pages?|body|text|about|from|get|give|me|a|an|recent|activities|activity|github|repos?|repositories|my|show)\b/gi;

/** Page title phrase from a natural-language question (e.g. "AI Agent Ideas"). */
export function extractNotionPageTitleQuery(message: string): string | null {
  const stripped = message.replace(TITLE_QUERY_NOISE, " ").replace(/\s+/g, " ").trim();
  if (!stripped) return null;

  const terms = extractQueryTerms(stripped);
  if (terms.length === 0) return null;

  return terms.join(" ");
}

/** GitHub-only recent activity (not a Notion page read). */
export function asksForGithubRepoActivity(message: string): boolean {
  const text = message.toLowerCase();
  return (
    /github|repos?|repositor|coding|committed|pushed/.test(text) &&
    /activit|recent|commit|push|timeline|what was i coding|last month|chronolog/.test(
      text,
    )
  );
}

export function asksForNotionPageContent(message: string): boolean {
  if (asksForRecentGithubActivity(message) || asksForGithubRepoActivity(message)) {
    return false;
  }

  const text = message.toLowerCase();
  const wantsContent =
    /contents?|inside|body|what.?s (in|inside|on)|summar|read|show/.test(text);
  if (!wantsContent) return false;

  // "Wallet Orchestrator Ideas" — no literal "page"/"notion", but title is extractable
  if (extractNotionPageTitleQuery(message)) return true;

  return /notion|page/.test(text);
}
