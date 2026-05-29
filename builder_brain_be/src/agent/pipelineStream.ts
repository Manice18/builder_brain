import type { CoralClient } from "../coral/client.js";
import { classifyIntent } from "../intents/classify.js";
import type { BuilderBrainIntent } from "../intents/types.js";
import { runQueryForIntent } from "../queries/runner.js";
import {
  fallbackSummary,
  streamPlainText,
  summarizeInsightStream,
} from "../llm/summarize.js";
import { isOpenRouterConfigured } from "../llm/openrouter.js";
import type { ProjectMemoryRow } from "../services/projectMemory.types.js";
import { scoreProjectPriorities } from "../services/scoring.js";
import type { ChatPipelineResult } from "./pipeline.js";
import { isAbortError, throwIfAborted } from "../utils/abort.js";

export type ChatStreamEvent =
  | {
      type: "status";
      phase: "classifying" | "querying" | "summarizing" | "complete";
      intent?: BuilderBrainIntent;
      confidence?: string;
    }
  | {
      type: "meta";
      intent: BuilderBrainIntent;
      confidence: string;
      sql?: string;
      rowCount: number;
      rows: unknown[];
      projectPriorities?: ReturnType<typeof scoreProjectPriorities>;
      usedLlm: boolean;
    }
  | { type: "token"; content: string }
  | { type: "done"; result: ChatPipelineResult }
  | { type: "cancelled"; message?: string; partialAnswer?: string }
  | { type: "error"; message: string };

export async function* runChatPipelineStream(
  coral: CoralClient,
  message: string,
  signal?: AbortSignal,
): AsyncGenerator<ChatStreamEvent> {
  yield { type: "status", phase: "classifying" };
  throwIfAborted(signal);

  const { intent, confidence } = classifyIntent(message);

  if (intent === "mcp_action") {
    const answer =
      "Write actions are not wired yet. BuilderBrain v1 is read-only across GitHub and Notion — ask about projects, repos, notes, or what's gone stale.";

    yield {
      type: "meta",
      intent,
      confidence,
      rowCount: 0,
      rows: [],
      usedLlm: false,
    };

    let full = "";
    try {
      for await (const chunk of streamPlainText(answer, 10, signal)) {
        throwIfAborted(signal);
        full += chunk;
        yield { type: "token", content: chunk };
      }
    } catch (error) {
      if (isAbortError(error)) {
        yield { type: "cancelled", partialAnswer: full };
        return;
      }
      throw error;
    }

    yield {
      type: "done",
      result: {
        answer: full,
        intent,
        confidence,
        rowCount: 0,
        rows: [],
        usedLlm: false,
      },
    };
    return;
  }

  const effectiveIntent: BuilderBrainIntent =
    intent === "unknown" ? "general" : intent;

  yield {
    type: "status",
    phase: "querying",
    intent: effectiveIntent,
    confidence,
  };

  throwIfAborted(signal);

  const { sql, rows } = await runQueryForIntent(
    coral,
    effectiveIntent,
    message,
  );

  throwIfAborted(signal);

  const projectPriorities =
    effectiveIntent === "project_overview" ||
    effectiveIntent === "general" ||
    effectiveIntent === "abandoned_projects"
      ? scoreProjectPriorities(rows as ProjectMemoryRow[])
      : undefined;

  const usedLlm = isOpenRouterConfigured();

  yield {
    type: "meta",
    intent: effectiveIntent,
    confidence,
    sql,
    rowCount: rows.length,
    rows,
    projectPriorities,
    usedLlm,
  };

  yield {
    type: "status",
    phase: usedLlm ? "summarizing" : "complete",
    intent: effectiveIntent,
    confidence,
  };

  let answer = "";

  try {
    if (usedLlm) {
      for await (const chunk of summarizeInsightStream(
        message,
        effectiveIntent,
        { sql, rows, projectPriorities },
        signal,
      )) {
        throwIfAborted(signal);
        answer += chunk;
        yield { type: "token", content: chunk };
      }
    } else {
      const fallback = fallbackSummary(effectiveIntent, rows.length);
      const suffix = projectPriorities?.[0]
        ? ` Top signal: ${projectPriorities[0].project} (${projectPriorities[0].signals.join(", ")}).`
        : "";
      for await (const chunk of streamPlainText(fallback + suffix, 10, signal)) {
        throwIfAborted(signal);
        answer += chunk;
        yield { type: "token", content: chunk };
      }
    }
  } catch (error) {
    if (isAbortError(error)) {
      yield {
        type: "cancelled",
        partialAnswer: answer,
        message: "Stopped",
      };
      return;
    }
    throw error;
  }

  throwIfAborted(signal);

  yield { type: "status", phase: "complete", intent: effectiveIntent, confidence };

  yield {
    type: "done",
    result: {
      answer,
      intent: effectiveIntent,
      confidence,
      sql,
      rowCount: rows.length,
      rows,
      projectPriorities,
      usedLlm,
    },
  };
}
