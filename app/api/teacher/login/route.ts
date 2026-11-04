import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  authCookieOptions,
  createSessionToken,
  loginWithPassword,
} from "@/lib/auth";
import { initDb } from "@/lib/db";

/** Accepts {username, password} or legacy {code} mapped as password with username "teacher" — prefer username+password. */
export async function POST(req: Request) {
  await initDb();
  let body: { username?: string; password?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "请求格式错误" }, { status: 400 });
  }
  const username = String(body.username || "").trim();
  const password = String(body.password || body.code || "");
  if (!username || !password) {
    return Response.json({ error: "请输入用户名和密码" }, { status: 400 });
  }
  const user = await loginWithPassword(username, password);
  if (!user || (user.role !== "teacher" && user.role !== "principal")) {
    return Response.json({ error: "用户名或密码错误" }, { status: 401 });
  }
  (await cookies()).set(SESSION_COOKIE, createSessionToken(user), authCookieOptions());
  return Response.json({
    ok: true,
    user: { id: user.id, username: user.username, role: user.role, displayName: user.displayName },
  });
}
