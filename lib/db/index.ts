import "server-only";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq, count } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { customAlphabet } from "nanoid";
import { dataDir } from "@/lib/store";
import { hashPassword } from "@/lib/password";
import * as schema from "./schema";
import { users } from "./schema";

const newId = customAlphabet("abcdefghijkmnpqrstuvwxyz23456789", 12);

const DATA_DIR = dataDir();
const DB_PATH = path.join(DATA_DIR, "wanzhi.sqlite");

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

function ensureSchema(sqlite: Database.Database) {
  sqlite.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      display_name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      grade TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS teacher_subjects (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subject TEXT NOT NULL,
      PRIMARY KEY (user_id, subject)
    );
    CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      teacher_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      subject TEXT NOT NULL,
      note TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS class_members (
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (class_id, student_id)
    );
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_classes_teacher ON classes(teacher_id);
  `);
}

function seedPrincipalIfNeeded(db: ReturnType<typeof drizzle<typeof schema>>) {
  const [{ n }] = db.select({ n: count() }).from(users).where(eq(users.role, "principal")).all();
  if (n > 0) return;

  let password = (process.env.PRINCIPAL_BOOTSTRAP_PASSWORD || "").trim();
  if (!password) {
    password = customAlphabet(
      "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789",
      16,
    )();
  }

  const now = Date.now();
  db.insert(users)
    .values({
      id: newId(),
      username: "principal",
      passwordHash: hashPassword(password),
      role: "principal",
      displayName: "超级校长",
      phone: null,
      email: null,
      grade: null,
      active: true,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  fs.mkdirSync(DATA_DIR, { recursive: true });
  const bootPath = path.join(DATA_DIR, "principal_bootstrap.json");
  fs.writeFileSync(
    bootPath,
    JSON.stringify(
      {
        username: "principal",
        password,
        createdAt: now,
        note: "仅首次建库写入；请登录后尽快修改密码。",
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  console.info("[wanzhi] seeded principal; see data/principal_bootstrap.json");
}

export function getDb() {
  if (_db) return _db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const sqlite = new Database(DB_PATH);
  ensureSchema(sqlite);
  _db = drizzle(sqlite, { schema });
  seedPrincipalIfNeeded(_db);
  return _db;
}

export async function initDb() {
  return getDb();
}

export function dbPath() {
  return DB_PATH;
}

export { schema, newId };
