export type QType = "single" | "multiple" | "fill" | "short";

export const QTYPE_LABEL: Record<QType, string> = {
  single: "单选题",
  multiple: "多选题",
  fill: "填空题",
  short: "解答/计算题",
};

export interface Question {
  id: string;
  type: QType;
  text: string; // Markdown + LaTeX ($...$)
  options: string[]; // for single/multiple, without "A." prefix
  answer: string; // single: "B"; multiple: "AC"; fill: "3；-1"; short: reference solution/answer
  score: number;
}

export interface Solution {
  answer: string;
  steps: string; // markdown
  sources: { title: string; url: string }[];
  searched: boolean;
}

export interface Exam {
  id: string;
  code: string;
  title: string;
  durationMin: number;
  status: "draft" | "published";
  questions: Question[];
  solutions?: Record<string, Solution>;
  solutionsStatus?: "none" | "running" | "done" | "error";
  solutionsUpdatedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface QResult {
  score: number;
  max: number;
  correct: boolean;
  feedback: string;
}

export interface Submission {
  id: string;
  examId: string;
  name: string;
  startedAt: number;
  deadline: number;
  submittedAt?: number;
  answers: Record<string, string>;
  results?: Record<string, QResult>;
  total?: number;
  max?: number;
  auto?: boolean; // auto-submitted at timeout
}

export interface PublicQuestion {
  id: string;
  type: QType;
  text: string;
  options: string[];
  score: number;
}

export function toPublic(q: Question): PublicQuestion {
  return { id: q.id, type: q.type, text: q.text, options: q.options, score: q.score };
}

export const letter = (i: number) => String.fromCharCode(65 + i);
