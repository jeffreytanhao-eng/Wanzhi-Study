import "server-only";
import { generateText, Output, gateway, isStepCount, type UserContent } from "ai";
import { z } from "zod";
import type { Question, Solution, QResult } from "./types";

export function aiErrorMessage(e: unknown) {
  const m = e instanceof Error ? e.message : String(e);
  if (/credit card/i.test(m))
    return "AI 服务尚未开通：需要在 Vercel 账户的 AI Gateway 页面绑定信用卡以解锁免费额度（https://vercel.com/dashboard/ai）。";
  if (/insufficient|quota|budget/i.test(m)) return "AI 额度不足，请在 Vercel AI Gateway 充值或稍后再试。";
  if (/rate/i.test(m)) return "AI 服务繁忙（限流），请稍后再试。";
  return "AI 调用失败：" + m.slice(0, 200);
}

export const MODEL = process.env.AI_MODEL || "google/gemini-3.8-flash";
export const SOLVE_MODEL = process.env.AI_SOLVE_MODEL || MODEL;

const MATH_RULE =
  "所有数学公式使用 LaTeX，行内用 $...$，独立公式用 $$...$$。不要使用 \\( \\) 或 \\[ \\]。";

// ---------- 1. Parse uploaded exam paper ----------
const ParsedSchema = z.object({
  title: z.string().describe("试卷标题；若无则根据内容拟一个"),
  questions: z.array(
    z.object({
      type: z.enum(["single", "multiple", "fill", "short"]).describe(
        "single=单选, multiple=多选, fill=填空, short=解答/计算/证明/简答",
      ),
      text: z.string().describe("题干（不含题号、不含选项），填空处用 ____ 表示"),
      options: z.array(z.string()).describe("选项内容（不含 A. B. 前缀）；非选择题为空数组"),
      answer: z
        .string()
        .describe(
          "试卷中能识别出的参考答案：单选如 B；多选如 AC；填空多个空用；分隔；解答题写参考答案要点。无法识别则为空字符串",
        ),
      score: z.number().describe("试卷中标注的分值；未标注则为 0"),
    }),
  ),
});

export type FileInput = { data: string; mediaType: string; name: string };

export async function parseExam(files: FileInput[], text: string) {
  const content: Exclude<UserContent, string> = [
    {
      type: "text",
      text: `你是一名经验丰富的中国中学/大学教师助手。请把下面上传的试卷（PDF/图片/文本）完整解析为结构化题目列表。
要求：
1. 按原试卷顺序提取每一道题，不遗漏、不合并；大题下的小题分别作为独立题目（题干中可保留必要的公共条件）。
2. 判断题型：单选、多选、填空、解答/计算题。判断题当作单选，选项为「正确」「错误」。
3. ${MATH_RULE}
4. 若试卷附带答案或答案页，填入 answer；否则留空，不要自己编造。
5. 若题目标注分值（如“（5分）”），填入 score，否则为 0。
6. 题干中的图形无法识别时，用文字简要描述“[图：……]”。`,
    },
  ];
  for (const f of files) {
    content.push({ type: "file", data: f.data, mediaType: f.mediaType, filename: f.name });
  }
  if (text.trim()) content.push({ type: "text", text: `试卷文本：\n${text}` });

  const { output } = await generateText({
    model: MODEL,
    output: Output.object({ schema: ParsedSchema }),
    messages: [{ role: "user", content }],
  });
  return output;
}

// ---------- 2. Grade subjective / non-exact answers ----------
const GradeSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      score: z.number(),
      feedback: z.string().describe("简短评语，指出得分点与失分原因（中文）"),
    }),
  ),
});

