import { Router } from "express";
import { z } from "zod";

import type { CoralClient } from "../coral/client.js";
import { createGithubIntegration } from "../coral/integrations/github.js";
import { ApiError } from "../errors/errors.js";

const searchQuerySchema = z.object({
  q: z.string().min(1).max(200),
});

const repoParamsSchema = z.object({
  owner: z.string().min(1).max(100),
  repo: z.string().min(1).max(100),
});

export function makeGithubRouter(coral: CoralClient): Router {
  const router = Router();
  const github = createGithubIntegration(coral);

  router.get("/api/integrations/github/status", async (_req, res, next) => {
    try {
      const status = await github.getConnectionStatus();
      res.json(status);
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/integrations/github/repos", async (req, res, next) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 50, 100);
      const repos = await github.listUserRepos(limit);
      res.json({ count: repos.length, repos });
    } catch (error) {
      next(error);
    }
  });

  router.get(
    "/api/integrations/github/repos/:owner/:repo/issues",
    async (req, res, next) => {
      try {
        const parsed = repoParamsSchema.safeParse(req.params);
        if (!parsed.success) {
          throw new ApiError("Invalid owner or repo", 400);
        }
        const state =
          req.query.state === "closed" || req.query.state === "all"
            ? req.query.state
            : "open";
        const context = await github.getRepoIssuesContext(
          parsed.data.owner,
          parsed.data.repo,
          state,
        );
        res.json({
          owner: parsed.data.owner,
          repo: parsed.data.repo,
          state,
          count: context.open_issues.length,
          issues: context.open_issues,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/api/integrations/github/repos/:owner/:repo/commits",
    async (req, res, next) => {
      try {
        const parsed = repoParamsSchema.safeParse(req.params);
        if (!parsed.success) {
          throw new ApiError("Invalid owner or repo", 400);
        }
        const commits = await github.getCommits(
          parsed.data.owner,
          parsed.data.repo,
        );
        res.json({
          owner: parsed.data.owner,
          repo: parsed.data.repo,
          count: commits.length,
          commits,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get("/api/integrations/github/search/repos", async (req, res, next) => {
    try {
      const parsed = searchQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new ApiError("Query param `q` is required", 400);
      }
      const repos = await github.searchRepositories(parsed.data.q);
      res.json({ query: parsed.data.q, count: repos.length, repos });
    } catch (error) {
      next(error);
    }
  });

  router.get(
    "/api/integrations/github/search/issues",
    async (req, res, next) => {
      try {
        const parsed = searchQuerySchema.safeParse(req.query);
        if (!parsed.success) {
          throw new ApiError("Query param `q` is required", 400);
        }
        const issues = await github.searchIssues(parsed.data.q);
        res.json({ query: parsed.data.q, count: issues.length, issues });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get("/api/integrations/github/issues", async (req, res, next) => {
    try {
      const state =
        req.query.state === "open" || req.query.state === "closed"
          ? req.query.state
          : undefined;
      const issues = await github.listAssignedIssues(state);
      res.json({ count: issues.length, issues });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
