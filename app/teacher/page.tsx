"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type Row = {
  id: string; code: string; title: string; status: string; durationMin: number;
  count: number; total: number; submissions: number; updatedAt: number;
};

async function shrinkImage(f: File): Promise<File> {
  if (!f.type.startsWith("image/") || f.size < 600_000) return f;
  const bmp = await createImageBitmap(f);
  const scale = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), "image/jpeg", 0.85));
  return new File([blob], f.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
}

export default function Teacher() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [storage, setStorage] = useState("");
  const [ai, setAi] = useState<{ enabled: boolean; provider?: string; model?: string } | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/exams", { cache: "no-store" });
    if (r.status === 401) return setAuthed(false);
    const j = await r.json();
    setRows(j.exams);
    setStorage(j.storage);
    setAi(j.ai || null);
    setAuthed(true);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const r = await fetch("/api/teacher/login", { method: "POST", body: JSON.stringify({ code }) });
    if (!r.ok) return setErr("口令错误");
    load();
  }

  async function parse() {
    setBusy(true); setErr("");
    try {
      const fd = new FormData();
      for (const f of files) fd.append("files", await shrinkImage(f));
      fd.append("text", text);
      const size = [...fd.values()].reduce((s, v) => s + (typeof v === "string" ? v.length : v.size), 0);
      if (size > 4.2 * 1024 * 1024) throw new Error("文件总大小超过 4MB，请压缩 PDF 或分多次上传");
      const r = await fetch("/api/parse", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "解析失败");
      router.push(`/teacher/exam/${j.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  async function blank() {
    const r = await fetch("/api/exams", { method: "POST", body: JSON.stringify({}) });
    const j = await r.json();
    router.push(`/teacher/exam/${j.id}`);
  }

  if (authed === null) return <main className="p-10 text-center text-slate-400">加载中…</main>;
  if (!authed)
    return (
      <main className="mx-auto mt-24 w-full max-w-sm px-4">
        <form onSubmit={login} className="card">
          <h1 className="text-xl font-semibold">教师后台登录</h1>
          <label className="label mt-4">教师口令</label>
          <input className="input" type="password" value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
          {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
          <button className="btn btn-primary mt-4 w-full justify-center">登录</button>
          <Link href="/" className="mt-3 block text-center text-sm text-slate-500">返回首页</Link>
        </form>
      </main>
    );

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">教师后台</h1>
        <div className="flex gap-2">
          <Link href="/" className="btn btn-ghost">首页</Link>
          <button className="btn btn-ghost" onClick={async () => { await fetch("/api/teacher/logout", { method: "POST" }); setAuthed(false); }}>退出</button>
        </div>
      </header>

      <section className="card mt-6">
        <h2 className="text-lg font-semibold">上传新试卷</h2>
        <p className="mt-1 text-sm text-slate-500">支持 PDF、图片（拍照/扫描件，可多张）或直接粘贴文本。AI 将自动识别题型、选项、分值和参考答案（若试卷含答案）。</p>
        <div
          className="mt-4 cursor-pointer rounded-lg border-2 border-dashed border-slate-300 p-6 text-center hover:bg-slate-50"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); setFiles([...files, ...Array.from(e.dataTransfer.files)]); }}
        >
          <div className="text-3xl">📄</div>
          <div className="mt-2 text-sm text-slate-600">点击选择或拖拽文件到这里（PDF / JPG / PNG）</div>
          <input ref={fileRef} type="file" multiple accept=".pdf,image/*,.txt" className="hidden"
            onChange={(e) => setFiles([...files, ...Array.from(e.target.files || [])])} />
        </div>
        {files.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm">
            {files.map((f, i) => (
              <li key={i} className="flex items-center justify-between rounded bg-slate-100 px-3 py-1.5">
                <span>{f.name} <span className="text-slate-400">({(f.size / 1024).toFixed(0)} KB)</span></span>
                <button className="text-red-500" onClick={() => setFiles(files.filter((_, k) => k !== i))}>移除</button>
              </li>
            ))}
          </ul>
        )}
        <label className="label mt-4">或粘贴试卷文本（可选）</label>
        <textarea className="input h-28" value={text} onChange={(e) => setText(e.target.value)} placeholder="1. 已知集合 A={1,2,3}…" />
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
        <div className="mt-4 flex gap-2">
          <button className="btn btn-primary" disabled={busy || (!files.length && !text.trim())} onClick={parse}>
            {busy ? "AI 正在识别试卷，约需 20–60 秒…" : "✨ AI 识别试卷"}
          </button>
          <button className="btn btn-ghost" onClick={blank} disabled={busy}>手动新建空白试卷</button>
        </div>
      </section>

      <section className="card mt-6">
        <h2 className="text-lg font-semibold">我的试卷</h2>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">还没有试卷，先上传一份吧。</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr><th className="py-2">标题</th><th>状态</th><th>考试码</th><th>题数</th><th>总分</th><th>时长</th><th>已交卷</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="py-2 font-medium">{r.title}</td>
                  <td>{r.status === "published" ? <span className="rounded bg-green-100 px-2 py-0.5 text-green-700">已发布</span> : <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600">草稿</span>}</td>
                  <td className="font-mono">{r.code}</td>
                  <td>{r.count}</td><td>{r.total}</td><td>{r.durationMin} 分钟</td><td>{r.submissions}</td>
                  <td className="text-right"><Link className="text-blue-600" href={`/teacher/exam/${r.id}`}>编辑 / 成绩 →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {ai && !ai.enabled && (
          <p className="mt-4 rounded bg-amber-50 p-2 text-xs text-amber-700">提示：AI 功能未启用（服务器未配置大模型 API Key）。目前可手动录入题目与答案，客观题自动判分，主观题需老师人工给分；AI 解析试卷、主观题阅卷和解题过程生成暂不可用。</p>
        )}
        {ai?.enabled && <p className="mt-4 text-xs text-slate-400">AI：{ai.provider} / {ai.model}</p>}
        {storage === "file" && (
          <p className="mt-4 text-xs text-slate-400">数据保存在本机服务器（本地 JSON 文件存储）。</p>
        )}
      </section>
    </main>
  );
}
