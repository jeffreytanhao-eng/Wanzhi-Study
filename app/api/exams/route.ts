import { isTeacher, unauthorized } from "@/lib/auth";
import { createExam, listExams, listSubs } from "@/lib/exams";
import { backend } from "@/lib/store";

export async function GET() {
  if (!(await isTeacher())) return unauthorized();
  const exams = await listExams();
  const rows = await Promise.all(
    exams.map(async (e) => ({
      id: e.id,
      code: e.code,
      title: e.title,
      status: e.status,
      durationMin: e.durationMin,
      count: e.questions.length,
      total: e.questions.reduce((s, q) => s + q.score, 0),
      submissions: (await listSubs(e.id)).filter((s) => s.submittedAt).length,
      updatedAt: e.updatedAt,
    })),
  );
  return Response.json({ exams: rows, storage: backend() });
}

export async function POST(req: Request) {
  if (!(await isTeacher())) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const e = await createExam(body || {});
  return Response.json({ id: e.id });
}
