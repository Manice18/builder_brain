"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ChatInput } from "@/components/chat/chat-input";
import { ChatMessage } from "@/components/chat/chat-message";
import { ScrollArea } from "@/components/ui/scroll-area";
import { streamChat } from "@/lib/api";
import type {
  BuilderBrainIntent,
  ChatMessage as ChatMessageType,
  StreamPhase,
} from "@/types/chat";

const SUGGESTIONS = [
  "What projects have I abandoned?",
  "Which repos are stale but still in my notes?",
  "Show recent activity on my repositories",
];

const STOPPED_SUFFIX = "\n\n---\n*Response stopped.*";

function newId(): string {
  return crypto.randomUUID();
}

function finalizeStoppedContent(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return "*Response stopped before any output.*";
  if (trimmed.endsWith("*Response stopped.*")) return trimmed;
  return `${content}${STOPPED_SUFFIX}`;
}

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [phase, setPhase] = useState<StreamPhase | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const streamingAssistantIdRef = useRef<string | null>(null);
  const stoppedRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, phase]);

  const markAssistantStopped = useCallback((assistantId: string) => {
    stoppedRef.current = true;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === assistantId
          ? {
              ...m,
              content: finalizeStoppedContent(m.content),
              status: "cancelled",
            }
          : m,
      ),
    );
    setPhase(null);
    setIsStreaming(false);
  }, []);

  const stopStreaming = useCallback(() => {
    stoppedRef.current = true;
    const assistantId = streamingAssistantIdRef.current;
    if (assistantId) {
      markAssistantStopped(assistantId);
    }
    abortRef.current?.abort();
  }, [markAssistantStopped]);

  const sendMessage = useCallback(
    async (text: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      stoppedRef.current = false;

      const userMsg: ChatMessageType = {
        id: newId(),
        role: "user",
        content: text,
        status: "complete",
      };

      const assistantId = newId();
      streamingAssistantIdRef.current = assistantId;
      const assistantMsg: ChatMessageType = {
        id: assistantId,
        role: "assistant",
        content: "",
        status: "streaming",
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);
      setPhase("classifying");

      try {
        await streamChat(
          text,
          {
            onStatus: ({ phase: p }) => {
              if (stoppedRef.current) return;
              setPhase(p);
            },
            onMeta: ({ intent, confidence, rowCount, usedLlm }) => {
              if (stoppedRef.current) return;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        meta: {
                          intent: intent as BuilderBrainIntent,
                          confidence,
                          rowCount,
                          usedLlm,
                        },
                      }
                    : m,
                ),
              );
            },
            onToken: (content) => {
              if (stoppedRef.current) return;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + content }
                    : m,
                ),
              );
            },
            onDone: (result) => {
              if (stoppedRef.current) return;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        content: result.answer || m.content,
                        status: "complete",
                        meta: {
                          intent: result.intent,
                          confidence: result.confidence,
                          rowCount: result.rowCount,
                          usedLlm: result.usedLlm,
                        },
                      }
                    : m,
                ),
              );
            },
            onCancelled: () => {
              if (!stoppedRef.current) {
                markAssistantStopped(assistantId);
              }
            },
            onError: (message) => {
              if (stoppedRef.current) return;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        content: message,
                        status: "error",
                      }
                    : m,
                ),
              );
              setPhase(null);
            },
          },
          controller.signal,
        );
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          markAssistantStopped(assistantId);
          return;
        }
        const message =
          err instanceof Error ? err.message : "Something went wrong";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: message, status: "error" }
              : m,
          ),
        );
      } finally {
        streamingAssistantIdRef.current = null;
        if (!controller.signal.aborted && !stoppedRef.current) {
          setIsStreaming(false);
          setPhase(null);
        }
      }
    },
    [markAssistantStopped],
  );

  const showEmpty = messages.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
          {showEmpty && (
            <div className="space-y-8 pt-12 text-center">
              <div className="space-y-2">
                <h2 className="font-serif text-3xl font-normal tracking-tight">
                  Your builder memory
                </h2>
                <p className="text-sm text-muted-foreground">
                  GitHub repos linked to Notion — what you code vs what you
                  still plan.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={isStreaming}
                    onClick={() => sendMessage(s)}
                    className="rounded-full border border-border bg-card px-4 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-foreground disabled:opacity-50 hover:cursor-pointer"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <ChatMessage
              key={m.id}
              message={m}
              streamPhase={m.status === "streaming" ? phase : null}
            />
          ))}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <ChatInput
        isStreaming={isStreaming}
        onSend={sendMessage}
        onStop={stopStreaming}
      />
    </div>
  );
}
