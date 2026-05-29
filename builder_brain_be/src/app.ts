import express from "express";
import cors from "cors";

import { ApiError } from "./errors/errors";
import Logger from "./config/logger";
import { config } from "./config/env";
import { CoralClient } from "./coral/client";
import { makeSourcesRouter } from "./routes/sources.routes";
import { makeChatRouter } from "./routes/chat.routes";
import { makeInsightsRouter } from "./routes/insights.routes";
import { makeNotionRouter } from "./routes/notion.routes";
import { makeGithubRouter } from "./routes/github.routes";

process.on("uncaughtException", (e) => {
  Logger.error(e);
});

const app = express();

app.use((req, res, next) => {
  const startNs = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startNs) / 1_000_000;
    Logger.info("HTTP request completed", {
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      ip: req.ip,
    });
  });

  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: config.FE_ORIGIN }));

const coral = new CoralClient(config.CORAL_BIN);

app.use(makeSourcesRouter(coral));
app.use(makeNotionRouter(coral));
app.use(makeGithubRouter(coral));
app.use(makeInsightsRouter(coral));
app.use(makeChatRouter(coral));

// Error handling & logging
app.use(
  (
    err: unknown,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    if (err instanceof ApiError) {
      Logger.warn("Handled API error", {
        name: err.name,
        message: err.message,
        statusCode: err.status,
        path: req.originalUrl,
        method: req.method,
      });
      res.status(err.status).json({ error: err.message });
      return;
    }

    Logger.error("Unhandled application error", {
      error:
        err instanceof Error
          ? { name: err.name, message: err.message, stack: err.stack }
          : err,
      path: req.originalUrl,
      method: req.method,
    });

    const message =
      err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: message });
  },
);

export default app;
