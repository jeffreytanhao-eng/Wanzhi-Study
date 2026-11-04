import { promises as fs } from "fs";
import path from "path";
import { isTeacher, unauthorized } from "@/lib/auth";
import { getExam } from "@/lib/exams";
import { examFilesDir } from "@/lib/store";

export async function GET(_: Request, ctx: RouteContext<"/api/exams/[id]/source/[name]">) {
  if (!(await isTeacher())) return unauthorized();
  const { id, name } = await ctx.params;
  const exam = await getExam(id);
  if (!exam) return Response.json({ error: "试卷不存在" }, { status: 404 });
  const meta = (exam.sourceFiles || []).find((f) => f.storedAs === name || f.name === name);
  if (!meta) return Response.json({ error: "附件不存在" }, { status: 404 });
  const full = path.join(examFilesDir(id), meta.storedAs);
  // prevent path escape
  if (!full.startsWith(examFilesDir(id))) return Response.json({ error: "非法路径" }, { status: 400 });
  try {
    const buf = await fs.readFile(full);
    return new Response(buf, {
      headers: {
        "Content-Type": meta.mime || "application/octet-stream",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(meta.name)}`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return Response.json({ error: "文件丢失" }, { status: 404 });
  }
}
