import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import { env } from "./config/env.js";
import { chatRoutes } from "./routes/chat.js";
import { healthRoutes } from "./routes/health.js";
import { profileRoutes } from "./routes/profiles.js";
import { protocolRoutes } from "./routes/protocol.js";
import { transactionRoutes } from "./routes/transactions.js";

export async function buildApp() {
  const app = Fastify({ logger: true, trustProxy: true });

  await app.register(helmet);
  await app.register(multipart, { limits: { files: 1, fileSize: 2 * 1024 * 1024 } });
  await app.register(cors, { origin: env.FRONTEND_URL, credentials: true });
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });

  await app.register(healthRoutes);
  await app.register(profileRoutes, { prefix: "/api" });
  await app.register(chatRoutes, { prefix: "/api" });
  await app.register(transactionRoutes, { prefix: "/api" });
  await app.register(protocolRoutes, { prefix: "/api" });

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ error }, "Unhandled API error");
    void reply.code(500).send({ error: "Internal server error" });
  });

  return app;
}
