import { requireUser } from "@/lib/auth";
import { createExamFromUpload } from "@/lib/exams";
import { isWordName, wordMime } from "@/lib/word";
import type { ContentKind } from "@/lib/types";
import { initDb } from "@/lib/db";

export const maxDuration = 60;

export async function POST(req: Request) {
  await initDb();
  const session = await requireUser(["teacher", "principal"]);
  if (session instanceof Response) return session;
  const form = await req.formData();
  const text = String(form.get("text") || "");
  const modeRaw = String(form.get("mode") || "auto").toLowerCase();
  const kind: ContentKind = modeRaw === "courseware" ? "courseware" : "exam";
  const files: { name: string; mime: string; data: Buffer }[] = [];
  for (const v of form.getAll("files")) {
    if (typeof v === "string") continue;
    const buf = Buffer.from(await v.arrayBuffer());
    let mime = v.type || "application/octet-stream";
    const name = v.name || "upload.bin";
    if (name.toLowerCase().endsWith(".pdf")) mime = "application/pdf";
    if (isWordName(name)) mime = wordMime(name);
    files.push({ name, mime, data: buf });
  }
  if (!files.length && !text.trim()) {
    return Response.json({ error: "请上传文件或粘贴文本" }, { status: 400 });
  }
  try {
    const ownerTeacherId = session.role === "teacher" ? session.id : null;
    const exam = await createExamFromUpload(files, { textNote: text, kind, ownerTeacherId });
    return Response.json({ id: exam.id, title: exam.title, kind: exam.kind || "exam", pendingEntry: !exam.questions.length });
  } catch (e) {
    console.error(e);
    return Response.json({ error: e instanceof Error ? e.message : "创建失败" }, { status: 500 });
  }
}
