import { requireUser } from "@/lib/auth";
import { createStudent, listUsersByRole } from "@/lib/accounts";
import { initDb } from "@/lib/db";

export async function GET() {
  await initDb();
  const session = await requireUser(["principal"]);
  if (session instanceof Response) return session;
  return Response.json({ students: listUsersByRole("student") });
}

export async function POST(req: Request) {
  await initDb();
  const session = await requireUser(["principal"]);
  if (session instanceof Response) return session;
  const body = await req.json().catch(() => ({}));
  try {
    const student = createStudent(body);
    return Response.json({ student });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "创建失败" }, { status: 400 });
  }
}
