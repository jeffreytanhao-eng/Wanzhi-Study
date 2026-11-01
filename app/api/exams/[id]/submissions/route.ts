import { isTeacher, unauthorized } from "@/lib/auth";
import { listSubs } from "@/lib/exams";

export async function GET(_: Request, ctx: RouteContext<"/api/exams/[id]/submissions">) {
  if (!(await isTeacher())) return unauthorized();
  const { id } = await ctx.params;
  const subs = await listSubs(id);
  return Response.json({ submissions: subs });
}
