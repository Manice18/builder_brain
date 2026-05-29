import { ApiError } from "../errors/errors.js";
import { config } from "../config/env.js";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OpenRouterResponse = {
  choices?: Array<{
    message?: { content?: string };
  }>;
  error?: { message?: string };
};

export function isOpenRouterConfigured(): boolean {
  return Boolean(config.OPENROUTER_API_KEY?.length);
}

function openRouterHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${config.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
  };
}

/**
 * OpenAI-compatible chat completions via OpenRouter.
 * @see https://openrouter.ai/docs/api/reference/overview
 */
export async function chatCompletion(
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number },
): Promise<string> {
  if (!config.OPENROUTER_API_KEY) {
    throw new ApiError(
      "OPENROUTER_API_KEY is not set. Add it to builder_brain_be/.env for LLM summaries.",
      503,
    );
  }

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: openRouterHeaders(),
    body: JSON.stringify({
      model: config.OPENROUTER_MODEL,
      messages,
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 800,
    }),
  });

  const body = (await response.json()) as OpenRouterResponse;

  if (!response.ok) {
    const msg = body.error?.message ?? response.statusText;
    throw new ApiError(`OpenRouter request failed: ${msg}`, 502);
  }

  const content = body.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new ApiError("OpenRouter returned an empty response", 502);
  }

  return content;
}

/** Stream completion tokens from OpenRouter (SSE). */
export async function* chatCompletionStream(
  messages: ChatMessage[],
  options?: {
    temperature?: number;
    maxTokens?: number;
    signal?: AbortSignal;
  },
): AsyncGenerator<string> {
  if (!config.OPENROUTER_API_KEY) {
    throw new ApiError(
      "OPENROUTER_API_KEY is not set. Add it to builder_brain_be/.env for LLM summaries.",
      503,
    );
  }

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: openRouterHeaders(),
    signal: options?.signal,
    body: JSON.stringify({
      model: config.OPENROUTER_MODEL,
      messages,
      stream: true,
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 800,
    }),
  });

  if (!response.ok) {
    let msg = response.statusText;
    try {
      const errBody = (await response.json()) as OpenRouterResponse;
      msg = errBody.error?.message ?? msg;
    } catch {
      /* ignore */
    }
    throw new ApiError(`OpenRouter request failed: ${msg}`, 502);
  }

  if (!response.body) {
    throw new ApiError("OpenRouter returned no response body", 502);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      if (options?.signal?.aborted) {
        await reader.cancel();
        return;
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") return;

        try {
          const parsed = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch {
          /* skip malformed SSE chunks */
        }
      }
    }
  } catch (error) {
    if (options?.signal?.aborted) {
      try {
        await reader.cancel();
      } catch {
        /* already closed */
      }
      return;
    }
    throw error;
  }
}
