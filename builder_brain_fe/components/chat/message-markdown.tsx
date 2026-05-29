"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { normalizeMarkdown } from "@/lib/normalize-markdown";
import { cn } from "@/lib/utils";

type MessageMarkdownProps = {
  content: string;
  streaming?: boolean;
  className?: string;
};

export function MessageMarkdown({
  content,
  streaming,
  className,
}: MessageMarkdownProps) {
  const normalized = normalizeMarkdown(content);

  return (
    <div
      className={cn(
        "break-words text-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className="mb-2.5 last:mb-0">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => (
            <ul className="mb-2.5 ml-4 list-disc space-y-1.5 last:mb-0">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-2.5 ml-4 list-decimal space-y-1.5 last:mb-0">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="pl-0.5">{children}</li>,
          h1: ({ children }) => (
            <h1 className="mb-2 font-serif text-lg font-normal">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-2 font-serif text-base font-normal">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-1.5 text-sm font-semibold">{children}</h3>
          ),
          code: ({ children }) => (
            <code className="rounded bg-background/80 px-1 py-0.5 text-[0.85em]">
              {children}
            </code>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              className="underline underline-offset-2 hover:text-primary"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="mb-3 overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[32rem] border-collapse text-left text-xs">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="border-b border-border bg-background/60">
              {children}
            </thead>
          ),
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => (
            <tr className="border-b border-border/60 last:border-0">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 font-semibold text-foreground">{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 align-top text-muted-foreground">{children}</td>
          ),
        }}
      >
        {normalized}
      </ReactMarkdown>
      {streaming && (
        <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-current align-middle" />
      )}
    </div>
  );
}
