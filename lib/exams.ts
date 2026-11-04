import "server-only";
import { customAlphabet } from "nanoid";
import { kvDel, kvGet, kvSet, listAdd, listRemove, removeExamFiles, saveExamBinary } from "./store";
import type { Exam, Solution, SourceFile, Submission } from "./types";
import { aiErrorMessage, solveQuestion } from "./ai";

export const newId = customAlphabet("abcdefghijkmnpqrstuvwxyz23456789", 12);
export const newCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

export const getExam = (id: string) => kvGet<Exam>(`exam:${id}`);
export async function saveExam(e: Exam) {
  e.updatedAt = Date.now();
  await kvSet(`exam:${e.id}`, e);
  await kvSet(`code:${e.code}`, e.id);
}
export async function createExam(partial: Partial<Exam>) {
  const e: Exam = {
    id: newId(),
    code: newCode(),
    title: partial.title || (partial.kind === "courseware" ? "未命名课件" : "未命名试卷"),
    durationMin: partial.durationMin ?? (partial.kind === "courseware" ? 0 : 60),
    status: "draft",
    kind: partial.kind || "exam",
    knowledgePoints: partial.knowledgePoints || [],
    showAnswersToStudents: partial.showAnswersToStudents ?? (partial.kind === "courseware"),
    questions: partial.questions || [],
    sourceFiles: partial.sourceFiles,
    ownerTeacherId: partial.ownerTeacherId ?? null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    solutionsStatus: "none",
  };
  await saveExam(e);
  await listAdd("exams", e.id);
  return e;
}

/** Create a draft from uploaded files without AI — title from first filename, binaries kept for manual entry. */
export async function createExamFromUpload(
  files: { name: string; mime: string; data: Buffer }[],
  opts?: { title?: string; textNote?: string; kind?: import("./types").ContentKind; ownerTeacherId?: string | null },
) {
  if (!files.length && !opts?.textNote?.trim()) {
    throw new Error("请上传试卷文件或粘贴文本");
  }
  const id = newId();
  const sourceFiles: SourceFile[] = [];
  for (const f of files) {
    const storedAs = await saveExamBinary(id, f.name, f.data);
    sourceFiles.push({
      name: f.name,
      storedAs,
      size: f.data.length,
      mime: f.mime || "application/octet-stream",
    });
  }
  let title = (opts?.title || "").trim();
  if (!title && files[0]) {
    title = files[0].name.replace(/\.[^.]+$/, "").trim() || files[0].name;
  }
  const kind = opts?.kind || "exam";
  if (!title) title = kind === "courseware" ? "未命名课件" : "未命名试卷";
  const e: Exam = {
    id,
    code: newCode(),
    title,
    durationMin: kind === "courseware" ? 0 : 60,
    status: "draft",
    kind,
    knowledgePoints: [],
    showAnswersToStudents: kind === "courseware",
    questions: [],
    sourceFiles: sourceFiles.length ? sourceFiles : undefined,
    ownerTeacherId: opts?.ownerTeacherId ?? null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    solutionsStatus: "none",
  };
  // optional pasted text kept as a note question stub? Better: store as solutionsError unused field — no.
  // Put pasted text into a short question draft if provided so teacher doesn't lose it.
  if (opts?.textNote?.trim()) {
    e.questions = [
      {
        id: newId(),
        type: "short",
        text: opts.textNote.trim(),
        options: [],
        answer: "",
        score: 10,
      },
    ];
  }
  await saveExam(e);
  await listAdd("exams", e.id);
  return e;
}

export async function deleteExam(id: string) {
  const e = await getExam(id);
  if (!e) return false;
  const subIds = (await kvGet<string[]>(`subs:${id}`)) || [];
  for (const sid of subIds) await kvDel(`sub:${sid}`);
  await kvDel(`subs:${id}`);
  await kvDel(`code:${e.code}`);
  await kvDel(`exam:${id}`);
  await listRemove("exams", id);
  await removeExamFiles(id);
  return true;
}

export async function listExams() {
  const ids = (await kvGet<string[]>("exams")) || [];
  const exams = await Promise.all(ids.map(getExam));
  return exams.filter(Boolean) as Exam[];
}
export async function examByCode(code: string) {
  const id = await kvGet<string>(`code:${code.toUpperCase()}`);
  return id ? getExam(id) : null;
}

export const getSub = (id: string) => kvGet<Submission>(`sub:${id}`);
export const saveSub = (s: Submission) => kvSet(`sub:${s.id}`, s);
export async function listSubs(examId: string) {
  const ids = (await kvGet<string[]>(`subs:${examId}`)) || [];
  return (await Promise.all(ids.map(getSub))).filter(Boolean) as Submission[];
}

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>) {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    }),
  );
  return out;
}

/** Generate (missing) solutions for all questions; stores on the exam. */
export async function ensureSolutions(examId: string, force = false) {
  const exam = await getExam(examId);
  if (!exam) throw new Error("not found");
  const sols: Record<string, Solution> = force ? {} : { ...(exam.solutions || {}) };
  const todo = exam.questions.filter((q) => !sols[q.id]);
  if (!todo.length) return exam;
  exam.solutionsStatus = "running";
  exam.solutionsUpdatedAt = Date.now();
  await saveExam(exam);
  let lastErr = "";
  try {
    await pool(todo, 4, async (q) => {
      try {
        sols[q.id] = await solveQuestion(q, true);
      } catch (e) {
        console.error("solve failed", q.id, e);
        lastErr = aiErrorMessage(e);
      }
    });
    const fresh = (await getExam(examId)) || exam;
    fresh.solutions = { ...(fresh.solutions || {}), ...sols };
    // Backfill empty reference answers from generated solutions (editable draft).
    fresh.questions = fresh.questions.map((q) => {
      if (q.answer?.trim()) return q;
      const a = fresh.solutions?.[q.id]?.answer?.trim();
      return a ? { ...q, answer: a } : q;
    });
    fresh.solutionsStatus = exam.questions.every((q) => fresh.solutions?.[q.id]) ? "done" : "error";
    fresh.solutionsUpdatedAt = Date.now();
    fresh.solutionsError = fresh.solutionsStatus === "error" ? lastErr : "";
    await saveExam(fresh);
    return fresh;
  } catch (e) {
    exam.solutionsStatus = "error";
    await saveExam(exam);
    throw e;
  }
}
