import { isTeacher } from "@/lib/auth";
import { ensureSolutions, getExam, getSub } from "@/lib/exams";

export const maxDuration = 300;

// Teacher (any time) or a student who has submitted (sid) can trigger generation.
export async function POST(req: Request, ctx: RouteContext<"/api/exams/[id]/solutions">) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const sid = url.searchParams.get("sid");
  const force = url.searchParams.get("force") === "1";
  const teacher = await isTeacher();
  if (!teacher) {
    const s = sid ? await getSub(sid) : null;
    if (!s || s.examId !== id || !s.submittedAt) return Response.json({ error: "无权限" }, { status: 403 });
  }
  const exam = await getExam(id);
  if (!exam) return Response.json({ error: "试卷不存在" }, { status: 404 });
  if (
    exam.solutionsStatus === "running" &&
    Date.now() - (exam.solutionsUpdatedAt || 0) < 4 * 60 * 1000 &&
    !force
  )
    return Response.json({ status: "running" }, { status: 202 });
  try {
    const e = await ensureSolutions(id, force && teacher);
    return Response.json({ status: e.solutionsStatus, count: Object.keys(e.solutions || {}).length });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