export async function gradeWithLLM(
  items: { q: Question; student: string; reference: string }[],
): Promise<Record<string, Pick<QResult, "score" | "feedback">>> {
  if (!items.length) return {};
  const payload = items.map(({ q, student, reference }) => ({
    id: q.id,
    type: q.type,
    question: q.text,
    reference_answer: reference || "(未提供参考答案，请你先自行正确求解再评分)",
    full_score: q.score,
    student_answer: student || "(未作答)",
  }));
  const { output } = await generateText({
    model: MODEL,
    output: Output.object({ schema: GradeSchema }),
    prompt: `你是严谨公正的阅卷老师。请根据参考答案为每道题的学生作答评分。
规则：
- 填空题：答案数学上等价即给满分（如 1/2 与 0.5、$\\sqrt{4}$ 与 2）；多空按空数比例给分。
- 解答/计算题：按步骤给分，思路正确但计算错误可得部分分；只有最终答案且正确，可酌情给大部分分数；未作答为 0 分。
- 分数在 0 到满分之间，可以是 0.5 的倍数。
- 评语简短（不超过 60 字），用中文。${MATH_RULE}
题目与作答(JSON)：
${JSON.stringify(payload, null, 2)}`,
  });
  const out: Record<string, Pick<QResult, "score" | "feedback">> = {};
  for (const it of output.items) {
    const q = items.find((x) => x.q.id === it.id)?.q;
    if (!q) continue;
    out[it.id] = {
      score: Math.max(0, Math.min(q.score, Math.round(it.score * 2) / 2)),
      feedback: it.feedback,
    };
  }
  return out;
}

// ---------- 3. Solve a question with web search ----------
const SolSchema = z.object({
  answer: z.string().describe("最终答案（简洁）。选择题给出选项字母，如 B 或 AC"),
  steps: z.string().describe("详细的分步解题过程，Markdown 格式，使用编号步骤"),
});

function collectSources(steps: unknown[]): { title: string; url: string }[] {
  const seen = new Map<string, string>();
  const visit = (v: unknown, depth = 0) => {
    if (!v || depth > 6) return;
    if (Array.isArray(v)) return v.forEach((x) => visit(x, depth + 1));
    if (typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (typeof o.url === "string" && /^https?:\/\//.test(o.url)) {
        if (!seen.has(o.url)) seen.set(o.url, String(o.title || o.url));
      }
      for (const val of Object.values(o)) visit(val, depth + 1);
    }
  };
  for (const s of steps as Record<string, unknown>[]) {
    visit(s.toolResults);
    visit(s.sources);
  }
  return [...seen.entries()].slice(0, 5).map(([url, title]) => ({ url, title }));
}

export async function solveQuestion(q: Question, useSearch = true): Promise<Solution> {
  const opts = q.options.length
    ? "\n选项：\n" + q.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join("\n")
    : "";
  const ref = q.answer ? `\n教师给出的参考答案：${q.answer}（请以此为准进行讲解；若明显有误请指出）` : "";
  const prompt = `请为学生讲解下面这道题，给出正确答案和清晰的分步解题过程。
${useSearch ? "先调用 perplexity_search 工具在网上搜索这道题或相关知识点的解答（用中文关键词），参考可靠来源；然后独立验算，给出你确认正确的解答。" : ""}
要求：用简体中文；步骤清晰、适合中学生理解；${MATH_RULE}
题型：${q.type}
题目：${q.text}${opts}${ref}`;

  if (useSearch) {
    try {
      const r = await generateText({
        model: SOLVE_MODEL,
        tools: { perplexity_search: gateway.tools.perplexitySearch({ maxResults: 5 }) },
        stopWhen: isStepCount(4),
        output: Output.object({ schema: SolSchema }),
        prompt,
      });
      const sources = collectSources(r.steps as unknown[]);
      return { ...r.output, sources, searched: sources.length > 0 };
    } catch (e) {
      console.error("search-solve failed, falling back", e);
    }
  }
  const r = await generateText({
    model: SOLVE_MODEL,
    output: Output.object({ schema: SolSchema }),
    prompt,
  });
  return { ...r.output, sources: [], searched: false };
}
