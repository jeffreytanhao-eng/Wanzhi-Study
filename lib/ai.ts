import "server-only";
import { generateText, Output, isStepCount, type UserContent, type LanguageModel } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import type { Question, Solution, QResult } from "./types";

// ---------- LLM provider (no Vercel dependency) ----------
// Any OpenAI-compatible API works. Configure in .env.local:
//   AI_API_KEY=...            (or OPENAI_API_KEY / XAI_API_KEY / DEEPSEEK_API_KEY / DASHSCOPE_API_KEY)
//   AI_BASE_URL=...           (default chosen from which key is set)
//   AI_MODEL=...              (default chosen from which key is set)
//   AI_SOLVE_MODEL=...        (optional, model for solutions)
//   AI_WEB_SEARCH=1           (OpenAI official API only: use its web_search tool)
type Cfg = { apiKey: string; baseURL: string; model: string; name: string };

function cfg(): Cfg | null {
  const e = process.env;
  const pick: [string | undefined, string, string, string][] = [
    [e.AI_API_KEY, e.AI_BASE_URL || "https://api.openai.com/v1", "gpt-4.1-mini", "custom"],
    [e.OPENAI_API_KEY, e.OPENAI_BASE_URL || "https://api.openai.com/v1", "gpt-4.1-mini", "openai"],
    [e.XAI_API_KEY, "https://api.x.ai/v1", "grok-4-fast", "xai"],
    [e.DEEPSEEK_API_KEY, "https://api.deepseek.com/v1", "deepseek-chat", "deepseek"],
    [e.DASHSCOPE_API_KEY, "https://dashscope.aliyuncs.com/compatible-mode/v1", "qwen-plus", "qwen"],
  ];
  for (const [key, base, model, name] of pick) {
    if (key) return { apiKey: key, baseURL: e.AI_BASE_URL || base, model: e.AI_MODEL || model, name };
  }
  return null;
}

export function aiStatus() {
  const c = cfg();
  return c ? { enabled: true, provider: c.name, model: c.model } : { enabled: false };
}

export class AIDisabledError extends Error {
  constructor() {
    super("AI_DISABLED");
  }
}

function provider() {
  const c = cfg();
  if (!c) throw new AIDisabledError();
  return { c, p: createOpenAI({ apiKey: c.apiKey, baseURL: c.baseURL }) };
}
function model(solve = false): LanguageModel {
  const { c, p } = provider();
  const id = solve ? process.env.AI_SOLVE_MODEL || c.model : c.model;
  // OpenAI official -> Responses API; other compatible vendors -> Chat Completions
  return /api\.openai\.com/.test(c.baseURL) ? p.responses(id) : p.chat(id);
}
function searchTools() {
  const { c, p } = provider();
  if (!/api\.openai\.com/.test(c.baseURL) || process.env.AI_WEB_SEARCH === "0") return null;
  return { web_search: p.tools.webSearch({}) };
}

