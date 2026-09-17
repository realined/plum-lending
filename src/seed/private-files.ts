import { mkdir, open, readFile, rename, rm, lstat } from "node:fs/promises";
import path from "node:path";

export const SEED_DIRECTORY = ".data/live-seed";
export class SeedError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
export async function privateJson(file: string): Promise<unknown> {
  const info = await lstat(file);
  if (!info.isFile() || info.size > 1_000_000 || (info.mode & 0o077) !== 0)
    throw new SeedError("SEED_PRIVATE_FILE_REQUIRED");
  return JSON.parse(await readFile(file, "utf8"));
}
export async function writePrivate(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = `${file}.${process.pid}.tmp`;
  const handle = await open(temp, "wx", 0o600);
  try {
    await handle.writeFile(JSON.stringify(value, null, 2));
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temp, file);
}
export async function exclusiveSeed<T>(operation: () => Promise<T>) {
  await mkdir(SEED_DIRECTORY, { recursive: true, mode: 0o700 });
  const file = `${SEED_DIRECTORY}/writer.lock`;
  let handle;
  try {
    handle = await open(file, "wx", 0o600);
  } catch {
    throw new SeedError("SEED_LOCK_PRESENT_INSPECT_BEFORE_RETRY");
  }
  try {
    return await operation();
  } finally {
    await handle.close();
    await rm(file);
  }
}
