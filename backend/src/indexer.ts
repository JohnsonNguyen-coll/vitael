import "dotenv/config";
import { runIndexer } from "./indexer/worker.js";

const controller = new AbortController();
const stop = () => controller.abort();
process.once("SIGINT", stop);
process.once("SIGTERM", stop);

runIndexer(controller.signal).catch((error) => {
  console.error("[indexer] fatal", error);
  process.exitCode = 1;
});
