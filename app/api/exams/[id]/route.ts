import { isTeacher, unauthorized } from "@/lib/auth";
import { getExam, saveExam } from "@/lib/exams";
import type { Exam } from "@/lib/types";
import { kvSet } from "@/lib/store";

export async function GET(_: Request, ctx: RouteContext<"/api/exams/[id]">) {
  if (!(await isTeacher())) return unauthorized();
  const { id } = await ctx.params;
  const e = await getExam(id);
  if (!e) return Response.json({ error: "试卷不存在" }, { status: 404 });
  return Response.json(e);
}

export async function PUT(req: Request, ctx: RouteContext<"/api/exams/[id]">) {
  if (!(await isTeacher())) return unauthorized();
  const { id } = await ctx.params;
  const body = (await req.json()) as Exam;
  const cur = await getExam(id);
  if (!cur) {
    // restore from teacher's local backup
    if (body?.id !== id) return Response.json({ error: "试卷不存在" }, { status: 404 });
    await saveExam(body);
    const { listAdd } = await import("@/lib/store");
    await listAdd("exams", id);
    return Response.json(body);
  }
  // drop solutions of changed questions
  const sols = { ...(cur.solutions || {}) };
  for (const q of body.questions) {
    const old = cur.questions.find((x) => x.id === q.id);
    if (!old || old.text !== q.text || old.answer !== q.answer || old.options.join("|") !== q.options.join("|"))
      delete sols[q.id];
  }
  for (const k of Object.keys(sols)) if (!body.questions.find((q) => q.id === k)) delete sols[k];
  const next: Exam = {
    ...cur,
    title: body.title,
    durationMin: Math.max(1, Math.round(body.durationMin || 60)),
    status: body.status,
    questions: body.questions.map((q) => ({ ...q, score: Math.max(0, Number(q.score) || 0) })),
    solutions: sols,
    solutionsStatus: body.questions.every((q) => sols[q.id]) ? cur.solutionsStatus : "none",
  };
  await saveExam(next);
  await kvSet(`code:${next.code}`, next.id);
  return Response.json(next);
}
