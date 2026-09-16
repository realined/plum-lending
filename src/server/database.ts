import { readFile, readdir, mkdir } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { drizzle as drizzleLite } from "drizzle-orm/pglite";
import { config } from "./config";
export interface QueryDB {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<T[]>;
}
export interface Database extends QueryDB {
  transaction<T>(fn: (db: QueryDB) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  orm: ReturnType<typeof drizzlePg> | ReturnType<typeof drizzleLite>;
}
export async function createDatabase(url?: string): Promise<Database> {
  const directoryPath = path.join(process.cwd(), "db/migrations");
  const files = (await readdir(directoryPath))
    .filter((name) => /^\d+_.*\.sql$/.test(name))
    .sort();
  const migration = (
    await Promise.all(
      files.map((name) => readFile(path.join(directoryPath, name), "utf8")),
    )
  ).join("\n");
  if (url?.startsWith("postgres")) {
    const client = postgres(url, { max: 5, onnotice: () => {} });
    // Serialize migrations across worker/web startup. Transactional DDL is safe to replay.
    await client.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(739201)`;
      await tx.unsafe(migration);
    });
    return {
      query: async <T extends Record<string, unknown>>(
        sql: string,
        params: unknown[] = [],
      ) => [...(await client.unsafe(sql, params as never[]))] as unknown as T[],
      transaction: async <T>(fn: (db: QueryDB) => Promise<T>) =>
        (await client.begin((tx) =>
          fn({
            query: async <R extends Record<string, unknown>>(
              sql: string,
              params: unknown[] = [],
            ) =>
              [...(await tx.unsafe(sql, params as never[]))] as unknown as R[],
          }),
        )) as T,
      close: () => client.end(),
      orm: drizzlePg(client),
    };
  }
  const directory =
    url === ":memory:"
      ? undefined
      : (url ?? process.env.DEMO_DATA_DIR ?? ".data/demo");
  if (directory) await mkdir(directory, { recursive: true, mode: 0o700 });
  const lite = new PGlite(directory);
  await lite.exec(migration);
  return {
    query: async <T extends Record<string, unknown>>(
      sql: string,
      params: unknown[] = [],
    ) => (await lite.query<T>(sql, params)).rows,
    transaction: (fn) =>
      lite.transaction((tx) =>
        fn({
          query: async <T extends Record<string, unknown>>(
            sql: string,
            params: unknown[] = [],
          ) => (await tx.query<T>(sql, params)).rows,
        }),
      ),
    close: () => lite.close(),
    orm: drizzleLite(lite),
  };
}
const state = globalThis as unknown as { plumDB?: Promise<Database> };
export function db() {
  const mode = config().mode;
  return (state.plumDB ??= createDatabase(
    mode === "live" ? process.env.DATABASE_URL : undefined,
  ));
}
