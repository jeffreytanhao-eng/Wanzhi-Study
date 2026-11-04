import { requireUser } from "@/lib/auth";
import { listClasses } from "@/lib/accounts";
import { initDb } from "@/lib/db";
import { listExams } from "@/lib/exams";

export async function GET() {
  await initDb();
  const session = await requireUser(["student"]);
  if (session instanceof Response) return session;

  const myClasses = listClasses({ studentId: session.id });
  const teacherIds = [...new Set(myClasses.map((c) => c.teacherId))];
  const exams = await listExams();
  const published = exams
    .filter((e) => e.status === "published")
    .filter((e) => !e.ownerTeacherId || teacherIds.includes(e.ownerTeacherId))
    .map((e) => ({
      id: e.id,
      code: e.code,
      title: e.title,
      kind: e.kind || "exam",
      ownerTeacherId: e.ownerTeacherId || null,
      durationMin: e.durationMin,
    }));

  return Response.json({
    user: { id: session.id, username: session.username, displayName: session.displayName },
    classes: myClasses,
    materials: published,
  });
}
