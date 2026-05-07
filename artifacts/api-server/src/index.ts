import app from "./app";
import { logger } from "./lib/logger";
import { startScheduler, stopScheduler } from "./lib/scheduler";

let rawPort = process.env["PORT"];

if (!rawPort) {
  logger.warn("PORT environment variable is missing, defaulting to 8080");
  rawPort = "8080";
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startScheduler();
});

function shutdown(signal: string): void {
  logger.info({ signal }, "Received shutdown signal — stopping scheduler and closing server");
  stopScheduler();
  server.close(() => {
    logger.info("Server closed cleanly");
    process.exit(0);
  });
  // Force-exit after 10 s if connections are still draining
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
