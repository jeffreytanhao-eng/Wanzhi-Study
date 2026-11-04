import { requireUser, setUserPassword, loginWithPassword } from "@/lib/auth";
import { initDb } from "@/lib/db";

export async function POST(req: Request) {
  await initDb();
  const session = await requireUser();
  if (session instanceof Response) return session;

  let body: { current?: string; next?: string; confirm?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "请求格式错误" }, { status: 400 });
  }
  const current = String(body.current || "");
  const next = String(body.next || "");
  const confirm = String(body.confirm || "");
  if (!current || !next || !confirm) {
    return Response.json({ error: "请填写当前密码、新密码和确认密码" }, { status: 400 });
  }
  if (next.length < 6) return Response.json({ error: "新密码至少 6 位" }, { status: 400 });
  if (next !== confirm) return Response.json({ error: "两次输入的新密码不一致" }, { status: 400 });

  const ok = await loginWithPassword(session.username, current);
  if (!ok) return Response.json({ error: "当前密码不正确" }, { status: 400 });

  setUserPassword(session.id, next);
  return Response.json({ ok: true, message: "密码已更新" });
}
