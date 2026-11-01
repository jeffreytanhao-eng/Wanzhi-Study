import { examByCode, newId, saveSub } from "@/lib/exams";
import { listAdd } from "@/lib/store";
import type { Submission } from "@/lib/types";

export async function POST(req: Request, ctx: RouteContext<"/api/public/[code]/start">) {
  const { code } = await ctx.params;
  const { name } = await req.json();
  const e = await examByCode(code);
  if (!e || e.status !== "published") return Response.json({ error: "考试不存在或尚未发布" }, { status: 404 });
  const n = String(name || "").trim().slice(0, 40);
  if (!n) return Response.json({ error: "请输入姓名" }, { status: 400 });
  const now = Date.now();
  const s: Submission = {
    id: newId(),
    examId: e.id,
    name: n,
    startedAt: now,
    deadline: now + e.durationMin * 60 * 1000,
    answers: {},
  };
  await saveSub(s);
  await listAdd(`subs:${e.id}`, s.id);
  return Response.json({ sid: s.id, startedAt: s.startedAt, deadline: s.deadline });
}
