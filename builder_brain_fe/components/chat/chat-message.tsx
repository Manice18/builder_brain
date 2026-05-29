"use client";

import { Loader2 } from "lucide-react";

import { CopyMessageButton } from "@/components/chat/copy-message-button";
import { MessageMarkdown } from "@/components/chat/message-markdown";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ChatMessage as ChatMessageType, StreamPhase } from "@/types/chat";

const THINKING_LABELS: Record<Exclude<StreamPhase, "complete">, string> = {
  classifying: "Thinking…",
  querying: "Querying your GitHub & Notion data…",
  summarizing: "Summarizing…",
};

type ChatMessageProps = {
  message: ChatMessageType;
  streamPhase?: StreamPhase | null;
};

export function ChatMessage({ message, streamPhase }: ChatMessageProps) {
  const isUser = message.role === "user";
  const isStreaming = message.status === "streaming";
  const showThinking = !isUser && isStreaming && !message.content.trim();
  const thinkingLabel =
    streamPhase && streamPhase !== "complete"
      ? THINKING_LABELS[streamPhase]
      : "Thinking…";
  const canCopy =
    !isUser &&
    message.content.trim().length > 0 &&
    message.status !== "streaming" &&
    message.status !== "cancelled";

  return (
    <div
      className={cn(
        "flex w-full gap-2",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      {canCopy && (
        <CopyMessageButton
          text={message.content}
          className="mt-1 opacity-60 hover:opacity-100"
        />
      )}
      <div
        className={cn(
          "max-w-[min(100%,42rem)] space-y-2 rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted/60 text-foreground",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        ) : showThinking ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 shrink-0 animate-spin" />
            <span className="text-sm">{thinkingLabel}</span>
          </div>
        ) : (
          <MessageMarkdown
            content={message.content}
            streaming={isStreaming}
          />
        )}

        {!isUser && message.status === "cancelled" && (
          <Badge
            variant="outline"
            className="mt-1 border-destructive/30 text-[10px] text-destructive"
          >
            Stopped
          </Badge>
        )}

        {!isUser &&
          message.meta?.intent &&
          (message.status === "complete" || message.status === "cancelled") && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              {message.meta.intent.replace(/_/g, " ")}
            </Badge>
            {message.meta.rowCount != null && (
              <Badge variant="secondary" className="text-[10px]">
                {message.meta.rowCount} rows
              </Badge>
            )}
            {message.meta.usedLlm && (
              <Badge variant="secondary" className="text-[10px]">
                Coral + LLM
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

