import { requireUser } from "@/lib/auth";
import { listClasses } from "@/lib/accounts";
import { initDb } from "@/lib/db";

export async function GET() {
  await initDb();
  const session = await requireUser(["teacher", "principal"]);
  if (session instanceof Response) return session;
  const classes =
    session.role === "principal" ? listClasses() : listClasses({ teacherId: session.id });
  return Response.json({ classes });
}
