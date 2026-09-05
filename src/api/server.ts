import Fastify, { type FastifyInstance } from "fastify";
import { config } from "../shared/config.js";
import { logger } from "../shared/logger.js";
import { getDb } from "../db/index.js";
import { runMigrations } from "../db/migrate.js";
import { authHook } from "./auth.js";
import { apiError } from "./http.js";
import { registerTaskRoutes } from "./routes/tasks.js";
import { registerProjectRoutes } from "./routes/projects.js";
import { registerUserRoutes } from "./routes/users.js";
import { registerReportRoutes } from "./routes/reports.js";
import { registerOrderRoutes } from "./routes/orders.js";

/** Build a configured but unstarted Fastify instance. */
export async function buildServer(): Promise<FastifyInstance> {
  // Ensure the schema exists before any repo touches the DB.
  runMigrations(getDb());

  const app = Fastify({ logger: false });

  // Attach req.auth (when a valid bearer token is present) before every handler.
  app.addHook("preHandler", authHook);

  // Uniform error + not-found envelopes.
  app.setErrorHandler((err, _req, reply) => {
    const statusCode = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
    if (statusCode >= 500) {
      logger.error("request failed", { err: err.message });
    }
    reply
      .code(statusCode)
      .send(
        apiError(
          statusCode,
          statusCode >= 500 ? "internal_error" : "request_error",
          statusCode >= 500 ? "internal server error" : err.message,
        ),
      );
  });

  app.setNotFoundHandler((req, reply) => {
    reply
      .code(404)
      .send(apiError(404, "not_found", `route ${req.method} ${req.url} not found`));
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "firefunc-sample",
    time: new Date().toISOString(),
  }));

  await registerTaskRoutes(app);
  await registerProjectRoutes(app);
  await registerUserRoutes(app);
  await registerReportRoutes(app);
  await registerOrderRoutes(app);

  return app;
}

/** Boot the server and listen. */
export async function start(): Promise<FastifyInstance> {
  const app = await buildServer();
  await app.listen({ host: config.host, port: config.port });
  logger.info("server listening", { host: config.host, port: config.port });
  return app;
}

// Entry point when run directly (npm run dev).
if (import.meta.url === `file://${process.argv[1]}`) {
  start().catch((err) => {
    logger.error("failed to start server", { err: String(err) });
    process.exit(1);
  });
}
