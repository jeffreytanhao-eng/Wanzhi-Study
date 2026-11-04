import { isTeacher, unauthorized } from "@/lib/auth";
import { getExam, getSub, saveSub } from "@/lib/exams";
import { gradeSubmission, totals } from "@/lib/grade";
import { toPublic } from "@/lib/types";

export const maxDuration = 300;

export async function GET(_: Request, ctx: RouteContext<"/api/submissions/[sid]">) {
  const { sid } = await ctx.params;
  const s = await getSub(sid);
  if (!s) return Response.json({ error: "记录不存在" }, { status: 404 });
  const e = await getExam(s.examId);
  if (!e) return Response.json({ error: "试卷不存在" }, { status: 404 });
  if (!s.submittedAt) {
    return Response.json({ submission: s, exam: { id: e.id, title: e.title, durationMin: e.durationMin, questions: e.questions.map((q) => toPublic(q)) } });
  }
  return Response.json({
    teacher: await isTeacher(),
    submission: s,
    exam: {
      id: e.id,
      title: e.title,
      durationMin: e.durationMin,
      questions: e.questions,
      solutions: e.solutions || {},
      solutionsStatus: e.solutionsStatus || "none",
      solutionsError: e.solutionsError || "",
    },
  });
}

export async function POST(req: Request, ctx: RouteContext<"/api/submissions/[sid]">) {
  const { sid } = await ctx.params;
  const { answers, auto } = await req.json();
  const s = await getSub(sid);
  if (!s) return Response.json({ error: "记录不存在" }, { status: 404 });
  if (s.submittedAt) return Response.json({ ok: true, already: true });
  const e = await getExam(s.examId);
  if (!e) return Response.json({ error: "试卷不存在" }, { status: 404 });
  s.answers = Object.fromEntries(
    Object.entries((answers || {}) as Record<string, unknown>).map(([k, v]) => [k, String(v ?? "").slice(0, 5000)]),
  );
  s.submittedAt = Date.now();
  s.auto = !!auto || s.submittedAt > s.deadline;
  const g = await gradeSubmission(e, s);
  s.results = g.results;
  s.total = g.total;
  s.max = g.max;
  await saveSub(s);
  return Response.json({ ok: true, total: s.total, max: s.max });
}

// Teacher manual score override: { qid, score, feedback? }
export async function PATCH(req: Request, ctx: RouteContext<"/api/submissions/[sid]">) {
  if (!(await isTeacher())) return unauthorized();
  const { sid } = await ctx.params;
  const { qid, score, feedback } = await req.json();
  const s = await getSub(sid);
  if (!s || !s.results?.[qid]) return Response.json({ error: "记录不存在" }, { status: 404 });
  const r = s.results[qid];
  r.score = Math.max(0, Math.min(r.max, Number(score) || 0));
  r.correct = r.score >= r.max;
  r.manual = true;
  if (typeof feedback === "string" && feedback.trim()) r.feedback = feedback.trim();
  s.total = totals(s.results);
  await saveSub(s);
  return Response.json({ ok: true, total: s.total });
}
