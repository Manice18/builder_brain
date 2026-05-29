"use client";

import { useEffect, useState } from "react";
import { Circle, CircleCheck } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { fetchSourcesStatus } from "@/lib/api";
import type { SourceStatus } from "@/types/chat";

export function SourceSidebar() {
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSourcesStatus()
      .then((data) => setSources(data.sources ?? []))
      .catch(() => setError("Backend offline"));
  }, []);

  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-card/50 p-4 lg:block">
      <Card className="border-0 bg-transparent shadow-none">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="text-base">Sources</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-0">
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
          {sources.map((s) => (
            <div key={s.schema} className="flex items-center gap-2 text-sm">
              {s.configured ? (
                <CircleCheck className="size-4 text-emerald-600" />
              ) : (
                <Circle className="size-4 text-muted-foreground" />
              )}
              <span className="capitalize">{s.schema.replace(/_/g, " ")}</span>
            </div>
          ))}
          {!error && sources.length === 0 && (
            <p className="text-xs text-muted-foreground">Loading…</p>
          )}
        </CardContent>
      </Card>

      <Separator className="my-4" />

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        BuilderBrain reads GitHub and Notion via Coral — repos, commits, and
        pages joined by shared project names.
      </p>
    </aside>
  );
}
