import { requireUser } from "@/lib/auth";
import { createClass, listClasses, listUsersByRole } from "@/lib/accounts";
import { initDb } from "@/lib/db";
import { SUBJECTS } from "@/lib/subjects";

export async function GET() {
  await initDb();
  const session = await requireUser(["principal"]);
  if (session instanceof Response) return session;
  return Response.json({
    classes: listClasses(),
    teachers: listUsersByRole("teacher"),
    students: listUsersByRole("student"),
    subjects: SUBJECTS,
  });
}

export async function POST(req: Request) {
  await initDb();
  const session = await requireUser(["principal"]);
  if (session instanceof Response) return session;
  const body = await req.json().catch(() => ({}));
  try {
    const klass = createClass(body);
    return Response.json({ class: klass });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "创建失败" }, { status: 400 });
  }
}
