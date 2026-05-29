import type { CoralClient } from "../coral/client.js";
import { classifyIntent } from "../intents/classify.js";
import type { BuilderBrainIntent } from "../intents/types.js";
import { runQueryForIntent } from "../queries/runner.js";
import { fallbackSummary, summarizeInsight } from "../llm/summarize.js";
import { isOpenRouterConfigured } from "../llm/openrouter.js";
import type { ProjectMemoryRow } from "../services/projectMemory.types.js";
import { scoreProjectPriorities } from "../services/scoring.js";

export type ChatPipelineResult = {
  answer: string;
  intent: BuilderBrainIntent;
  confidence: string;
  sql?: string;
  rowCount: number;
  rows: unknown[];
  projectPriorities?: ReturnType<typeof scoreProjectPriorities>;
  usedLlm: boolean;
};

export async function runChatPipeline(
  coral: CoralClient,
  message: string,
): Promise<ChatPipelineResult> {
  const { intent, confidence } = classifyIntent(message);

  if (intent === "mcp_action") {
    return {
      answer:
        "Write actions (create issues, update Notion, etc.) are not wired yet. BuilderBrain v1 is read-only across **GitHub** and **Notion** — ask about projects, repos, notes, or what's gone stale.",
      intent,
      confidence,
      rowCount: 0,
      rows: [],
      usedLlm: false,
    };
  }

  const effectiveIntent: BuilderBrainIntent =
    intent === "unknown" ? "general" : intent;

  const { sql, rows } = await runQueryForIntent(
    coral,
    effectiveIntent,
    message,
  );

  const projectPriorities =
    effectiveIntent === "project_overview" ||
    effectiveIntent === "general" ||
    effectiveIntent === "abandoned_projects"
      ? scoreProjectPriorities(rows as ProjectMemoryRow[])
      : undefined;

  let answer: string;
  let usedLlm = false;

  if (isOpenRouterConfigured()) {
    answer = await summarizeInsight(message, effectiveIntent, {
      sql,
      rows,
      projectPriorities,
    });
    usedLlm = true;
  } else {
    answer = fallbackSummary(effectiveIntent, rows.length);
    const top = projectPriorities?.[0];
    if (top) {
      answer += ` Top signal: ${top.project} (${top.signals.join(", ")}).`;
    }
  }

  return {
    answer,
    intent: effectiveIntent,
    confidence,
    sql,
    rowCount: rows.length,
    rows,
    projectPriorities,
    usedLlm,
  };
}

export async function runInsightByIntent(
  coral: CoralClient,
  intent: BuilderBrainIntent,
  message = "",
): Promise<{ sql: string; rows: unknown[] }> {
  const result = await runQueryForIntent(coral, intent, message);
  return { sql: result.sql, rows: result.rows };
}
