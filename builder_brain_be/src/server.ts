import app from "./app";
import { config } from "./config/env";
import Logger from "./config/logger";

const port = config.PORT;

const server = app.listen(port, () => {
  Logger.info("Server started", {
    port,
    url: `http://localhost:${port}`,
    environment: config.ENVIRONMENT,
  });
});

const shutdown = (signal: NodeJS.Signals) => {
  Logger.warn("Shutdown signal received", { signal });
  server.close((error?: Error) => {
    if (error) {
      Logger.error("Error during server shutdown", { error });
      process.exit(1);
    }
    Logger.info("Server closed gracefully");
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
