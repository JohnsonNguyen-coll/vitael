import "dotenv/config";
import { buildApp } from "./app.js";
import { env } from "./config/env.js";

const app = await buildApp();

async function shutdown(signal: string) {
  app.log.info({ signal }, "Shutting down");
  await app.close();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
