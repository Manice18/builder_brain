"use client";

import { ArrowUp, Loader2, Square } from "lucide-react";
import { useCallback, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ChatInputProps = {
  isStreaming?: boolean;
  onSend: (message: string) => void;
  onStop?: () => void;
};

export function ChatInput({
  isStreaming,
  onSend,
  onStop,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submit = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const value = el.value.trim();
    if (!value || isStreaming) return;
    onSend(value);
    el.value = "";
    el.style.height = "auto";
  }, [isStreaming, onSend]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming) submit();
    }
  };

  return (
    <div className="border-t border-border bg-background/80 p-4 backdrop-blur-sm">
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <Textarea
          ref={textareaRef}
          placeholder="Ask about your repos, Notion notes, or project context…"
          className="min-h-[52px] max-h-40 flex-1"
          disabled={isStreaming}
          rows={1}
          onKeyDown={onKeyDown}
          onInput={(e) => {
            const t = e.currentTarget;
            t.style.height = "auto";
            t.style.height = `${Math.min(t.scrollHeight, 160)}px`;
          }}
        />
        {isStreaming ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              type="button"
              size="icon"
              variant="secondary"
              disabled
              className="min-h-[52px] w-[52px] rounded-xl opacity-100"
              aria-label="Generating response"
            >
              <Loader2 className="size-5 animate-spin" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="min-h-[52px] w-[52px] rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={(e) => {
                e.preventDefault();
                onStop?.();
              }}
              aria-label="Stop response"
            >
              <Square className="size-4 fill-current" />
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            size="icon"
            className="min-h-[52px] w-[52px] shrink-0 rounded-xl hover:cursor-pointer"
            onClick={submit}
            aria-label="Send message"
          >
            <ArrowUp />
          </Button>
        )}
      </div>
      <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-muted-foreground">
        {isStreaming
          ? "Stop cancels the response"
          : "Enter to send · Shift+Enter for newline"}
      </p>
    </div>
  );
}
