import { Router } from "express";

import type { CoralClient } from "../coral/client";

export function makeSourcesRouter(coral: CoralClient): Router {
  const router = Router();

  router.get("/api/sources/status", async (_req, res, next) => {
    try {
      const sql = `
        SELECT schema_name, key, is_set
        FROM coral.inputs
        WHERE schema_name IN ('github', 'notion')
      `;
      const result = await coral.sql(sql);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
