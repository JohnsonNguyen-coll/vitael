import type { FastifyInstance } from "fastify";
import { supabase } from "../lib/supabase.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({ status: "ok", service: "vitael-backend" }));

  app.get("/health/db", async (_request, reply) => {
    const { error } = await supabase
      .from("profiles")
      .select("wallet_address", { count: "exact", head: true });

    if (error) {
      app.log.error({ error }, "Supabase health check failed");
      return reply.code(503).send({ status: "error", database: "unavailable" });
    }

    return { status: "ok", database: "connected" };
  });
}
