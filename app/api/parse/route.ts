import { requireUser } from "@/lib/auth";
import { initDb } from "@/lib/db";
import { aiErrorMessage, parseCourseware, parseExam, parseExamFromText, type FileInput } from "@/lib/ai";
import { createExam, ensureSolutions, getExam, newId, saveExam } from "@/lib/exams";
import { saveExamBinary } from "@/lib/store";
import { extractWord, isWordName, wordMime } from "@/lib/word";
import type { ContentKind, Difficulty, KnowledgePoint, QRole, Question, SourceFile } from "@/lib/types";

export const maxDuration = 300;

function mapQuestions(
  items: {
    type: Question["type"];
    text: string;
    options?: string[];
    answer?: string;
    score?: number;
    role?: QRole;
    difficulty?: Difficulty | "";
    section?: string;
    solution?: string;
  }[],
): Question[] {
  return items.map((q) => ({
    id: newId(),
    type: q.type,
    text: q.text,
    options: q.type === "single" || q.type === "multiple" ? (q.options?.length ? q.options : ["A", "B", "C", "D", "E"]) : [],
    answer: q.answer || "",
    score: q.score && q.score > 0 ? q.score : q.type === "short" ? 10 : 5,
    role: q.role,
    difficulty: (q.difficulty || "") as Difficulty,
    section: q.section || "",
    solution: q.solution || "",
  }));
}

