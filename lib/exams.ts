import "server-only";
import { customAlphabet } from "nanoid";
import { kvGet, kvSet, listAdd } from "./store";
import type { Exam, Solution, Submission } from "./types";
import { solveQuestion } from "./ai";

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
    title: partial.title || "未命名试卷",
    durationMin: partial.durationMin || 60,
    status: "draft",
    questions: partial.questions || [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    solutionsStatus: "none",
  };
  await saveExam(e);
  await listAdd("exams", e.id);
  return e;
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
  try {
    await pool(todo, 4, async (q) => {
      try {
        sols[q.id] = await solveQuestion(q, true);
      } catch (e) {
        console.error("solve failed", q.id, e);
      }
    });
    const fresh = (await getExam(examId)) || exam;
    fresh.solutions = { ...(fresh.solutions || {}), ...sols };
    fresh.solutionsStatus = exam.questions.every((q) => fresh.solutions?.[q.id]) ? "done" : "error";
    fresh.solutionsUpdatedAt = Date.now();
    await saveExam(fresh);
    return fresh;
  } catch (e) {
    exam.solutionsStatus = "error";
    await saveExam(exam);
    throw e;
  }
}
