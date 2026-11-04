import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  authCookieOptions,
  createSessionToken,
  loginWithPassword,
} from "@/lib/auth";
import { initDb } from "@/lib/db";

export async function POST(req: Request) {
  await initDb();
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "请求格式错误" }, { status: 400 });
  }
  const user = await loginWithPassword(String(body.username || ""), String(body.password || ""));
  if (!user) return Response.json({ error: "用户名或密码错误" }, { status: 401 });
  const token = createSessionToken(user);
  (await cookies()).set(SESSION_COOKIE, token, authCookieOptions());
  return Response.json({
    ok: true,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      displayName: user.displayName,
    },
  });
}
