import { requireUser } from "@/lib/auth";
import { deleteStudent, getUser, updateStudent } from "@/lib/accounts";
import { initDb } from "@/lib/db";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  await initDb();
  const session = await requireUser(["principal"]);
  if (session instanceof Response) return session;
  const { id } = await ctx.params;
  const student = getUser(id);
  if (!student || student.role !== "student") {
    return Response.json({ error: "学生不存在" }, { status: 404 });
  }
  return Response.json({ student });
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await initDb();
  const session = await requireUser(["principal"]);
  if (session instanceof Response) return session;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  try {
    const student = updateStudent(id, body);
    return Response.json({ student });
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
    deleteStudent(id);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "删除失败" }, { status: 400 });
  }
}
