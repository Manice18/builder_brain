import { Router } from "express";
import { z } from "zod";

import { runChatPipeline } from "../agent/pipeline.js";
import { runChatPipelineStream } from "../agent/pipelineStream.js";
import type { CoralClient } from "../coral/client.js";
import { isAbortError } from "../utils/abort.js";

const chatBodySchema = z.object({
  message: z.string().min(1).max(4000),
});

function writeSse(
  res: import("express").Response,
  event: string,
  data: unknown,
): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
  const flush = (res as import("express").Response & { flush?: () => void })
    .flush;
  flush?.call(res);
}

export function makeChatRouter(coral: CoralClient): Router {
  const router = Router();

  router.post("/api/chat", async (req, res, next) => {
    try {
      const parsed = chatBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid body: message is required" });
        return;
      }

      const result = await runChatPipeline(coral, parsed.data.message);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/chat/stream", async (req, res, next) => {
    try {
      const parsed = chatBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid body: message is required" });
        return;
      }

      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders?.();

      const abortController = new AbortController();
      // `req` "close" fires when the POST body is fully read — not a client disconnect.
      const onClientDisconnect = () => {
        if (!res.writableEnded && !abortController.signal.aborted) {
          abortController.abort();
        }
      };
      res.on("close", onClientDisconnect);

      try {
        for await (const chunk of runChatPipelineStream(
          coral,
          parsed.data.message,
          abortController.signal,
        )) {
          if (abortController.signal.aborted) break;
          writeSse(res, chunk.type, chunk);
        }
      } catch (streamError) {
        if (isAbortError(streamError)) {
          writeSse(res, "cancelled", {
            type: "cancelled",
            message: "Stopped",
          });
        } else {
          const message =
            streamError instanceof Error
              ? streamError.message
              : "Stream failed";
          writeSse(res, "error", { type: "error", message });
        }
      } finally {
        res.off("close", onClientDisconnect);
      }

      if (!res.writableEnded) {
        res.end();
      }
    } catch (error) {
      next(error);
    }
  });

  return router;
}
