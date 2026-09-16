import { config } from "../src/server/config";
import { workOnce } from "../src/server/worker";
import { db } from "../src/server/database";
if (!process.env.DATABASE_URL)
  throw new Error(
    "Separate workers require PostgreSQL. Use embedded demo worker otherwise.",
  );
config();
let stopped = false;
process.on("SIGTERM", () => {
  stopped = true;
});
process.on("SIGINT", () => {
  stopped = true;
});
console.info(JSON.stringify({ event: "worker.started" }));
while (!stopped) {
  try {
    if (!(await workOnce())) await new Promise((r) => setTimeout(r, 1000));
  } catch {
    console.warn(JSON.stringify({ event: "worker.poll_failed" }));
    await new Promise((r) => setTimeout(r, 3000));
  }
}
await (await db()).close();
