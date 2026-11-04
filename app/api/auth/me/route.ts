import { getSessionUser } from "@/lib/auth";
import { initDb } from "@/lib/db";
import { teacherSubjectsOf } from "@/lib/accounts";

export async function GET() {
  await initDb();
  const u = await getSessionUser();
  if (!u) return Response.json({ user: null });
  const subjects = u.role === "teacher" ? teacherSubjectsOf(u.id) : undefined;
  return Response.json({
    user: {
      id: u.id,
      username: u.username,
      role: u.role,
      displayName: u.displayName,
      subjects,
    },
  });
}
