import type { CoralClient } from "../coral/client.js";
import { buildProjectMemory } from "./projectMemory.js";
import type { ProjectMemoryRow } from "./projectMemory.types.js";

export type AbandonedProjectsQueryResult = {
  sql: string;
  rows: ProjectMemoryRow[];
  notion_index_size: number;
  github_candidate_count: number;
};

/** Stale GitHub repos still referenced in Notion. */
export async function listAbandonedProjectsWithNotion(
  coral: CoralClient,
): Promise<AbandonedProjectsQueryResult> {
  const result = await buildProjectMemory(coral, { mode: "abandoned" });

  return {
    sql: result.sql,
    rows: result.rows,
    notion_index_size: result.notion_index_size,
    github_candidate_count: result.rows.length,
  };
}
