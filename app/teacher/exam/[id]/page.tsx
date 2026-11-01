"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import Md from "@/components/Md";
import { QTYPE_LABEL, letter, type Exam, type QType, type Question, type Submission } from "@/lib/types";

const rid = () => Math.random().toString(36).slice(2, 14);

export default function Editor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [exam, setExam] = useState<Exam | null>(null);
  const [err, setErr] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"edit" | "subs">("edit");
  const [subs, setSubs] = useState<Submission[]>([]);
  const [solBusy, setSolBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [origin, setOrigin] = useState("");
  const backupKey = `exam-backup:${id}`;

  const load = useCallback(async () => {
    const r = await fetch(`/api/exams/${id}`, { cache: "no-store" });
    if (r.status === 401) { location.href = "/teacher"; return; }
    if (r.status === 404) {
      const b = localStorage.getItem(backupKey);
      if (b) { setErr("服务器上找不到该试卷，但本浏览器有备份。"); setExam(JSON.parse(b)); setDirty(true); return; }
      setErr("试卷不存在"); return;
    }
    const j = await r.json();
    setExam(j);
    localStorage.setItem(backupKey, JSON.stringify(j));
  }, [id, backupKey]);

  const loadSubs = useCallback(async () => {
    const r = await fetch(`/api/exams/${id}/submissions`, { cache: "no-store" });
    if (r.ok) setSubs((await r.json()).submissions);
  }, [id]);

  useEffect(() => { setOrigin(location.origin); load(); loadSubs(); }, [load, loadSubs]);

  const upd = (patch: Partial<Exam>) => { setExam((e) => (e ? { ...e, ...patch } : e)); setDirty(true); };
  const updQ = (qid: string, patch: Partial<Question>) =>
    upd({ questions: exam!.questions.map((q) => (q.id === qid ? { ...q, ...patch } : q)) });

  async function save(extra: Partial<Exam> = {}) {
    if (!exam) return null;
    setSaving(true);
    const body = { ...exam, ...extra };
    const r = await fetch(`/api/exams/${id}`, { method: "PUT", body: JSON.stringify(body) });
    setSaving(false);
    if (!r.ok) { setMsg("保存失败"); return null; }
    const j = await r.json();
    setExam(j); setDirty(false); setErr("");
    localStorage.setItem(backupKey, JSON.stringify(j));
    setMsg("已保存"); setTimeout(() => setMsg(""), 1500);
    return j as Exam;
  }

  async function genSolutions(force = false) {
    setSolBusy(true);
    if (dirty) await save();
    await fetch(`/api/exams/${id}/solutions${force ? "?force=1" : ""}`, { method: "POST" });
    await load();
    setSolBusy(false);
  }

  async function publish(on: boolean) {
    const e = await save({ status: on ? "published" : "draft" });
    if (on && e && e.solutionsStatus !== "done") genSolutions();
  }

  if (err && !exam) return <main className="p-10 text-center">{err} <Link className="text-blue-600" href="/teacher">返回</Link></main>;
  if (!exam) return <main className="p-10 text-center text-slate-400">加载中…</main>;
  const total = exam.questions.reduce((s, q) => s + (Number(q.score) || 0), 0);
  const link = `${origin}/s/${exam.code}`;
  const submitted = subs.filter((s) => s.submittedAt);
  const avg = submitted.length ? submitted.reduce((s, x) => s + (x.total || 0), 0) / submitted.length : 0;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="flex items-center justify-between">
        <Link href="/teacher" className="text-sm text-blue-600">← 返回教师后台</Link>
        <div className="flex items-center gap-2 text-sm">
          {msg && <span className="text-green-600">{msg}</span>}
          {dirty && <span className="text-amber-600">有未保存的修改</span>}
          <button className="btn btn-ghost" disabled={saving} onClick={() => save()}>{saving ? "保存中…" : "保存"}</button>
          {exam.status === "published" ? (
            <button className="btn btn-danger" onClick={() => publish(false)}>停止发布</button>
          ) : (
            <button className="btn btn-green" disabled={!exam.questions.length} onClick={() => publish(true)}>发布考试</button>
          )}
        </div>
      </div>
      {err && <p className="mt-3 rounded bg-amber-50 p-2 text-sm text-amber-700">{err} 点击「保存」即可恢复到服务器。</p>}

      <section className="card mt-4 grid gap-4 md:grid-cols-[1fr_160px_160px]">
        <div>
          <label className="label">试卷标题</label>
          <input className="input text-lg font-semibold" value={exam.title} onChange={(e) => upd({ title: e.target.value })} />
        </div>
        <div>
          <label className="label">考试时长（分钟）</label>
          <input className="input" type="number" min={1} value={exam.durationMin} onChange={(e) => upd({ durationMin: Number(e.target.value) })} />
        </div>
        <div>
          <label className="label">总分（自动计算）</label>
          <div className="input bg-slate-50 font-semibold">{total} 分 · {exam.questions.length} 题</div>
        </div>
      </section>

      {exam.status === "published" && (
        <section className="card mt-4 border-green-200 bg-green-50">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <div className="text-xs text-green-700">考试码</div>
              <div className="font-mono text-3xl font-bold tracking-widest text-green-800">{exam.code}</div>
            </div>
            <div className="flex-1">
              <div className="text-xs text-green-700">学生答题链接</div>
              <div className="flex gap-2">
                <input readOnly className="input font-mono text-sm" value={link} />
                <button className="btn btn-ghost" onClick={() => { navigator.clipboard.writeText(link); setMsg("链接已复制"); }}>复制</button>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="card mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm">
            <span className="font-semibold">答案与解析：</span>
            {exam.solutionsStatus === "done" ? <span className="text-green-700">已生成（AI 联网搜索 + 推理）</span>
              : exam.solutionsStatus === "running" || solBusy ? <span className="text-blue-600">生成中，请稍候（约 30–90 秒）…</span>
              : exam.solutionsStatus === "error" ? <span className="text-amber-700">部分题目生成失败，可重试</span>
              : <span className="text-slate-500">尚未生成（发布时自动生成，学生交卷后可查看）</span>}
          </div>
          <div className="flex gap-2">
            <button className="btn btn-ghost" disabled={solBusy} onClick={() => genSolutions(false)}>生成解析</button>
            <button className="btn btn-ghost" disabled={solBusy} onClick={() => genSolutions(true)}>全部重新生成</button>
          </div>
        </div>
      </section>

      <div className="mt-6 flex gap-1 border-b">
        {(["edit", "subs"] as const).map((t) => (
          <button key={t} onClick={() => { setTab(t); if (t === "subs") loadSubs(); }}
            className={`px-4 py-2 text-sm font-medium ${tab === t ? "border-b-2 border-blue-600 text-blue-700" : "text-slate-500"}`}>
            {t === "edit" ? `题目编辑（${exam.questions.length}）` : `学生成绩（${submitted.length}）`}
          </button>
        ))}
      </div>

      {tab === "edit" ? (
        <div className="mt-4 space-y-4">
          {exam.questions.map((q, i) => (
            <QuestionEditor key={q.id} q={q} idx={i} sol={exam.solutions?.[q.id]?.answer}
              onChange={(p) => updQ(q.id, p)}
              onDelete={() => upd({ questions: exam.questions.filter((x) => x.id !== q.id) })}
              onMove={(d) => {
                const arr = [...exam.questions]; const j = i + d;
                if (j < 0 || j >= arr.length) return;
                [arr[i], arr[j]] = [arr[j], arr[i]]; upd({ questions: arr });
              }} />
          ))}
          <div className="flex flex-wrap gap-2">
            {(Object.keys(QTYPE_LABEL) as QType[]).map((t) => (
              <button key={t} className="btn btn-ghost" onClick={() => upd({ questions: [...exam.questions, { id: rid(), type: t, text: "", options: t === "single" || t === "multiple" ? ["", "", "", ""] : [], answer: "", score: t === "short" ? 10 : 5 }] })}>
                + 添加{QTYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="card mt-4">
          <div className="mb-3 flex items-center justify-between text-sm text-slate-600">
            <span>已交卷 {submitted.length} 人{submitted.length ? `，平均分 ${avg.toFixed(1)} / ${total}` : ""}</span>
            <button className="btn btn-ghost" onClick={loadSubs}>刷新</button>
          </div>
          {subs.length === 0 ? <p className="text-sm text-slate-500">暂无学生作答。</p> : (
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500"><tr><th className="py-2">姓名</th><th>得分</th><th>开始时间</th><th>交卷时间</th><th>用时</th><th></th></tr></thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="py-2 font-medium">{s.name}</td>
                    <td>{s.submittedAt ? <b>{s.total} / {s.max}</b> : <span className="text-amber-600">作答中</span>}</td>
                    <td>{new Date(s.startedAt).toLocaleString("zh-CN")}</td>
                    <td>{s.submittedAt ? new Date(s.submittedAt).toLocaleString("zh-CN") : "-"}{s.auto ? <span className="ml-1 text-xs text-amber-600">(超时自动交卷)</span> : null}</td>
                    <td>{s.submittedAt ? `${Math.max(1, Math.round((s.submittedAt - s.startedAt) / 60000))} 分钟` : "-"}</td>
                    <td className="text-right">{s.submittedAt && <a className="text-blue-600" target="_blank" href={`/r/${s.id}`}>查看答卷 →</a>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </main>
  );
}

function QuestionEditor({ q, idx, sol, onChange, onDelete, onMove }: {
  q: Question; idx: number; sol?: string;
  onChange: (p: Partial<Question>) => void; onDelete: () => void; onMove: (d: number) => void;
}) {
  const choice = q.type === "single" || q.type === "multiple";
  const toggle = (L: string) => {
    if (q.type === "single") return onChange({ answer: L });
    const set = new Set(q.answer.toUpperCase().replace(/[^A-Z]/g, "").split("").filter(Boolean));
    if (set.has(L)) set.delete(L); else set.add(L);
    onChange({ answer: [...set].sort().join("") });
  };
  return (
    <div className="card">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-blue-600 px-2 py-0.5 text-sm font-semibold text-white">第 {idx + 1} 题</span>
        <select className="input w-auto" value={q.type} onChange={(e) => {
          const t = e.target.value as QType;
          onChange({ type: t, options: (t === "single" || t === "multiple") ? (q.options.length ? q.options : ["", "", "", ""]) : [] });
        }}>
          {(Object.keys(QTYPE_LABEL) as QType[]).map((t) => <option key={t} value={t}>{QTYPE_LABEL[t]}</option>)}
        </select>
        <label className="ml-2 text-sm text-slate-600">分值</label>
        <input className="input w-20" type="number" min={0} step={0.5} value={q.score} onChange={(e) => onChange({ score: Number(e.target.value) })} />
        <span className="text-sm text-slate-600">分</span>
        <div className="ml-auto flex gap-1">
          <button className="btn btn-ghost px-2 py-1" onClick={() => onMove(-1)} title="上移">↑</button>
          <button className="btn btn-ghost px-2 py-1" onClick={() => onMove(1)} title="下移">↓</button>
          <button className="btn btn-danger px-2 py-1" onClick={() => { if (confirm("确定删除这道题？")) onDelete(); }}>删除</button>
        </div>
      </div>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <div>
          <label className="label">题干（支持 LaTeX，如 $x^2+1$）</label>
          <textarea className="input h-28 font-mono text-sm" value={q.text} onChange={(e) => onChange({ text: e.target.value })} />
        </div>
        <div>
          <label className="label">预览</label>
          <div className="min-h-28 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
            <Md>{q.text || "*（空）*"}</Md>
            {choice && q.options.map((o, i) => <div key={i} className="flex gap-1"><b>{letter(i)}.</b><Md>{o}</Md></div>)}
          </div>
        </div>
      </div>
      {choice && (
        <div className="mt-3 space-y-2">
          <label className="label">选项（点击字母设为正确答案{q.type === "multiple" ? "，可多选" : ""}）</label>
          {q.options.map((o, i) => {
            const L = letter(i); const on = q.answer.toUpperCase().includes(L);
            return (
              <div key={i} className="flex items-center gap-2">
                <button onClick={() => toggle(L)} className={`h-8 w-8 shrink-0 rounded-full border text-sm font-bold ${on ? "border-green-600 bg-green-600 text-white" : "border-slate-300 bg-white"}`}>{L}</button>
                <input className="input" value={o} onChange={(e) => onChange({ options: q.options.map((x, k) => (k === i ? e.target.value : x)) })} />
                <button className="text-slate-400 hover:text-red-500" onClick={() => onChange({ options: q.options.filter((_, k) => k !== i), answer: "" })}>✕</button>
              </div>
            );
          })}
          <button className="text-sm text-blue-600" onClick={() => onChange({ options: [...q.options, ""] })}>+ 添加选项</button>
        </div>
      )}
      {!choice && (
        <div className="mt-3">
          <label className="label">{q.type === "fill" ? "参考答案（多个空用 ； 分隔）" : "参考答案 / 评分要点（用于 AI 按步骤给分）"}</label>
          <textarea className="input h-20 font-mono text-sm" value={q.answer} onChange={(e) => onChange({ answer: e.target.value })} placeholder="留空则由 AI 自动求解作为参考答案" />
        </div>
      )}
      {!q.answer && sol && <p className="mt-2 text-xs text-slate-500">AI 求解的答案：<span className="font-mono">{sol}</span>（未填写参考答案时用于评分）</p>}
      {choice && !q.answer && <p className="mt-2 text-xs text-amber-600">未设置正确选项：将使用 AI 求解的答案评分。</p>}
    </div>
  );
}
