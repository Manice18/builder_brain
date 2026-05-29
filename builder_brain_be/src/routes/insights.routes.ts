import { Router } from "express";

import type { CoralClient } from "../coral/client.js";
import { listAbandonedProjectsWithNotion } from "../services/abandonedProjects.js";
import { buildProjectMemory } from "../services/projectMemory.js";
import { scoreProjectPriorities } from "../services/scoring.js";
import type { ProjectMemoryRow } from "../services/projectMemory.types.js";

export function makeInsightsRouter(coral: CoralClient): Router {
  const router = Router();

  router.get("/api/insights/projects", async (req, res, next) => {
    try {
      const message =
        typeof req.query.q === "string" ? req.query.q : undefined;
      const result = await buildProjectMemory(coral, {
        message,
        mode: "overview",
      });
      const priorities = scoreProjectPriorities(result.rows);
      res.json({
        sql: result.sql,
        rows: result.rows,
        priorities,
        count: result.rows.length,
        notion_index_size: result.notion_index_size,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/insights/abandoned", async (_req, res, next) => {
    try {
      const result = await listAbandonedProjectsWithNotion(coral);
      const priorities = scoreProjectPriorities(
        result.rows as ProjectMemoryRow[],
      );
      res.json({
        sql: result.sql,
        rows: result.rows,
        priorities,
        count: result.rows.length,
        notion_index_size: result.notion_index_size,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
