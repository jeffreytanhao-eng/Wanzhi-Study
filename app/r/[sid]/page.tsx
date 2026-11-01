"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";
import Md from "@/components/Md";
import { QTYPE_LABEL, letter, type Question, type Solution, type Submission } from "@/lib/types";

type Data = {
  teacher?: boolean;
  submission: Submission;
  exam: { id: string; title: string; questions: Question[]; solutions: Record<string, Solution>; solutionsStatus: string; solutionsError?: string };
};

export default function Result({ params }: { params: Promise<{ sid: string }> }) {
  const { sid } = use(params);
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const triggered = useRef(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/submissions/${sid}`, { cache: "no-store" });
    const j = await r.json();
    if (!r.ok) return setErr(j.error);
    setD(j);
    return j as Data;
  }, [sid]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const j = await load();
      if (!j || !j.submission.submittedAt) return;
      const missing = j.exam.questions.some((q) => !j.exam.solutions?.[q.id]);
      if (missing) {
        if (!triggered.current) {
          triggered.current = true;
          fetch(`/api/exams/${j.exam.id}/solutions?sid=${sid}`, { method: "POST" }).then(() => load());
          timer = setTimeout(tick, 5000);
          return;
        }
        if (j.exam.solutionsStatus === "running") timer = setTimeout(tick, 5000);
      }
    };
    tick();
    return () => clearTimeout(timer);
  }, [load, sid]);

  if (err) return <main className="p-10 text-center">{err}</main>;
  if (!d) return <main className="p-10 text-center text-slate-400">加载中…</main>;
  const { submission: s, exam } = d;
  if (!s.submittedAt) return <main className="p-10 text-center">该答卷尚未提交。</main>;
  const pct = s.max ? (s.total! / s.max) * 100 : 0;
  const missing = exam.questions.some((q) => !exam.solutions?.[q.id]);
  const pending = missing && exam.solutionsStatus !== "error";
  const override = async (qid: string, score: number) => {
    await fetch(`/api/submissions/${sid}`, { method: "PATCH", body: JSON.stringify({ qid, score }) });
    load();
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="card text-center">
        <div className="text-sm text-slate-500">{exam.title} · {s.name}</div>
        <div className="mt-2 text-5xl font-bold">
          <span className={pct >= 85 ? "text-green-600" : pct >= 60 ? "text-blue-600" : "text-red-600"}>{s.total}</span>
          <span className="text-2xl text-slate-400"> / {s.max}</span>
        </div>
        <div className="mt-2 text-sm text-slate-500">
          交卷时间 {new Date(s.submittedAt).toLocaleString("zh-CN")} · 用时 {Math.max(1, Math.round((s.submittedAt - s.startedAt) / 60000))} 分钟
          {s.auto && <span className="ml-1 text-amber-600">（时间到自动交卷）</span>}
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-1">
          {exam.questions.map((q, i) => {
            const r = s.results?.[q.id];
            const c = !r ? "bg-slate-200" : r.correct ? "bg-green-500 text-white" : r.score > 0 ? "bg-amber-400 text-white" : "bg-red-500 text-white";
            return <a key={q.id} href={`#q-${i}`} className={`flex h-8 w-8 items-center justify-center rounded text-sm font-semibold ${c}`}>{i + 1}</a>;
          })}
        </div>
      </div>
      {missing && exam.solutionsStatus === "error" && <p className="mt-4 rounded bg-amber-50 p-3 text-sm text-amber-700">⚠️ 部分解题过程暂未生成。{exam.solutionsError}</p>}
      {d.teacher && <p className="mt-4 rounded bg-slate-100 p-3 text-sm text-slate-600">👩‍🏫 教师模式：可在每题右上角修改得分（人工复核）。</p>}
      {pending && <p className="mt-4 rounded bg-blue-50 p-3 text-sm text-blue-700">⏳ 正在联网搜索并生成解题过程，约需 30–90 秒，页面会自动刷新…</p>}

      <div className="mt-4 space-y-4">
        {exam.questions.map((q, i) => {
          const r = s.results?.[q.id];
          const sol = exam.solutions?.[q.id];
          const mine = s.answers[q.id] || "";
          const correctAns = q.answer || sol?.answer || "";
          return (
            <div key={q.id} id={`q-${i}`} className="card">
              <div className="mb-2 flex items-center gap-2 text-sm">
                <span className="rounded bg-slate-800 px-2 py-0.5 font-semibold text-white">{i + 1}</span>
                <span className="text-slate-500">{QTYPE_LABEL[q.type]}</span>
                {d.teacher && r && (
                  <span className="ml-auto flex items-center gap-1 text-xs text-slate-500">
                    改分
                    <input type="number" step={0.5} min={0} max={q.score} defaultValue={r.score} className="input w-16 px-1 py-0.5"
                      onBlur={(e) => { const v = Number(e.target.value); if (v !== r.score) override(q.id, v); }} />
                    {r.manual && <span className="text-blue-600">已人工复核</span>}
                  </span>
                )}
                <span className={`${d.teacher ? "" : "ml-auto "}rounded px-2 py-0.5 font-semibold ${r?.correct ? "bg-green-100 text-green-700" : (r?.score || 0) > 0 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                  {r?.score ?? 0} / {q.score} 分
                </span>
              </div>
              <Md>{q.text}</Md>
              {q.options.length > 0 && (
                <div className="mt-2 space-y-1 text-sm">
                  {q.options.map((o, k) => {
                    const L = letter(k); const isAns = correctAns.toUpperCase().includes(L); const picked = mine.includes(L);
                    return (
                      <div key={k} className={`flex gap-2 rounded px-2 py-1 ${isAns ? "bg-green-50 text-green-800" : picked ? "bg-red-50 text-red-700" : ""}`}>
                        <b>{L}.</b><Md>{o}</Md>{isAns && <span className="ml-auto">✓</span>}{picked && !isAns && <span className="ml-auto">✗ 你的选择</span>}
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                <div className="rounded bg-slate-50 p-2"><div className="text-xs text-slate-500">你的答案</div>{mine ? <Md>{mine}</Md> : <span className="text-slate-400">未作答</span>}</div>
                <div className="rounded bg-green-50 p-2"><div className="text-xs text-green-700">正确答案</div>{correctAns ? <Md>{correctAns}</Md> : <span className="text-slate-400">{pending ? "生成中…" : "老师未提供"}</span>}</div>
              </div>
              {r?.feedback && <p className="mt-2 text-sm text-slate-600">📝 阅卷评语：{r.feedback}</p>}
              <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/50 p-3">
                <div className="mb-1 text-sm font-semibold text-blue-800">解题过程</div>
                {sol ? (
                  <>
                    <Md className="text-sm">{sol.steps}</Md>
                    {sol.sources.length > 0 && (
                      <div className="mt-2 border-t border-blue-100 pt-2 text-xs text-slate-500">
                        🔎 参考来源：
                        <ol className="list-decimal pl-5">
                          {sol.sources.map((x) => <li key={x.url}><a href={x.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{x.title}</a></li>)}
                        </ol>
                      </div>
                    )}
                    {!sol.searched && <div className="mt-2 text-xs text-slate-400">（由 AI 推理生成）</div>}
                  </>
                ) : <span className="text-sm text-slate-400">{pending ? "生成中…" : "暂无（AI 服务不可用）"}</span>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-6 text-center"><Link href="/" className="text-blue-600">返回首页</Link></div>
    </main>
  );
}
