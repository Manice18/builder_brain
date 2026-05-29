"use client";

import { Check, Copy } from "lucide-react";
import { useCallback, useState } from "react";

import { cn } from "@/lib/utils";

type CopyMessageButtonProps = {
  text: string;
  className?: string;
};

export function CopyMessageButton({ text, className }: CopyMessageButtonProps) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard denied */
    }
  }, [text]);

  return (
    <button
      type="button"
      onClick={copy}
      disabled={!text.trim()}
      aria-label={copied ? "Copied" : "Copy response"}
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background/80 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40 hover:cursor-pointer",
        className,
      )}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  );
}
