import "server-only";
import { promises as fs } from "fs";
import path from "path";

// Local JSON-file storage. Each key is one file under DATA_DIR (default ./data).
// Writes are atomic (tmp + rename) and serialized per key within this process.

const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), "data"));

export function backend() {
  return "file" as const;
}
export function dataDir() {
  return DATA_DIR;
}

function fileFor(key: string) {
  const safe = key.replace(/[^a-zA-Z0-9_\-]/g, "_");
  return path.join(DATA_DIR, `${safe}.json`);
}

const locks = new Map<string, Promise<unknown>>();
async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) || Promise.resolve();
  const next = prev.catch(() => {}).then(fn);
  locks.set(key, next);
  try {
    return await next;
  } finally {
    if (locks.get(key) === next) locks.delete(key);
  }
}

async function readRaw<T>(key: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(fileFor(key), "utf8")) as T;
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}
async function writeRaw(key: string, value: unknown) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const f = fileFor(key);
  const tmp = `${f}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 1));
  await fs.rename(tmp, f);
}

export async function kvGet<T>(key: string): Promise<T | null> {
  return readRaw<T>(key);
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  await withLock(key, () => writeRaw(key, value));
}

export async function listAdd(key: string, item: string) {
  await withLock(key, async () => {
    const arr = (await readRaw<string[]>(key)) || [];
    if (!arr.includes(item)) arr.unshift(item);
    await writeRaw(key, arr);
  });
}
