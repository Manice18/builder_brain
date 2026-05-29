export type NormalizedActivity = {
  type: "activity" | "task" | "event" | "source";
  project?: string;
  source: string;
  title?: string;
  at?: string;
  raw: Record<string, unknown>;
};

function asRecord(row: unknown): Record<string, unknown> {
  return typeof row === "object" && row !== null
    ? (row as Record<string, unknown>)
    : {};
}

export function normalizeRows(rows: unknown[]): NormalizedActivity[] {
  return rows.map((row) => {
    const r = asRecord(row);

    if ("repo_name" in r || "name" in r) {
      return {
        type: "activity",
        project: String(r.repo_name ?? r.name ?? ""),
        source: "github",
        title: String(r.repo_name ?? r.name ?? ""),
        at: r.last_commit ? String(r.last_commit) : undefined,
        raw: r,
      };
    }

    if ("kind" in r && (r.kind === "task" || r.kind === "event")) {
      return {
        type: r.kind === "task" ? "task" : "event",
        source: r.kind === "task" ? "todoist" : "google_calendar",
        title: String(r.title ?? r.content ?? ""),
        at: r.at ? String(r.at) : undefined,
        raw: r,
      };
    }

    if ("schema_name" in r) {
      return {
        type: "source",
        source: String(r.schema_name),
        title: String(r.key ?? ""),
        raw: r,
      };
    }

    return {
      type: "activity",
      source: "notion",
      title: String(r.url ?? r.id ?? "notion"),
      at: r.last_edited_time ? String(r.last_edited_time) : undefined,
      raw: r,
    };
  });
}
