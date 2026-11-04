import { examByCode } from "@/lib/exams";
import { isCourseware, toPublic } from "@/lib/types";

export async function GET(_: Request, ctx: RouteContext<"/api/public/[code]">) {
  const { code } = await ctx.params;
  const e = await examByCode(code);
  if (!e || e.status !== "published") return Response.json({ error: "内容不存在或尚未发布" }, { status: 404 });
  const courseware = isCourseware(e);
  const reveal = courseware && !!e.showAnswersToStudents;
  return Response.json({
    id: e.id,
    code: e.code,
    title: e.title,
    kind: e.kind || "exam",
    durationMin: e.durationMin,
    showAnswersToStudents: !!e.showAnswersToStudents,
    knowledgePoints: courseware ? e.knowledgePoints || [] : [],
    total: e.questions.reduce((s, q) => s + q.score, 0),
    questions: e.questions.map((q) => toPublic(q, reveal)),
  });
}
