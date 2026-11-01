"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useRef, useState } from "react";
import Md from "@/components/Md";
import { QTYPE_LABEL, letter, type PublicQuestion } from "@/lib/types";

type PubExam = { id: string; code: string; title: string; durationMin: number; total: number; questions: PublicQuestion[] };
type Session = { sid: string; deadline: number; name: string };

const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return (h ? `${h}:` : "") + `${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}`;
};

export default function Student({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const [exam, setExam] = useState<PubExam | null>(null);
  const [err, setErr] = useState("");
  const [name, setName] = useState("");
  const [sess, setSess] = useState<Session | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [now, setNow] = useState(Date.now());
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);
  const key = `exam-session:${code.toUpperCase()}`;

  useEffect(() => {
    fetch(`/api/public/${code}`, { cache: "no-store" }).then(async (r) => {
      const j = await r.json();
      if (!r.ok) return setErr(j.error || "考试不存在");
      setExam(j);
      const saved = localStorage.getItem(key);
      if (saved) {
        const s = JSON.parse(saved);
        if (s.examId === j.id) { setSess(s.sess); setAnswers(s.answers || {}); }
      }
    });
  }, [code, key]);

  useEffect(() => {
    if (!sess || !exam) return;
    localStorage.setItem(key, JSON.stringify({ examId: exam.id, sess, answers }));
  }, [answers, sess, exam, key]);

  const submit = useCallback(async (auto = false) => {
    if (!sess || submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    const r = await fetch(`/api/submissions/${sess.sid}`, { method: "POST", body: JSON.stringify({ answers, auto }) });
    if (!r.ok) { submittedRef.current = false; setSubmitting(false); alert("交卷失败，请重试"); return; }
    localStorage.removeItem(key);
    router.push(`/r/${sess.sid}`);
  }, [sess, answers, key, router]);

  useEffect(() => {
    if (!sess) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [sess]);

  const left = sess ? sess.deadline - now : 0;
  useEffect(() => { if (sess && left <= 0) submit(true); }, [left, sess, submit]);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch(`/api/public/${code}/start`, { method: "POST", body: JSON.stringify({ name }) });
    const j = await r.json();
    if (!r.ok) return setErr(j.error);
    const s = { sid: j.sid, deadline: j.deadline, name };
    setSess(s);
    setNow(Date.now());
  }

  if (err) return <main className="mx-auto mt-24 max-w-md p-4 text-center"><p className="text-lg">{err}</p><Link className="mt-4 inline-block text-blue-600" href="/">返回首页</Link></main>;
  if (!exam) return <main className="p-10 text-center text-slate-400">加载中…</main>;

  if (!sess)
    return (
      <main className="mx-auto mt-16 w-full max-w-md px-4">
        <form onSubmit={start} className="card">
          <div className="text-sm text-slate-500">考试码 {exam.code}</div>
          <h1 className="mt-1 text-2xl font-bold">{exam.title}</h1>
          <div className="mt-3 flex gap-4 text-sm text-slate-600">
            <span>⏱ 时长 {exam.durationMin} 分钟</span><span>📝 共 {exam.questions.length} 题</span><span>💯 满分 {exam.total} 分</span>
          </div>
          <label className="label mt-6">请输入你的姓名</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：张三" autoFocus />
          <p className="mt-3 text-xs text-slate-500">点击开始后立即计时，时间到将自动交卷。答题过程会自动保存在本设备上。</p>
          <button className="btn btn-green mt-4 w-full justify-center" disabled={!name.trim()}>开始考试</button>
        </form>
      </main>
    );

  const answered = exam.questions.filter((q) => (answers[q.id] || "").trim()).length;
  const set = (qid: string, v: string) => setAnswers((a) => ({ ...a, [qid]: v }));

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-24">
      <div className="sticky top-0 z-10 -mx-4 border-b bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold">{exam.title}</div>
            <div className="text-xs text-slate-500">考生：{sess.name} · 已答 {answered}/{exam.questions.length}</div>
          </div>
          <div className={`font-mono text-2xl font-bold ${left < 60000 ? "text-red-600 animate-pulse" : left < 300000 ? "text-amber-600" : "text-slate-800"}`}>⏱ {fmt(left)}</div>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {exam.questions.map((q, i) => (
          <div key={q.id} className="card" id={`q-${i}`}>
            <div className="mb-2 flex items-center gap-2 text-sm">
              <span className="rounded bg-slate-800 px-2 py-0.5 font-semibold text-white">{i + 1}</span>
              <span className="text-slate-500">{QTYPE_LABEL[q.type]} · {q.score} 分</span>
            </div>
            <Md>{q.text}</Md>
            {(q.type === "single" || q.type === "multiple") && (
              <div className="mt-3 space-y-2">
                {q.options.map((o, k) => {
                  const L = letter(k); const cur = answers[q.id] || ""; const on = cur.includes(L);
                  return (
                    <button key={k} onClick={() => {
                      if (q.type === "single") set(q.id, L);
                      else { const s = new Set(cur.split("").filter(Boolean)); if (s.has(L)) s.delete(L); else s.add(L); set(q.id, [...s].sort().join("")); }
                    }} className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left ${on ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:bg-slate-50"}`}>
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center ${q.type === "single" ? "rounded-full" : "rounded"} border text-sm font-bold ${on ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300"}`}>{L}</span>
                      <Md>{o}</Md>
                    </button>
                  );
                })}
                {q.type === "multiple" && <p className="text-xs text-slate-400">多选题：可选择多个选项</p>}
              </div>
            )}
            {q.type === "fill" && (
              <input className="input mt-3" placeholder="填写答案；多个空用 ； 分隔" value={answers[q.id] || ""} onChange={(e) => set(q.id, e.target.value)} />
            )}
            {q.type === "short" && (
              <>
                <textarea className="input mt-3 h-40" placeholder="写出解题过程和答案（可用 $...$ 输入公式）" value={answers[q.id] || ""} onChange={(e) => set(q.id, e.target.value)} />
                {(answers[q.id] || "").includes("$") && <div className="mt-2 rounded bg-slate-50 p-2 text-sm"><div className="text-xs text-slate-400">公式预览</div><Md>{answers[q.id]}</Md></div>}
              </>
            )}
          </div>
        ))}
      </div>
      <div className="fixed inset-x-0 bottom-0 border-t bg-white px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <span className="text-sm text-slate-500">已答 {answered}/{exam.questions.length} 题</span>
          <button className="btn btn-primary" disabled={submitting} onClick={() => {
            const miss = exam.questions.length - answered;
            if (confirm(miss ? `还有 ${miss} 题未作答，确定交卷吗？` : "确定交卷吗？")) submit(false);
          }}>{submitting ? "正在评分…" : "交卷"}</button>
        </div>
      </div>
      {submitting && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30">
          <div className="card text-center"><div className="text-3xl">📝</div><div className="mt-2 font-semibold">正在交卷并评分…</div><div className="text-sm text-slate-500">主观题由 AI 阅卷，请稍候</div></div>
        </div>
      )}
    </main>
  );
}
