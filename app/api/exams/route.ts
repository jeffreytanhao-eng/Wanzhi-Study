import { requireUser } from "@/lib/auth";
import { createExam, listExams, listSubs } from "@/lib/exams";
import { filterExamsForUser } from "@/lib/exam-access";
import { backend } from "@/lib/store";
import { aiStatus } from "@/lib/ai";
import { initDb } from "@/lib/db";

export async function GET() {
  await initDb();
  const session = await requireUser(["teacher", "principal"]);
  if (session instanceof Response) return session;
  const exams = filterExamsForUser(session, await listExams());
  const rows = await Promise.all(
    exams.map(async (e) => ({
      id: e.id,
      code: e.code,
      title: e.title,
      status: e.status,
      kind: e.kind || "exam",
      durationMin: e.durationMin,
      count: e.questions.length,
      knowledgeCount: e.knowledgePoints?.length || 0,
      total: e.questions.reduce((s, q) => s + q.score, 0),
      submissions: (await listSubs(e.id)).filter((s) => s.submittedAt).length,
      updatedAt: e.updatedAt,
      sourceCount: e.sourceFiles?.length || 0,
      sourceNames: (e.sourceFiles || []).map((f) => f.name),
      pendingEntry: (e.sourceFiles?.length || 0) > 0 && (e.questions.length === 0 || e.questions.every((q) => !q.text?.trim())),
      showAnswersToStudents: !!e.showAnswersToStudents,
      ownerTeacherId: e.ownerTeacherId || null,
    })),
  );
  return Response.json({
    exams: rows,
    storage: backend(),
    ai: aiStatus(),
    me: { id: session.id, role: session.role, displayName: session.displayName },
  });
}

export async function POST(req: Request) {
  await initDb();
  const session = await requireUser(["teacher", "principal"]);
  if (session instanceof Response) return session;
  const body = await req.json().catch(() => ({}));
  const ownerTeacherId = session.role === "teacher" ? session.id : body.ownerTeacherId || null;
  const e = await createExam({ ...(body || {}), ownerTeacherId });
  return Response.json({ id: e.id });
}
