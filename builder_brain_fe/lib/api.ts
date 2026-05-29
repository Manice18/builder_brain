import { API_BASE_URL } from "./config";
import type { ChatPipelineResult, SourceStatus, StreamPhase } from "@/types/chat";

function mapSourceRows(rows: unknown[]): SourceStatus[] {
  const bySchema = new Map<string, SourceStatus>();

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const schema = String(r.schema_name ?? r.schema ?? "");
    if (!schema) continue;

    let entry = bySchema.get(schema);
    if (!entry) {
      entry = { schema, configured: false, inputs: [] };
      bySchema.set(schema, entry);
    }

    const key = String(r.key ?? "");
    const is_set = r.is_set === true;
    entry.inputs!.push({ key, is_set });

    if (is_set && /TOKEN|API_KEY/i.test(key)) {
      entry.configured = true;
    }
  }

  return [...bySchema.values()];
}

export async function fetchSourcesStatus(): Promise<{
  sources: SourceStatus[];
}> {
  const res = await fetch(`${API_BASE_URL}/api/sources/status`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to load source status");
  const body = (await res.json()) as { rows?: unknown[]; sources?: SourceStatus[] };
  if (Array.isArray(body.sources)) {
    return { sources: body.sources };
  }
  return { sources: mapSourceRows(body.rows ?? []) };
}

export type ChatStreamHandlers = {
  onStatus?: (data: {
    phase: StreamPhase;
    intent?: string;
    confidence?: string;
  }) => void;
  onMeta?: (data: {
    intent: string;
    confidence: string;
    sql?: string;
    rowCount: number;
    rows: unknown[];
    usedLlm: boolean;
  }) => void;
  onToken?: (content: string) => void;
  onDone?: (result: ChatPipelineResult) => void;
  onCancelled?: (data: { partialAnswer?: string; message?: string }) => void;
  onError?: (message: string) => void;
};

export async function streamChat(
  message: string,
  handlers: ChatStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  let notifiedCancel = false;
  const notifyCancelled = () => {
    if (notifiedCancel) return;
    notifiedCancel = true;
    handlers.onCancelled?.({ message: "Stopped" });
  };

  if (signal?.aborted) {
    notifyCancelled();
    return;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) {
      notifyCancelled();
      return;
    }
    throw error;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(
      typeof err.error === "string" ? err.error : "Chat request failed",
    );
  }

  if (!res.body) {
    throw new Error("No response stream");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventName = "message";

  const dispatch = (name: string, raw: string) => {
    if (signal?.aborted) return;
    if (!raw) return;
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return;
    }

    switch (name) {
      case "status":
        handlers.onStatus?.({
          phase: data.phase as StreamPhase,
          intent: data.intent as string | undefined,
          confidence: data.confidence as string | undefined,
        });
        break;
      case "meta":
        handlers.onMeta?.({
          intent: String(data.intent ?? ""),
          confidence: String(data.confidence ?? ""),
          sql: data.sql as string | undefined,
          rowCount: Number(data.rowCount ?? 0),
          rows: (data.rows as unknown[]) ?? [],
          usedLlm: Boolean(data.usedLlm),
        });
        break;
      case "token":
        handlers.onToken?.(String(data.content ?? ""));
        break;
      case "done":
        handlers.onDone?.(data.result as ChatPipelineResult);
        break;
      case "cancelled":
        handlers.onCancelled?.({
          partialAnswer: data.partialAnswer as string | undefined,
          message: data.message as string | undefined,
        });
        break;
      case "error":
        handlers.onError?.(String(data.message ?? "Stream error"));
        break;
      default:
        break;
    }
  };

  const onAbort = () => {
    void reader.cancel();
  };
  signal?.addEventListener("abort", onAbort);

  try {
    while (true) {
      if (signal?.aborted) {
        await reader.cancel();
        notifyCancelled();
        return;
      }

      let done: boolean;
      let value: Uint8Array | undefined;
      try {
        ({ done, value } = await reader.read());
      } catch (readError) {
        if (signal?.aborted) {
          notifyCancelled();
          return;
        }
        throw readError;
      }

      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (signal?.aborted) {
          await reader.cancel();
          notifyCancelled();
          return;
        }
        if (line.startsWith("event:")) {
          eventName = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dispatch(eventName, line.slice(5).trim());
        }
      }
    }
  } catch (error) {
    if (signal?.aborted) {
      notifyCancelled();
      return;
    }
    throw error;
  } finally {
    signal?.removeEventListener("abort", onAbort);
    try {
      await reader.cancel();
    } catch {
      /* already closed */
    }
  }
}
