import { requireUser } from "@/lib/auth";
import { addStudentToClass, removeStudentFromClass } from "@/lib/accounts";
import { initDb } from "@/lib/db";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await initDb();
  const session = await requireUser(["principal"]);
  if (session instanceof Response) return session;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  try {
    const klass = addStudentToClass(id, String(body.studentId || ""));
    return Response.json({ class: klass });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "添加失败" }, { status: 400 });
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await initDb();
  const session = await requireUser(["principal"]);
  if (session instanceof Response) return session;
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const studentId = url.searchParams.get("studentId") || "";
  try {
    const klass = removeStudentFromClass(id, studentId);
    return Response.json({ class: klass });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "移除失败" }, { status: 400 });
  }
}
