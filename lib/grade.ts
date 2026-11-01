import "server-only";
import type { Exam, QResult, Submission } from "./types";
import { aiErrorMessage, gradeWithLLM } from "./ai";

const norm = (s: string) =>
  (s || "")
    .replace(/[\s$]/g, "")
    .replace(/[，,；;、]/g, ";")
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .replace(/\\left|\\right/g, "")
    .toLowerCase();

const letters = (s: string) =>
  [...new Set((s || "").toUpperCase().replace(/[^A-Z]/g, "").split(""))].sort().join("");

export async function gradeSubmission(exam: Exam, sub: Submission) {
  const results: Record<string, QResult> = {};
  const pending: Parameters<typeof gradeWithLLM>[0] = [];

  for (const q of exam.questions) {
    const ans = (sub.answers[q.id] || "").trim();
    const ref = exam.solutions?.[q.id]?.answer && !q.answer ? exam.solutions[q.id].answer : q.answer;
    if (q.type === "single" || q.type === "multiple") {
      const a = letters(ans);
      const r = letters(ref);
      if (!r) {
        pending.push({ q, student: a, reference: "" });
        continue;
      }
      if (a === r) results[q.id] = { score: q.score, max: q.score, correct: true, feedback: "回答正确" };
      else if (q.type === "multiple" && a && [...a].every((c) => r.includes(c)))
        results[q.id] = {
          score: Math.round((q.score / 2) * 2) / 2,
          max: q.score,
          correct: false,
          feedback: "少选，得一半分",
        };
      else
        results[q.id] = {
          score: 0,
          max: q.score,
          correct: false,
          feedback: a ? `选择了 ${a}，正确答案为 ${r}` : "未作答",
        };
      continue;
    }
    if (!ans) {
      results[q.id] = { score: 0, max: q.score, correct: false, feedback: "未作答" };
      continue;
    }
    if (q.type === "fill" && ref && norm(ans) === norm(ref)) {
      results[q.id] = { score: q.score, max: q.score, correct: true, feedback: "回答正确" };
      continue;
    }
    pending.push({ q, student: ans, reference: ref });
  }

  if (pending.length) {
    let llm: Awaited<ReturnType<typeof gradeWithLLM>> = {};
    let why = "";
    try {
      llm = await gradeWithLLM(pending);
    } catch (e) {
      console.error("LLM grading failed", e);
      why = aiErrorMessage(e);
    }
    for (const { q } of pending) {
      const g = llm[q.id];
      results[q.id] = g
        ? { score: g.score, max: q.score, correct: g.score >= q.score, feedback: g.feedback }
        : { score: 0, max: q.score, correct: false, feedback: `AI 阅卷暂不可用，待老师人工复核。${why ? "（" + why + "）" : ""}` };
    }
  }

  const total = Object.values(results).reduce((s, r) => s + r.score, 0);
  const max = exam.questions.reduce((s, q) => s + q.score, 0);
  return { results, total: Math.round(total * 10) / 10, max };
}

export function totals(results: Record<string, QResult>) {
  return Math.round(Object.values(results).reduce((s, r) => s + r.score, 0) * 10) / 10;
}
