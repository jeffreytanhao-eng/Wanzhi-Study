import { isTeacher, unauthorized } from "@/lib/auth";
import { aiErrorMessage, parseExam, type FileInput } from "@/lib/ai";
import { createExam, newId } from "@/lib/exams";
import type { Question } from "@/lib/types";

export const maxDuration = 300;

export async function POST(req: Request) {
  if (!(await isTeacher())) return unauthorized();
  const form = await req.formData();
  const text = String(form.get("text") || "");
  const files: FileInput[] = [];
  for (const v of form.getAll("files")) {
    if (typeof v === "string") continue;
    const buf = Buffer.from(await v.arrayBuffer());
    let mediaType = v.type || "application/octet-stream";
    if (v.name.toLowerCase().endsWith(".pdf")) mediaType = "application/pdf";
    if (mediaType.startsWith("text/")) {
      files.push({ data: buf.toString("base64"), mediaType: "text/plain", name: v.name });
      continue;
    }
    files.push({ data: buf.toString("base64"), mediaType, name: v.name });
  }
  if (!files.length && !text.trim()) return Response.json({ error: "请上传试卷文件或粘贴文本" }, { status: 400 });
  try {
    const parsed = await parseExam(files, text);
    const questions: Question[] = parsed.questions.map((q) => ({
      id: newId(),
      type: q.type,
      text: q.text,
      options: q.type === "single" || q.type === "multiple" ? q.options : [],
      answer: q.answer || "",
      score: q.score > 0 ? q.score : q.type === "short" ? 10 : 5,
    }));
    const exam = await createExam({ title: parsed.title, questions, durationMin: 60 });
    return Response.json({ id: exam.id });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "解析失败。" + aiErrorMessage(e) }, { status: 500 });
  }
}
