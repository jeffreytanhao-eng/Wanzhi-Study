import "server-only";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, type UserRow } from "@/lib/db/schema";
import { verifyPassword, hashPassword } from "@/lib/password";

export const SESSION_COOKIE = "wanzhi_session";
/** @deprecated legacy shared passcode cookie */
export const COOKIE = "teacher_auth";

export type Role = "principal" | "teacher" | "student";

export type SessionUser = {
  id: string;
  username: string;
  role: Role;
  displayName: string;
  active: boolean;
};

type TokenPayload = { uid: string; role: Role; exp: number };

function appSecret() {
  return process.env.APP_SECRET || "exam-grader-secret";
}

function b64url(buf: Buffer | string) {
  const b = typeof buf === "string" ? Buffer.from(buf, "utf8") : buf;
  return b.toString("base64url");
}

function sign(payloadB64: string) {
  return createHmac("sha256", appSecret()).update(payloadB64).digest("base64url");
}

export function createSessionToken(user: { id: string; role: Role }, maxAgeSec = 60 * 60 * 24 * 30) {
  const payload: TokenPayload = {
    uid: user.id,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + maxAgeSec,
  };
  const payloadB64 = b64url(JSON.stringify(payload));
  return `${payloadB64}.${sign(payloadB64)}`;
}

function parseSessionToken(token: string): TokenPayload | null {
  try {
    const [payloadB64, sig] = token.split(".");
    if (!payloadB64 || !sig) return null;
    const expected = sign(payloadB64);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as TokenPayload;
    if (!payload?.uid || !payload?.role || !payload?.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (!["principal", "teacher", "student"].includes(payload.role)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function authCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}

function toSessionUser(row: UserRow): SessionUser {
  return {
    id: row.id,
    username: row.username,
    role: row.role as Role,
    displayName: row.displayName,
    active: !!row.active,
  };
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const c = await cookies();
  const token = c.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = parseSessionToken(token);
  if (!payload) return null;
  const db = getDb();
  const row = db.select().from(users).where(eq(users.id, payload.uid)).get();
  if (!row || !row.active) return null;
  if (row.role !== payload.role) return null;
  return toSessionUser(row);
}

export async function requireUser(roles?: Role[]): Promise<SessionUser | Response> {
  const u = await getSessionUser();
  if (!u) return unauthorized();
  if (roles && !roles.includes(u.role)) {
    return Response.json({ error: "无权限" }, { status: 403 });
  }
  return u;
}

export async function isTeacher() {
  const u = await getSessionUser();
  return !!u && (u.role === "teacher" || u.role === "principal");
}

export async function isPrincipal() {
  const u = await getSessionUser();
  return !!u && u.role === "principal";
}

export function unauthorized() {
  return Response.json({ error: "未登录或口令错误" }, { status: 401 });
}

export async function loginWithPassword(username: string, password: string): Promise<SessionUser | null> {
  const db = getDb();
  const row = db
    .select()
    .from(users)
    .where(eq(users.username, String(username || "").trim()))
    .get();
  if (!row || !row.active) return null;
  if (!verifyPassword(String(password || ""), row.passwordHash)) return null;
  return toSessionUser(row);
}

export function setUserPassword(userId: string, newPassword: string) {
  const db = getDb();
  db.update(users)
    .set({ passwordHash: hashPassword(newPassword), updatedAt: Date.now() })
    .where(eq(users.id, userId))
    .run();
}

/** Legacy helpers kept so old imports compile; shared passcode no longer gates teacher APIs. */
export async function getPasscode(): Promise<string> {
  return (process.env.TEACHER_PASSCODE || "teacher123").trim();
}
export function passcode() {
  return (process.env.TEACHER_PASSCODE || "teacher123").trim();
}
export function tokenFor(_code: string) {
  return "";
}
export function minPasscodeLen() {
  return 6;
}
export async function setPasscode(_newCode: string) {
  throw new Error("共享教师口令已停用，请使用个人账号密码");
}