export function aiErrorMessage(e: unknown) {
  if (e instanceof AIDisabledError)
    return "AI 功能未启用：服务器未配置大模型 API Key（在 .env.local 中设置 AI_API_KEY 等，见 README）。";
  const m = e instanceof Error ? e.message : String(e);
  if (/401|invalid.*key|unauthori/i.test(m)) return "AI 调用失败：API Key 无效。";
  if (/insufficient|quota|budget|balance/i.test(m)) return "AI 额度不足，请充值或稍后再试。";
  if (/rate/i.test(m)) return "AI 服务繁忙（限流），请稍后再试。";
  return "AI 调用失败：" + m.slice(0, 200);
}

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
          "参考答案：优先用试卷答案页；否则自行求解。单选如 B；多选如 AC；填空多个空用；分隔；解答题写参考答案要点。尽量不要留空",
        ),
      score: z.number().describe("试卷中标注的分值；未标注时选择题/填空 5、解答题 10"),
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
2. 判断题型：单选、多选、填空、解答/计算题。判断题当作单选，选项为「正确」「错误」。AMC/竞赛卷若只有 A–E 选项且题干未写出选项文字，options 填 ["A","B","C","D","E"]。
3. ${MATH_RULE}
4. 参考答案：若试卷附带答案/答案页（Answer Key），务必填入对应 answer；若没有，请你自行正确求解后填入（单选填字母如 B，多选如 AC，填空写最终结果，解答题写简明参考答案）。不要把 answer 留空。
5. 若题目标注分值（如“（5分）”），填入 score；未标注时单选/多选/填空用 5，解答题用 10。
6. 题干中的图形无法识别时，用文字简要描述“[图：……]”。`,
    },
  ];
  for (const f of files) {
    content.push({ type: "file", data: f.data, mediaType: f.mediaType, filename: f.name });
  }
  if (text.trim()) content.push({ type: "text", text: `试卷文本：\n${text}` });

  const { output } = await generateText({
    model: model(),
    output: Output.object({ schema: ParsedSchema }),
    messages: [{ role: "user", content }],
  });
  return output;
}


// ---------- 1b. Parse courseware Word / text (知识点 + 例题 + 分层习题) ----------
const CoursewareSchema = z.object({
  title: z.string().describe("课件标题，如「第03讲 三角函数的概念」"),
  suggestedKind: z.enum(["exam", "courseware"]).describe("若内容明显是教学课件（含知识点/典例/题组）选 courseware；纯试卷选 exam"),
  knowledgePoints: z.array(
    z.object({
      title: z.string().describe("知识点标题，如「知识点01 三角函数的定义」"),
      content: z.string().describe("干净的知识点正文（含微点拨/考法说明），Markdown+LaTeX，去掉课标表格等无关版式"),
    }),
  ),
  questions: z.array(
    z.object({
      role: z.enum(["example", "practice", "exercise"]).describe("example=典例, practice=即学即练, exercise=题组习题"),
      difficulty: z.enum(["basic", "improve", "advanced", ""]).describe("题组A=basic, 题组B=improve, 培优/题组C=advanced；典例/即学即练可空"),
      section: z.string().describe("所属小节，如「考法01」「题组A 基础过关练」；无则空串"),
      type: z.enum(["single", "multiple", "fill", "short"]),
      text: z.string().describe("题干（不含题号前缀、不含选项），填空用 ____"),
      options: z.array(z.string()).describe("选项内容不含 A. 前缀；非选择题空数组"),
      answer: z.string().describe("参考答案：单选字母、多选如 AC、填空结果、解答题要点"),
      solution: z.string().describe("原课件中的【详解】/【解析】/【分析】整理成简洁步骤；没有则自行补简要过程"),
      score: z.number().describe("建议分值：选择/填空5，解答10；课件习题同样给分便于转考试"),
    }),
  ),
});

export async function parseCourseware(text: string, titleHint = "") {
  const clipped = text.length > 60000 ? text.slice(0, 60000) + "\n…(原文过长已截断)" : text;
  const { output } = await generateText({
    model: model(),
    output: Output.object({ schema: CoursewareSchema }),
    prompt: `你是中国高中/初中教研助手。下面是一份 Word 课件抽取的纯文本（已去掉奇怪格式）。请整理为结构化课件，只保留有用教学内容：
1) 知识点（定义、符号规律、考法说明、微点拨等）
2) 例题/典例（含答案与解题过程）
3) 即学即练（含答案与过程）
4) 分层习题：题组A基础过关→difficulty=basic；题组B能力提升→improve；培优拔尖/题组C→advanced（含答案与过程）

硬性要求：
- 不要保留课程标准表格、页眉页脚、版式噪声；公式用 LaTeX：$...$ / $$...$$。
- 按原文顺序提取，不遗漏主要题目；图形用文字简述「[图：…]」。
- 答案优先用原文【答案】；过程优先用【详解】/【解析】/【分析】，删掉空话，保留关键步骤。
- suggestedKind：有「知识点/典例/题组」结构时选 courseware，否则 exam。
- 标题优先用讲次标题；若无则用「${titleHint || "未命名课件"}」。
- 选择题 options 不要带 A./B. 前缀；多选 type=multiple。

课件文本：
${clipped}`,
  });
  return output;
}

export async function parseExamFromText(text: string, titleHint = "") {
  const clipped = text.length > 60000 ? text.slice(0, 60000) + "\n…(原文过长已截断)" : text;
  const { output } = await generateText({
    model: model(),
    output: Output.object({ schema: ParsedSchema }),
    prompt: `你是一名经验丰富的中国中学教师助手。请把下面试卷/习题文本解析为结构化题目列表（用于限时考试评分）。
要求：
1. 只提取可评分的题目（选择题、填空、解答），跳过纯知识点讲解段落。
2. 按顺序提取，不遗漏；${MATH_RULE}
3. 参考答案优先用文中【答案】；否则自行求解。
4. 未标注分值时选择/填空 5、解答 10。
5. 标题：若文本有讲次/试卷名则用，否则「${titleHint || "未命名试卷"}」。

文本：
${clipped}`,
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
    model: model(),
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
${useSearch && cfg() && searchTools() ? "先调用 web_search 工具在网上搜索这道题或相关知识点的解答（用中文关键词），参考可靠来源；然后独立验算，给出你确认正确的解答。" : ""}
要求：用简体中文；步骤清晰、适合中学生理解；${MATH_RULE}
题型：${q.type}
题目：${q.text}${opts}${ref}`;

  const tools = useSearch ? searchTools() : null;
  if (tools) {
    try {
      const r = await generateText({
        model: model(true),
        tools,
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
    model: model(true),
    output: Output.object({ schema: SolSchema }),
    prompt,
  });
  return { ...r.output, sources: [], searched: false };
}
