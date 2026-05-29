import type { CoralClient } from "../coral/client.js";
import type { BuilderBrainIntent } from "../intents/types.js";
import { listAbandonedProjectsWithNotion } from "../services/abandonedProjects.js";
import {
  buildProjectMemory,
  listRepoActivity,
  searchNotionForMessage,
} from "../services/projectMemory.js";
import { fetchNotionPageContentForMessage } from "../services/notionPageContent.js";
import { fetchRepoIssuesForMessage } from "../services/repoIssues.js";
import { ApiError } from "../errors/errors.js";
import { getSqlForIntent, intentHasQuery } from "./templates.js";

export type QueryRunResult = {
  intent: BuilderBrainIntent;
  sql: string;
  rows: unknown[];
};

export async function runQueryForIntent(
  coral: CoralClient,
  intent: BuilderBrainIntent,
  message = "",
): Promise<QueryRunResult> {
  if (!intentHasQuery(intent)) {
    throw new ApiError(`No Coral query template for intent: ${intent}`, 400);
  }

  switch (intent) {
    case "abandoned_projects": {
      const { sql, rows, notion_index_size } =
        await listAbandonedProjectsWithNotion(coral);
      return {
        intent,
        sql: `${sql}\n-- notion_index_size: ${notion_index_size}`,
        rows,
      };
    }
    case "project_overview":
    case "general": {
      const { sql, rows } = await buildProjectMemory(coral, {
        message,
        mode: "overview",
      });
      return { intent, sql, rows };
    }
    case "notion_search": {
      const { sql, rows } = await searchNotionForMessage(coral, message);
      return { intent, sql, rows };
    }
    case "notion_page_content": {
      const { sql, rows } = await fetchNotionPageContentForMessage(
        coral,
        message,
      );
      return { intent, sql, rows };
    }
    case "repo_activity": {
      const { sql, rows } = await listRepoActivity(coral, message);
      return { intent, sql, rows };
    }
    case "repo_issues": {
      const { sql, rows } = await fetchRepoIssuesForMessage(coral, message);
      return { intent, sql, rows };
    }
    default:
      break;
  }

  const sql = getSqlForIntent(intent);
  if (!sql) {
    throw new ApiError(`No SQL template for intent: ${intent}`, 400);
  }

  const result = await coral.sql(sql);
  return { intent, sql, rows: result.rows };
}
