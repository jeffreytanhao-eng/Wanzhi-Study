import "server-only";
import { getCache } from "@vercel/functions";
import { put, get as blobGet } from "@vercel/blob";

// Storage adapter. Prefers durable stores when configured:
//  1. Vercel Blob (BLOB_READ_WRITE_TOKEN)  — durable
//  2. Upstash Redis REST (KV_REST_API_URL / UPSTASH_REDIS_REST_URL) — durable
//  3. Vercel Runtime Cache — fallback, works with zero config but may be evicted.

const TTL = 60 * 60 * 24 * 30; // 30 days for the cache fallback
const NS = "examgrader-v1";

type Backend = "blob" | "redis" | "cache";

export function backend(): Backend {
  if (process.env.BLOB_READ_WRITE_TOKEN) return "blob";
  if (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) return "redis";
  return "cache";
}

function redisCfg() {
  return {
    url: (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL)!,
    token: (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN)!,
  };
}

async function redisCmd(cmd: unknown[]) {
  const { url, token } = redisCfg();
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`redis ${r.status}`);
  return (await r.json()).result;
}

export async function kvGet<T>(key: string): Promise<T | null> {
  const k = `${NS}:${key}`;
  const b = backend();
  if (b === "blob") {
    try {
      const res = await blobGet(`${NS}/${key}.json`, { access: "private", useCache: false });
      if (!res || res.statusCode !== 200) return null;
      const text = await new Response(res.stream).text();
      return JSON.parse(text) as T;
    } catch (e: unknown) {
      if (e instanceof Error && /not.?found/i.test(e.name + e.message)) return null;
      throw e;
    }
  }
  if (b === "redis") {
    const v = await redisCmd(["GET", k]);
    return v ? (JSON.parse(v) as T) : null;
  }
  const v = await getCache().get(k);
  if (v === undefined || v === null) return null;
  return (typeof v === "string" ? JSON.parse(v) : v) as T;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  const k = `${NS}:${key}`;
  const json = JSON.stringify(value);
  const b = backend();
  if (b === "blob") {
    await put(`${NS}/${key}.json`, json, {
      access: "private",
      allowOverwrite: true,
      addRandomSuffix: false,
      contentType: "application/json",
    });
    return;
  }
  if (b === "redis") {
    await redisCmd(["SET", k, json]);
    return;
  }
  await getCache().set(k, json, { ttl: TTL, name: key.split(":")[0] });
}

// simple list helpers (prototype-grade; not concurrency safe for huge loads)
export async function listAdd(key: string, item: string) {
  const arr = (await kvGet<string[]>(key)) || [];
  if (!arr.includes(item)) arr.unshift(item);
  await kvSet(key, arr);
}
