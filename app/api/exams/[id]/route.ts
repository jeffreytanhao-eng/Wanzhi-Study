import { requireUser } from "@/lib/auth";
import { deleteExam, getExam, saveExam } from "@/lib/exams";
import { canMutateExam, canViewExam } from "@/lib/exam-access";
import type { Exam } from "@/lib/types";
import { kvSet } from "@/lib/store";
import { initDb } from "@/lib/db";

export async function GET(_: Request, ctx: RouteContext<"/api/exams/[id]">) {
  await initDb();
  const session = await requireUser(["teacher", "principal"]);
  if (session instanceof Response) return session;
  const { id } = await ctx.params;
  const e = await getExam(id);
  if (!e) return Response.json({ error: "试卷不存在" }, { status: 404 });
  if (!canViewExam(session, e)) return Response.json({ error: "无权限" }, { status: 403 });
  return Response.json(e);
}

export async function PUT(req: Request, ctx: RouteContext<"/api/exams/[id]">) {
  await initDb();
  const session = await requireUser(["teacher", "principal"]);
  if (session instanceof Response) return session;
  const { id } = await ctx.params;
  const body = (await req.json()) as Exam;
  const cur = await getExam(id);
  if (!cur) {
    if (body?.id !== id) return Response.json({ error: "试卷不存在" }, { status: 404 });
    body.ownerTeacherId = session.role === "teacher" ? session.id : body.ownerTeacherId || null;
    await saveExam(body);
    const { listAdd } = await import("@/lib/store");
    await listAdd("exams", id);
    return Response.json(body);
  }
  if (!canMutateExam(session, cur)) return Response.json({ error: "无权限" }, { status: 403 });
  const sols = { ...(cur.solutions || {}) };
  for (const q of body.questions) {
    const old = cur.questions.find((x) => x.id === q.id);
    if (!old || old.text !== q.text || old.answer !== q.answer || old.options.join("|") !== q.options.join("|") || (old.solution || "") !== (q.solution || ""))
      delete sols[q.id];
  }
  for (const k of Object.keys(sols)) if (!body.questions.find((q) => q.id === k)) delete sols[k];
  const kind = body.kind || cur.kind || "exam";
  const next: Exam = {
    ...cur,
    title: body.title,
    durationMin: kind === "courseware" ? Math.max(0, Math.round(body.durationMin || 0)) : Math.max(1, Math.round(body.durationMin || 60)),
    status: body.status,
    kind,
    knowledgePoints: body.knowledgePoints || [],
    showAnswersToStudents: !!body.showAnswersToStudents,
    questions: body.questions.map((q) => ({ ...q, score: Math.max(0, Number(q.score) || 0) })),
    solutions: sols,
    solutionsStatus: body.questions.every((q) => sols[q.id]) ? cur.solutionsStatus : "none",
    sourceFiles: cur.sourceFiles,
    ownerTeacherId: cur.ownerTeacherId ?? (session.role === "teacher" ? session.id : null),
  };
  await saveExam(next);
  await kvSet(`code:${next.code}`, next.id);
  return Response.json(next);
}

export async function DELETE(_: Request, ctx: RouteContext<"/api/exams/[id]">) {
  await initDb();
  const session = await requireUser(["teacher", "principal"]);
  if (session instanceof Response) return session;
  const { id } = await ctx.params;
  const cur = await getExam(id);
  if (!cur) return Response.json({ error: "试卷不存在" }, { status: 404 });
  if (!canMutateExam(session, cur)) return Response.json({ error: "无权限" }, { status: 403 });
  const ok = await deleteExam(id);
  if (!ok) return Response.json({ error: "试卷不存在" }, { status: 404 });
  return Response.json({ ok: true });
}
