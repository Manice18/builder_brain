import type { BuilderBrainIntent } from "../intents/types.js";

/**
 * Coral SQL templates for simple reads. Cross-source project memory is built in
 * `projectMemory.ts` (GitHub + Notion). LLM never generates arbitrary SQL.
 */
const TEMPLATES: Partial<Record<BuilderBrainIntent, string>> = {
  sources_status: `
    SELECT schema_name, key, is_set
    FROM coral.inputs
    WHERE schema_name IN ('github', 'notion')
  `,
};

/** Intents resolved by integration services rather than static SQL. */
const SERVICE_INTENTS = new Set<BuilderBrainIntent>([
  "project_overview",
  "general",
  "abandoned_projects",
  "repo_issues",
  "notion_search",
  "notion_page_content",
  "repo_activity",
]);

export function getSqlForIntent(intent: BuilderBrainIntent): string | null {
  const sql = TEMPLATES[intent];
  return sql?.trim() ?? null;
}

export function intentHasQuery(intent: BuilderBrainIntent): boolean {
  if (intent === "mcp_action" || intent === "unknown") return false;
  return SERVICE_INTENTS.has(intent) || Boolean(TEMPLATES[intent]);
}