export async function POST(req: Request) {
  await initDb();
  const session = await requireUser(["teacher", "principal"]);
  if (session instanceof Response) return session;
  const form = await req.formData();
  const text = String(form.get("text") || "");
  const modeRaw = String(form.get("mode") || "auto").toLowerCase(); // auto | exam | courseware
  const files: FileInput[] = [];
  const binaries: { name: string; mime: string; data: Buffer }[] = [];
  const textChunks: string[] = [];
  let titleHint = "";
  let wordHeavy = false;

  for (const v of form.getAll("files")) {
    if (typeof v === "string") continue;
    const buf = Buffer.from(await v.arrayBuffer());
    let mediaType = v.type || "application/octet-stream";
    const name = v.name || "upload.bin";
    if (name.toLowerCase().endsWith(".pdf")) mediaType = "application/pdf";
    if (isWordName(name)) mediaType = wordMime(name);

    binaries.push({ name, mime: mediaType, data: buf });

    if (isWordName(name) || /\.txt$/i.test(name)) {
      wordHeavy = true;
      const extracted = await extractWord(buf, name);
      if (extracted.text.trim()) textChunks.push(`【文件：${name}】\n${extracted.text}`);
      if (!titleHint && extracted.titleHint) titleHint = extracted.titleHint;
      continue;
    }
    if (mediaType.startsWith("text/")) {
      textChunks.push(buf.toString("utf8"));
      files.push({ data: buf.toString("base64"), mediaType: "text/plain", name });
      continue;
    }
    files.push({ data: buf.toString("base64"), mediaType, name });
  }

  const combinedText = [text, ...textChunks].filter((s) => s.trim()).join("\n\n");
  if (!files.length && !combinedText.trim()) {
    return Response.json({ error: "请上传试卷/课件文件（PDF、Word、图片）或粘贴文本" }, { status: 400 });
  }

  try {
    let kind: ContentKind = modeRaw === "exam" ? "exam" : modeRaw === "courseware" ? "courseware" : "exam";
    let title = titleHint || "未命名";
    let questions: Question[] = [];
    let knowledgePoints: KnowledgePoint[] = [];

    const preferCourseware =
      modeRaw === "courseware" ||
      (modeRaw === "auto" && wordHeavy) ||
      /知识点|典例|即学即练|题组[ABC]|培优拔尖/.test(combinedText);

    if (preferCourseware && combinedText.trim()) {
      const parsed = await parseCourseware(combinedText, titleHint);
      kind = modeRaw === "exam" ? "exam" : parsed.suggestedKind === "exam" && modeRaw === "auto" && !wordHeavy ? "exam" : modeRaw === "exam" ? "exam" : "courseware";
      if (modeRaw === "courseware") kind = "courseware";
      if (modeRaw === "exam") kind = "exam";
      if (modeRaw === "auto") kind = wordHeavy || parsed.suggestedKind === "courseware" ? "courseware" : "exam";
      title = parsed.title || title;
      knowledgePoints = (parsed.knowledgePoints || []).map((k) => ({ id: newId(), title: k.title, content: k.content }));
      questions = mapQuestions(parsed.questions || []);
      if (kind === "exam") {
        // exam mode: keep only scorable items; drop empty knowledge-only
        questions = questions.filter((q) => q.role !== "example" || !!q.text?.trim());
        // Optionally keep examples as unscored practice — still include with score
      }
    } else if (combinedText.trim() && !files.length) {
      const parsed = await parseExamFromText(combinedText, titleHint);
      title = parsed.title || title;
      questions = mapQuestions(parsed.questions || []);
      kind = "exam";
    } else {
      const parsed = await parseExam(files, combinedText);
      title = parsed.title || title;
      questions = mapQuestions(parsed.questions || []);
      kind = modeRaw === "courseware" ? "courseware" : "exam";
    }

    const ownerTeacherId = session.role === "teacher" ? session.id : null;
    const exam = await createExam({
      ownerTeacherId,
      title,
      questions,
      durationMin: kind === "courseware" ? 0 : 60,
      kind,
      knowledgePoints,
      showAnswersToStudents: kind === "courseware",
    });

    if (binaries.length) {
      const sourceFiles: SourceFile[] = [];
      for (const f of binaries) {
        const storedAs = await saveExamBinary(exam.id, f.name, f.data);
        sourceFiles.push({ name: f.name, storedAs, size: f.data.length, mime: f.mime });
      }
      exam.sourceFiles = sourceFiles;
      await saveExam(exam);
    }

    let solutionsStatus = "none";
    let solutionsError = "";
    // For courseware, solutions often already in question.solution; still fill missing via AI for exam-like items
    const needSolve = exam.questions.some((q) => !q.solution?.trim() || !q.answer?.trim());
    if (needSolve && kind === "exam") {
      try {
        const withSol = await ensureSolutions(exam.id, false);
        solutionsStatus = withSol.solutionsStatus || "none";
        solutionsError = withSol.solutionsError || "";
        // copy generated steps into solution field when empty
        const cur = (await getExam(exam.id)) || exam;
        cur.questions = cur.questions.map((q) => {
          if (q.solution?.trim()) return q;
          const steps = cur.solutions?.[q.id]?.steps;
          return steps ? { ...q, solution: steps } : q;
        });
        await saveExam(cur);
      } catch (e) {
        solutionsStatus = "error";
        solutionsError = aiErrorMessage(e);
        const cur = (await getExam(exam.id)) || exam;
        cur.solutionsStatus = "error";
        cur.solutionsError = solutionsError;
        await saveExam(cur);
      }
    } else if (kind === "courseware") {
      // Seed solutions map from embedded solutions for consistency
      const cur = (await getExam(exam.id)) || exam;
      const sols: NonNullable<typeof cur.solutions> = { ...(cur.solutions || {}) };
      for (const q of cur.questions) {
        if (!sols[q.id] && (q.answer || q.solution)) {
          sols[q.id] = { answer: q.answer || "", steps: q.solution || "", sources: [], searched: false };
        }
      }
      cur.solutions = sols;
      cur.solutionsStatus = "done";
      await saveExam(cur);
      solutionsStatus = "done";
    }

    const finalExam = (await getExam(exam.id)) || exam;
    return Response.json({
      id: finalExam.id,
      title: finalExam.title,
      kind: finalExam.kind || "exam",
      count: finalExam.questions.length,
      knowledgeCount: finalExam.knowledgePoints?.length || 0,
      answered: finalExam.questions.filter((q) => !!q.answer?.trim()).length,
      solutionsStatus,
      solutionsError,
    });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "解析失败。" + aiErrorMessage(e) }, { status: 500 });
  }
}
