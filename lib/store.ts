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

export async function kvDel(key: string): Promise<void> {
  await withLock(key, async () => {
    try {
      await fs.unlink(fileFor(key));
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
  });
}

export async function listAdd(key: string, item: string) {
  await withLock(key, async () => {
    const arr = (await readRaw<string[]>(key)) || [];
    if (!arr.includes(item)) arr.unshift(item);
    await writeRaw(key, arr);
  });
}

export async function listRemove(key: string, item: string) {
  await withLock(key, async () => {
    const arr = ((await readRaw<string[]>(key)) || []).filter((x) => x !== item);
    await writeRaw(key, arr);
  });
}

/** Absolute path for binary uploads of an exam. */
export function examFilesDir(examId: string) {
  const safe = examId.replace(/[^a-zA-Z0-9_\-]/g, "_");
  return path.join(DATA_DIR, "files", safe);
}

export async function saveExamBinary(examId: string, filename: string, data: Buffer) {
  const dir = examFilesDir(examId);
  await fs.mkdir(dir, { recursive: true });
  const base = path.basename(filename).replace(/[^\w.\u4e00-\u9fff\- ()\[\]]+/g, "_") || "upload.bin";
  // avoid collisions
  let storedAs = base;
  let i = 1;
  while (true) {
    try {
      await fs.access(path.join(dir, storedAs));
      const ext = path.extname(base);
      const stem = path.basename(base, ext);
      storedAs = `${stem}_${i}${ext}`;
      i++;
    } catch {
      break;
    }
  }
  await fs.writeFile(path.join(dir, storedAs), data);
  return storedAs;
}

export async function removeExamFiles(examId: string) {
  const dir = examFilesDir(examId);
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
}
