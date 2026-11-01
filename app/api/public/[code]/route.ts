import { examByCode } from "@/lib/exams";
import { toPublic } from "@/lib/types";

export async function GET(_: Request, ctx: RouteContext<"/api/public/[code]">) {
  const { code } = await ctx.params;
  const e = await examByCode(code);
  if (!e || e.status !== "published") return Response.json({ error: "考试不存在或尚未发布" }, { status: 404 });
  return Response.json({
    id: e.id,
    code: e.code,
    title: e.title,
    durationMin: e.durationMin,
    total: e.questions.reduce((s, q) => s + q.score, 0),
    questions: e.questions.map(toPublic),
  });
}
