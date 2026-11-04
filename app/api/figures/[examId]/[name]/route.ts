import { promises as fs } from "fs";
import path from "path";
import { examFilesDir } from "@/lib/store";

const ALLOWED = /\.(svg|png|jpe?g|gif|webp)$/i;

export async function GET(_: Request, ctx: { params: Promise<{ examId: string; name: string }> }) {
  const { examId, name } = await ctx.params;
  const safeId = examId.replace(/[^a-zA-Z0-9_\-]/g, "");
  const base = path.basename(name);
  if (!safeId || !ALLOWED.test(base)) {
    return Response.json({ error: "非法文件" }, { status: 400 });
  }
  const dir = examFilesDir(safeId);
  const full = path.join(dir, base);
  if (!full.startsWith(dir + path.sep) && full !== dir) {
    return Response.json({ error: "非法路径" }, { status: 400 });
  }
  try {
    const buf = await fs.readFile(full);
    const ext = path.extname(base).toLowerCase();
    const mime =
      ext === ".svg"
        ? "image/svg+xml; charset=utf-8"
        : ext === ".png"
          ? "image/png"
          : ext === ".jpg" || ext === ".jpeg"
            ? "image/jpeg"
            : ext === ".gif"
              ? "image/gif"
              : ext === ".webp"
                ? "image/webp"
                : "application/octet-stream";
    return new Response(buf, {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return Response.json({ error: "文件不存在" }, { status: 404 });
  }
}
