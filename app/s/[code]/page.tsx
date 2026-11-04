"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useRef, useState } from "react";
import Md from "@/components/Md";
import { DIFF_LABEL, QTYPE_LABEL, ROLE_LABEL, letter, type Difficulty, type KnowledgePoint, type PublicQuestion, type QRole } from "@/lib/types";

type PubExam = {
  id: string; code: string; title: string; kind?: string; durationMin: number; total: number;
  showAnswersToStudents?: boolean;
  knowledgePoints?: KnowledgePoint[];
  questions: PublicQuestion[];
};
type Session = { sid: string; deadline: number; name: string };

const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return (h ? `${h}:` : "") + `${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}`;
};

function roleTag(role?: QRole) {
  if (!role) return null;
  return <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{ROLE_LABEL[role]}</span>;
}
function diffTag(d?: Difficulty) {
  if (!d) return null;
  const label = DIFF_LABEL[d as Exclude<Difficulty, "">];
  if (!label) return null;
  const color = d === "basic" ? "bg-green-100 text-green-700" : d === "improve" ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-700";
  return <span className={`rounded px-1.5 py-0.5 text-xs ${color}`}>{label}</span>;
}

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
  const [openAns, setOpenAns] = useState<Record<string, boolean>>({});
  const submittedRef = useRef(false);
  const key = `exam-session:${code.toUpperCase()}`;

  useEffect(() => {
    fetch(`/api/public/${code}`, { cache: "no-store" }).then(async (r) => {
      const j = await r.json();
      if (!r.ok) return setErr(j.error || "内容不存在");
      setExam(j);
      const saved = localStorage.getItem(key);
      if (saved) {
        const s = JSON.parse(saved);
        if (s.examId === j.id) { setSess(s.sess); setAnswers(s.answers || {}); }
      }
    });
  }, [code, key]);

  useEffect(() => {
    if (!sess || !exam || exam.kind === "courseware") return;
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
    if (!sess || exam?.kind === "courseware") return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [sess, exam]);

  const left = sess ? sess.deadline - now : 0;
  useEffect(() => { if (sess && exam?.kind !== "courseware" && left <= 0) submit(true); }, [left, sess, submit, exam]);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    if (exam?.kind === "courseware") {
      setSess({ sid: "cw", deadline: Date.now() + 365 * 86400000, name: name || "学员" });
      return;
    }
    const r = await fetch(`/api/public/${code}/start`, { method: "POST", body: JSON.stringify({ name }) });
    const j = await r.json();
    if (!r.ok) return setErr(j.error);
    const s = { sid: j.sid, deadline: j.deadline, name };
    setSess(s);
    setNow(Date.now());
  }

  if (err) return <main className="mx-auto mt-24 max-w-md p-4 text-center"><p className="text-lg">{err}</p><Link className="mt-4 inline-block text-blue-600" href="/">返回首页</Link></main>;
  if (!exam) return <main className="p-10 text-center text-slate-400">加载中…</main>;

  const isCw = exam.kind === "courseware";

  if (!sess)
    return (
      <main className="mx-auto mt-16 w-full max-w-md px-4">
        <form onSubmit={start} className="card">
          <div className="text-sm text-slate-500">{isCw ? "课件码" : "考试码"} {exam.code}</div>
          <h1 className="mt-1 text-2xl font-bold">{exam.title}</h1>
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
            {isCw ? (
              <>
                <span>📚 课件学习</span>
                <span>知识点 {exam.knowledgePoints?.length || 0}</span>
                <span>题目 {exam.questions.length}</span>
              </>
            ) : (
              <>
                <span>⏱ 时长 {exam.durationMin} 分钟</span>
                <span>📝 共 {exam.questions.length} 题</span>
                <span>💯 满分 {exam.total} 分</span>
              </>
            )}
          </div>
          <label className="label mt-6">{isCw ? "你的姓名（可选）" : "请输入你的姓名"}</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：张三" autoFocus />
          {!isCw && <p className="mt-3 text-xs text-slate-500">点击开始后立即计时，时间到将自动交卷。</p>}
          {isCw && <p className="mt-3 text-xs text-slate-500">进入后可按知识点、典例、分层习题学习；{exam.showAnswersToStudents ? "老师已允许查看答案与解析。" : "答案默认隐藏，由老师控制是否显示。"}</p>}
          <button className="btn btn-green mt-4 w-full justify-center" disabled={!isCw && !name.trim()}>{isCw ? "开始学习" : "开始考试"}</button>
        </form>
      </main>
    );

  if (isCw) {
    const kps = exam.knowledgePoints || [];
    const examples = exam.questions.filter((q) => q.role === "example");
    const practice = exam.questions.filter((q) => q.role === "practice");
    const exercises = exam.questions.filter((q) => q.role === "exercise" || (!q.role));
    const byDiff = (d: Difficulty) => exercises.filter((q) => (q.difficulty || "") === d);
    const otherEx = exercises.filter((q) => !q.difficulty);

    const QBlock = ({ q, i }: { q: PublicQuestion; i: number }) => {
      const show = !!openAns[q.id];
      return (
        <div className="card" id={`q-${q.id}`}>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded bg-slate-800 px-2 py-0.5 font-semibold text-white">{i}</span>
            {roleTag(q.role)}
            {diffTag(q.difficulty)}
            {q.section && <span className="text-xs text-slate-400">{q.section}</span>}
            <span className="text-slate-500">{QTYPE_LABEL[q.type]}</span>
          </div>
          <Md>{q.text}</Md>
          {(q.type === "single" || q.type === "multiple") && (
            <div className="mt-3 space-y-1 text-sm">
              {q.options.map((o, k) => (
                <div key={k} className="flex gap-2"><span className="font-semibold">{letter(k)}.</span><Md>{o}</Md></div>
              ))}
            </div>
          )}
          {exam.showAnswersToStudents && (
            <div className="mt-3">
              <button type="button" className="btn btn-ghost text-sm" onClick={() => setOpenAns((m) => ({ ...m, [q.id]: !show }))}>
                {show ? "收起答案" : "查看答案与解析"}
              </button>
              {show && (
                <div className="mt-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm">
                  <div><span className="font-semibold text-green-800">答案：</span><Md>{q.answer || "（无）"}</Md></div>
                  {q.solution && <div className="mt-2"><span className="font-semibold text-green-800">解析：</span><Md>{q.solution}</Md></div>}
                </div>
              )}
            </div>
          )}
        </div>
      );
    };

    let n = 0;
    return (
      <main className="mx-auto w-full max-w-3xl px-4 pb-16">
        <div className="sticky top-0 z-10 -mx-4 border-b bg-white/95 px-4 py-3 backdrop-blur">
          <div className="font-semibold">{exam.title}</div>
          <div className="text-xs text-slate-500">学员：{sess.name} · 课件学习{exam.showAnswersToStudents ? " · 可看答案" : " · 答案未对学生开放"}</div>
        </div>

        {kps.length > 0 && (
          <section className="mt-6">
            <h2 className="text-lg font-bold">知识点</h2>
            <div className="mt-3 space-y-3">
              {kps.map((k) => (
                <div key={k.id} className="card border-violet-100 bg-violet-50/40">
                  <div className="font-semibold text-violet-900">{k.title}</div>
                  <div className="mt-2 text-sm"><Md>{k.content}</Md></div>
                </div>
              ))}
            </div>
          </section>
        )}

        {examples.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-bold">典例</h2>
            <div className="mt-3 space-y-3">{examples.map((q) => <QBlock key={q.id} q={q} i={++n} />)}</div>
          </section>
        )}

        {practice.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-bold">即学即练</h2>
            <div className="mt-3 space-y-3">{practice.map((q) => <QBlock key={q.id} q={q} i={++n} />)}</div>
          </section>
        )}

        {(["basic", "improve", "advanced"] as const).map((d) => {
          const list = byDiff(d);
          if (!list.length) return null;
          return (
            <section key={d} className="mt-8">
              <h2 className="text-lg font-bold">习题 · {DIFF_LABEL[d]}</h2>
              <div className="mt-3 space-y-3">{list.map((q) => <QBlock key={q.id} q={q} i={++n} />)}</div>
            </section>
          );
        })}

        {otherEx.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-bold">习题</h2>
            <div className="mt-3 space-y-3">{otherEx.map((q) => <QBlock key={q.id} q={q} i={++n} />)}</div>
          </section>
        )}

        <div className="mt-10 text-center text-sm text-slate-400">
          <Link href="/" className="text-blue-600">返回首页</Link>
        </div>
      </main>
    );
  }

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
            <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded bg-slate-800 px-2 py-0.5 font-semibold text-white">{i + 1}</span>
              {roleTag(q.role)}
              {diffTag(q.difficulty)}
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
