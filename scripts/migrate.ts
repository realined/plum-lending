import { db } from "../src/server/database";
try {
  const database = await db();
  console.info("Database migration applied.");
  await database.close();
} catch {
  console.error(
    "Migration failed. Check PostgreSQL availability and local configuration. Credential values are not logged.",
  );
  process.exitCode = 1;
}
