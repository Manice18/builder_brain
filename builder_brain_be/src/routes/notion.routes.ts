import { Router } from "express";
import { z } from "zod";

import type { CoralClient } from "../coral/client.js";
import { createNotionIntegration } from "../coral/integrations/notion.js";
import Logger from "../config/logger.js";
import { ApiError } from "../errors/errors.js";

const searchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  object: z.enum(["page", "data_source"]).optional(),
});

const pageIdSchema = z.object({
  pageId: z.string().min(1).max(64),
});

const dataSourceIdSchema = z.object({
  dataSourceId: z.string().min(1).max(64),
});

export function makeNotionRouter(coral: CoralClient): Router {
  const router = Router();
  const notion = createNotionIntegration(coral);

  router.get("/api/integrations/notion/status", async (_req, res, next) => {
    try {
      Logger.info("Getting notion connection status");
      const status = await notion.getConnectionStatus();
      Logger.info("Notion connection status", { status });
      res.json(status);
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/integrations/notion/search", async (req, res, next) => {
    try {
      const parsed = searchQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new ApiError("Query param `q` is required (1-200 chars)", 400);
      }
      const hits = await notion.searchObjects(
        parsed.data.q,
        parsed.data.object,
      );
      res.json({ query: parsed.data.q, count: hits.length, hits });
    } catch (error) {
      next(error);
    }
  });

  router.get(
    "/api/integrations/notion/pages/:pageId",
    async (req, res, next) => {
      try {
        const parsed = pageIdSchema.safeParse(req.params);
        if (!parsed.success) {
          throw new ApiError("Invalid pageId", 400);
        }
        const page = await notion.getPage(parsed.data.pageId);
        if (!page) {
          res.status(404).json({ error: "Page not found" });
          return;
        }
        res.json(page);
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/api/integrations/notion/pages/:pageId/content",
    async (req, res, next) => {
      try {
        const parsed = pageIdSchema.safeParse(req.params);
        if (!parsed.success) {
          throw new ApiError("Invalid pageId", 400);
        }
        const content = await notion.getPageContent(parsed.data.pageId);
        if (!content) {
          res.status(404).json({ error: "Page not found" });
          return;
        }
        res.json(content);
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/api/integrations/notion/data-sources/:dataSourceId/pages",
    async (req, res, next) => {
      try {
        const parsed = dataSourceIdSchema.safeParse(req.params);
        if (!parsed.success) {
          throw new ApiError("Invalid dataSourceId", 400);
        }
        const pages = await notion.getDataSourcePages(parsed.data.dataSourceId);
        res.json({
          data_source_id: parsed.data.dataSourceId,
          count: pages.length,
          pages,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
