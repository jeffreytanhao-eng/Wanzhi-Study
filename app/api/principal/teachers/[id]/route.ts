import { requireUser } from "@/lib/auth";
import { deleteTeacher, getUser, updateTeacher } from "@/lib/accounts";
import { initDb } from "@/lib/db";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  await initDb();
  const session = await requireUser(["principal"]);
  if (session instanceof Response) return session;
  const { id } = await ctx.params;
  const teacher = getUser(id);
  if (!teacher || teacher.role !== "teacher") {
    return Response.json({ error: "老师不存在" }, { status: 404 });
  }
  return Response.json({ teacher });
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await initDb();
  const session = await requireUser(["principal"]);
  if (session instanceof Response) return session;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  try {
    const teacher = updateTeacher(id, body);
    return Response.json({ teacher });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "更新失败" }, { status: 400 });
  }
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  await initDb();
  const session = await requireUser(["principal"]);
  if (session instanceof Response) return session;
  const { id } = await ctx.params;
  try {
    deleteTeacher(id);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "删除失败" }, { status: 400 });
  }
}
