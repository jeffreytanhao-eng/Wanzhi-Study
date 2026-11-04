export type QType = "single" | "multiple" | "fill" | "short";
export type ContentKind = "exam" | "courseware";
export type QRole = "example" | "practice" | "exercise";
export type Difficulty = "basic" | "improve" | "advanced" | "";

export const QTYPE_LABEL: Record<QType, string> = {
  single: "单选题",
  multiple: "多选题",
  fill: "填空题",
  short: "解答/计算题",
};

export const ROLE_LABEL: Record<QRole, string> = {
  example: "典例",
  practice: "即学即练",
  exercise: "习题",
};

export const DIFF_LABEL: Record<Exclude<Difficulty, "">, string> = {
  basic: "基础过关",
  improve: "能力提升",
  advanced: "培优拔尖",
};

export interface KnowledgePoint {
  id: string;
  title: string;
  content: string; // Markdown + LaTeX
}

export interface Question {
  id: string;
  type: QType;
  text: string; // Markdown + LaTeX ($...$)
  options: string[]; // for single/multiple, without "A." prefix
  answer: string; // single: "B"; multiple: "AC"; fill: "3；-1"; short: reference solution/answer
  score: number;
  /** courseware / structured import */
  role?: QRole;
  difficulty?: Difficulty;
  section?: string;
  solution?: string; // steps from source material
}

export interface Solution {
  answer: string;
  steps: string; // markdown
  sources: { title: string; url: string }[];
  searched: boolean;
}

export interface SourceFile {
  name: string;
  storedAs: string; // relative path under DATA_DIR/files/{examId}/
  size: number;
  mime: string;
}

export interface Exam {
  id: string;
  code: string;
  title: string;
  durationMin: number;
  status: "draft" | "published";
  /** 考试 = timed scoring; 课件 = learning materials */
  kind?: ContentKind;
  knowledgePoints?: KnowledgePoint[];
  /** courseware: whether students can see answers/solutions */
  showAnswersToStudents?: boolean;
  questions: Question[];
  /** Original uploaded PDF/images/Word; kept even when AI is off so teachers can enter questions manually. */
  sourceFiles?: SourceFile[];
  solutions?: Record<string, Solution>;
  solutionsStatus?: "none" | "running" | "done" | "error";
  solutionsUpdatedAt?: number;
  solutionsError?: string;
  /** Teacher who created this exam/courseware; null/undefined = legacy shared */
  ownerTeacherId?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface QResult {
  score: number;
  max: number;
  correct: boolean;
  feedback: string;
  manual?: boolean; // overridden by teacher
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
  role?: QRole;
  difficulty?: Difficulty;
  section?: string;
  answer?: string;
  solution?: string;
}

export function toPublic(q: Question, revealAnswer = false): PublicQuestion {
  const base: PublicQuestion = {
    id: q.id,
    type: q.type,
    text: q.text,
    options: q.options,
    score: q.score,
    role: q.role,
    difficulty: q.difficulty,
    section: q.section,
  };
  if (revealAnswer) {
    base.answer = q.answer;
    base.solution = q.solution;
  }
  return base;
}

export const letter = (i: number) => String.fromCharCode(65 + i);

export function isCourseware(e: Pick<Exam, "kind"> | null | undefined) {
  return e?.kind === "courseware";
}
