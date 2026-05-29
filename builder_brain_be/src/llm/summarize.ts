import type { BuilderBrainIntent } from "../intents/types.js";
import { intentLabel } from "../intents/classify.js";
import { chatCompletion, chatCompletionStream, type ChatMessage } from "./openrouter.js";

const SYSTEM_PROMPT = `You are BuilderBrain — a personal project memory across GitHub (code) and Notion (notes).

Rules:
- Only reason about facts in the structured JSON (repos, commits, Notion pages, cross-links).
- Never invent repos, pages, or activity. v1 has no Todoist or calendar data.
- Highlight cross-source patterns: stale code but active notes, linked repos, recent Notion edits.
- Rows are limited to the user's own GitHub repos (personal account or repos they admin), not read-only organization repos they merely belong to.
- For repo_activity rows, list each repo with \`last_activity\`, \`last_activity_source\`, and recent commits. Do not ask for a Notion page — this intent is GitHub-only.
- When \`active_within_days\` is set, only include repos inside that window; when absent, list the most recently active repos returned.
- When rows include \`notion_pages\` on a repo, list each linked page title and explain how the repo slug matches Notion text.
- When rows include \`issues\` or \`repo_issues_summary\`, list each issue by number and title; do not claim issue data is missing if issues are present.
- When rows include \`content_plain\` (page body text), summarize that text directly. Do not claim body text is missing if \`content_plain\` is non-empty.
- Prefer \`content_plain\` over \`snippet\` or search metadata when both are present.
- If data is empty, suggest \`coral source add github\` / \`notion\` and sharing pages with the integration.
- Be concise (2-4 short paragraphs). Use Markdown: **bold** names, bullets, tables with one row per line.
- Never use HTML tags (\`<br>\`, \`<div>\`, etc.). In tables, separate list items with \` · \` or use a bullet list below the table—not \`<br>\`.`;

function buildSummarizeMessages(
  userMessage: string,
  intent: BuilderBrainIntent,
  payload: {
    sql: string;
    rows: unknown[];
    projectPriorities?: unknown[];
  },
): ChatMessage[] {
  const userContent = JSON.stringify(
    {
      user_question: userMessage,
      intent: intentLabel(intent),
      coral_sql: payload.sql,
      row_count: payload.rows.length,
      rows: payload.rows.slice(0, 25),
      project_priorities: payload.projectPriorities,
    },
    null,
    2,
  );

  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Summarize these Coral query results for the user.\n\n${userContent}`,
    },
  ];
}

export async function summarizeInsight(
  userMessage: string,
  intent: BuilderBrainIntent,
  payload: {
    sql: string;
    rows: unknown[];
    projectPriorities?: unknown[];
  },
): Promise<string> {
  return chatCompletion(buildSummarizeMessages(userMessage, intent, payload));
}

export async function* summarizeInsightStream(
  userMessage: string,
  intent: BuilderBrainIntent,
  payload: {
    sql: string;
    rows: unknown[];
    projectPriorities?: unknown[];
  },
  signal?: AbortSignal,
): AsyncGenerator<string> {
  yield* chatCompletionStream(buildSummarizeMessages(userMessage, intent, payload), {
    signal,
  });
}

export function fallbackSummary(
  intent: BuilderBrainIntent,
  rowCount: number,
): string {
  if (rowCount === 0) {
    return `No rows returned for "${intentLabel(intent)}". Connect sources with \`coral source add\` and share Notion pages with your integration.`;
  }
  return `Found ${rowCount} row(s) for "${intentLabel(intent)}". Set OPENROUTER_API_KEY to enable natural-language summaries.`;
}

/** Smooth typing for non-LLM answers in the stream endpoint. */
export async function* streamPlainText(
  text: string,
  delayMs = 10,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const parts = text.split(/(\s+)/);
  for (const part of parts) {
    if (signal?.aborted) return;
    if (!part) continue;
    yield part;
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}
