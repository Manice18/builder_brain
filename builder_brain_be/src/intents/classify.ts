import {
  asksForGithubNotionJoin,
  asksForRecentGithubActivity,
  extractQueryTerms,
} from "./extractTerms.js";
import { extractNotionPageId } from "./extractNotionPage.js";
import {
  asksForGithubRepoActivity,
  asksForNotionPageContent,
} from "./extractNotionPageTitle.js";
import { extractRepoFromMessage } from "./extractRepo.js";
import type { BuilderBrainIntent, ClassifiedIntent } from "./types.js";

function normalizeForIntent(text: string): string {
  return text
    .toLowerCase()
    .replace(/\babondon(ed|ing|s)?\b/g, "abandon$1")
    .replace(/\babandoned\b/g, "abandoned");
}

/**
 * Rule-based intent routing for GitHub + Notion project memory.
 */
export function classifyIntent(message: string): ClassifiedIntent {
  const text = normalizeForIntent(message.trim());
  if (!text) {
    return { intent: "general", confidence: "low" };
  }

  if (
    /schedule|calendar|todoist|create event|book.*time|tomorrow evening/.test(
      text,
    )
  ) {
    return { intent: "mcp_action", confidence: "high" };
  }

  if (/sources?|connected|credentials|is_set|coral inputs/.test(text)) {
    return { intent: "sources_status", confidence: "high" };
  }

  if (
    /abandon|abond|stale|haven.?t committed|no commits|inactive repo|neglected|left behind/.test(
      text,
    )
  ) {
    return { intent: "abandoned_projects", confidence: "high" };
  }

  if (
    /\bissues?\b|\btickets?\b|\bbugs?\b/.test(text) &&
    extractRepoFromMessage(message)
  ) {
    return { intent: "repo_issues", confidence: "high" };
  }

  if (asksForRecentGithubActivity(message) || asksForGithubRepoActivity(message)) {
    return { intent: "repo_activity", confidence: "high" };
  }

  if (asksForNotionPageContent(message) || extractNotionPageId(message)) {
    return { intent: "notion_page_content", confidence: "high" };
  }

  if (
    /notion|notes?|pages?|docs?|wiki|brainstorm|written|document/.test(text) &&
    !/github|repo|commit|push|issues?/.test(text) &&
    !asksForNotionPageContent(message)
  ) {
    return { intent: "notion_search", confidence: "high" };
  }

  if (
    /commit|pushed|push|repo activity|recent code|timeline|last month|chronolog|what was i coding/.test(
      text,
    )
  ) {
    return { intent: "repo_activity", confidence: "high" };
  }

  if (/pull request|pr\b/.test(text) && !/\bissues?\b/.test(text)) {
    return { intent: "repo_activity", confidence: "medium" };
  }

  if (
    /revisit|repeated|recurring|themes?|interests?|keep coming back/.test(text)
  ) {
    return { intent: "notion_search", confidence: "medium" };
  }

  if (asksForGithubNotionJoin(message)) {
    return { intent: "project_overview", confidence: "high" };
  }

  if (
    /focus|priorit|what should i work|work on next|this week|active project|tracking/.test(
      text,
    )
  ) {
    return { intent: "project_overview", confidence: "high" };
  }

  if (
    /project|overview|memory|builder brain|cross.?source|github and notion|repos? i/.test(
      text,
    )
  ) {
    return { intent: "project_overview", confidence: "medium" };
  }

  // Actionable terms → still fetch project context rather than refusing
  if (extractQueryTerms(message).length > 0) {
    return { intent: "general", confidence: "low" };
  }

  return { intent: "general", confidence: "low" };
}

export function intentLabel(intent: BuilderBrainIntent): string {
  const labels: Record<BuilderBrainIntent, string> = {
    project_overview: "Project overview (GitHub + Notion)",
    abandoned_projects: "Abandoned projects",
    repo_issues: "Repository issues",
    repo_activity: "Repository activity",
    notion_search: "Notion context",
    notion_page_content: "Notion page content",
    sources_status: "Source connectivity",
    general: "Project memory",
    mcp_action: "Action (write)",
    unknown: "General",
  };
  return labels[intent];
}
