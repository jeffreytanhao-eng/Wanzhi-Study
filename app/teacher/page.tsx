"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import AccountPicker from "@/components/AccountPicker";

type Row = {
  id: string; code: string; title: string; status: string; kind?: string; durationMin: number;
  count: number; knowledgeCount?: number; total: number; submissions: number; updatedAt: number;
  sourceCount?: number; sourceNames?: string[]; pendingEntry?: boolean;
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
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [meName, setMeName] = useState("");
  const [myClasses, setMyClasses] = useState<{ id: string; name: string; subject: string; students: { displayName: string }[] }[]>([]);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [storage, setStorage] = useState("");
  const [ai, setAi] = useState<{ enabled: boolean; provider?: string; model?: string } | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"auto" | "exam" | "courseware">("auto");
  const [busy, setBusy] = useState<"ai" | "upload" | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showPwd, setShowPwd] = useState(false);
  const [pwdCurrent, setPwdCurrent] = useState("");
  const [pwdNext, setPwdNext] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdMsg, setPwdMsg] = useState("");
  const [pwdErr, setPwdErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/exams", { cache: "no-store" });
    if (r.status === 401) return setAuthed(false);
    const j = await r.json();
    setRows(j.exams);
    setStorage(j.storage);
    setAi(j.ai || null);
    if (j.me?.displayName) setMeName(j.me.displayName);
    const cR = await fetch("/api/teacher/classes", { cache: "no-store" });
    if (cR.ok) {
      const cJ = await cR.json();
      setMyClasses(cJ.classes || []);
    }
    setAuthed(true);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const r = await fetch("/api/teacher/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(j.error || "账号或密码错误");
    load();
  }

  async function buildForm() {
    const fd = new FormData();
    for (const f of files) fd.append("files", await shrinkImage(f));
    fd.append("text", text);
    fd.append("mode", mode);
    return fd;
  }

  async function parse() {
    setBusy("ai"); setErr("");
    try {
      const fd = await buildForm();
      const size = [...fd.values()].reduce((s, v) => s + (typeof v === "string" ? v.length : v.size), 0);
      if (size > 8 * 1024 * 1024) throw new Error("文件总大小超过 8MB，请压缩或分次上传");
      const r = await fetch("/api/parse", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "解析失败");
      router.push(`/teacher/exam/${j.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  }

  async function uploadDraft() {
    if (!files.length && !text.trim()) {
      setErr("请先选择 PDF / Word / 图片，或粘贴文本");
      return;
    }
    setBusy("upload"); setErr("");
    try {
      const fd = await buildForm();
      const r = await fetch("/api/exams/from-upload", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "创建失败");
      setFiles([]);
      setText("");
      if (fileRef.current) fileRef.current.value = "";
      router.push(`/teacher/exam/${j.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  }

  async function blank(kind: "exam" | "courseware") {
    const r = await fetch("/api/exams", { method: "POST", body: JSON.stringify({ kind, title: kind === "courseware" ? "未命名课件" : "未命名试卷", durationMin: kind === "courseware" ? 0 : 60 }) });
    const j = await r.json();
    router.push(`/teacher/exam/${j.id}`);
  }

  async function removeExam(row: Row) {
    const tip = row.submissions
      ? `确定删除「${row.title}」？将同时删除 ${row.submissions} 份答卷，且不可恢复。`
      : `确定删除「${row.title}」？删除后不可恢复。`;
    if (!confirm(tip)) return;
    setDeleting(row.id); setErr("");
    try {
      const r = await fetch(`/api/exams/${row.id}`, { method: "DELETE" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "删除失败");
      setRows((xs) => xs.filter((x) => x.id !== row.id));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(null);
    }
  }

  async function changePwd(e: React.FormEvent) {
    e.preventDefault();
    setPwdErr("");
    setPwdMsg("");
    if (!pwdCurrent || !pwdNext || !pwdConfirm) {
      setPwdErr("请填写当前密码、新密码和确认密码");
      return;
    }
    if (pwdNext.length < 6) {
      setPwdErr("新密码至少 6 位");
      return;
    }
    if (pwdNext !== pwdConfirm) {
      setPwdErr("两次输入的新密码不一致");
      return;
    }
    setPwdBusy(true);
    try {
      const r = await fetch("/api/teacher/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current: pwdCurrent, next: pwdNext, confirm: pwdConfirm }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "修改失败");
      setPwdMsg(j.message || "口令已更新");
      setPwdCurrent("");
      setPwdNext("");
      setPwdConfirm("");
    } catch (err) {
      setPwdErr(err instanceof Error ? err.message : String(err));
    } finally {
      setPwdBusy(false);
    }
  }

  if (authed === null) return <main className="p-10 text-center text-slate-400">加载中…</main>;
  if (!authed)
    return (
      <main className="mx-auto mt-24 w-full max-w-sm px-4">
        <form onSubmit={login} className="card">
          <h1 className="text-xl font-semibold">教师后台登录</h1>
          <AccountPicker
            role="teacher"
            value={username}
            onChange={setUsername}
            label="老师账号"
            placeholder="输入姓名/账号，自动匹配"
            autoFocus
          />
          <label className="label mt-3">密码</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
          <button className="btn btn-primary mt-4 w-full justify-center" disabled={!username}>登录</button>
          <Link href="/" className="mt-3 block text-center text-sm text-slate-500">返回首页</Link>
        </form>
      </main>
    );

  const canSubmit = files.length > 0 || !!text.trim();
  const aiOff = ai && !ai.enabled;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">教师后台</h1>
          {meName && <p className="text-sm text-slate-500">{meName}</p>}
        </div>
        <div className="flex gap-2">
          <Link href="/" className="btn btn-ghost">首页</Link>
          <button className="btn btn-ghost" type="button" onClick={() => { setShowPwd((v) => !v); setPwdErr(""); setPwdMsg(""); }}>
            {showPwd ? "收起修改密码" : "修改密码"}
          </button>
          <button className="btn btn-ghost" onClick={async () => { await fetch("/api/teacher/logout", { method: "POST" }); setAuthed(false); }}>退出</button>
        </div>
      </header>

      {showPwd && (
        <section className="card mt-6">
          <h2 className="text-lg font-semibold">修改密码</h2>
          <p className="mt-1 text-sm text-slate-500">修改后立即生效。请牢记新密码。</p>
          <form onSubmit={changePwd} className="mt-4 grid max-w-md gap-3">
            <div>
              <label className="label">当前密码</label>
              <input className="input" type="password" autoComplete="current-password" value={pwdCurrent} onChange={(e) => setPwdCurrent(e.target.value)} />
            </div>
            <div>
              <label className="label">新密码（至少 6 位）</label>
              <input className="input" type="password" autoComplete="new-password" value={pwdNext} onChange={(e) => setPwdNext(e.target.value)} />
            </div>
            <div>
              <label className="label">确认新密码</label>
              <input className="input" type="password" autoComplete="new-password" value={pwdConfirm} onChange={(e) => setPwdConfirm(e.target.value)} />
            </div>
            {pwdErr && <p className="text-sm text-red-600">{pwdErr}</p>}
            {pwdMsg && <p className="text-sm text-green-700">{pwdMsg}</p>}
            <button className="btn btn-primary w-fit" disabled={pwdBusy} type="submit">
              {pwdBusy ? "保存中…" : "保存新密码"}
            </button>
          </form>
        </section>
      )}

      <section className="card mt-6">
        <h2 className="text-lg font-semibold">上传试卷 / 课件</h2>
        <p className="mt-1 text-sm text-slate-500">
          支持 PDF、Word（.doc / .docx）、图片或粘贴文本。Word 课件会抽取「知识点 / 典例 / 分层习题」，并去掉奇怪版式，只保留干净内容。
        </p>

        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <span className="text-slate-500 self-center">类型：</span>
          {([
            ["auto", "自动识别"],
            ["courseware", "课件（学习）"],
            ["exam", "考试（限时评分）"],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              className={`rounded-full px-3 py-1 border ${mode === k ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600"}`}
              onClick={() => setMode(k)}
            >
              {label}
            </button>
          ))}
        </div>

        <div
          className="mt-4 cursor-pointer rounded-lg border-2 border-dashed border-slate-300 p-6 text-center hover:bg-slate-50"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); setFiles([...files, ...Array.from(e.dataTransfer.files)]); }}
        >
          <div className="text-3xl">📄</div>
          <div className="mt-2 text-sm text-slate-600">点击选择或拖拽文件（PDF / Word / JPG / PNG）</div>
          <input ref={fileRef} type="file" multiple accept=".pdf,.doc,.docx,image/*,.txt" className="hidden"
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
        <label className="label mt-4">或粘贴文本（可选）</label>
        <textarea className="input h-28" value={text} onChange={(e) => setText(e.target.value)} placeholder="知识点 / 例题 / 习题…" />
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="btn btn-primary"
            disabled={!!busy || !canSubmit || !!aiOff}
            onClick={parse}
            title={aiOff ? "未配置大模型 API Key，无法自动解析" : "上传后自动解析"}
          >
            {busy === "ai" ? "AI 正在解析，约需 1–3 分钟…" : "✨ 上传并自动解析"}
          </button>
          <button className="btn btn-ghost" disabled={!!busy || !canSubmit} onClick={uploadDraft}>
            {busy === "upload" ? "正在保存上传…" : "仅保存原件（不解析）"}
          </button>
          <button className="btn btn-ghost" onClick={() => blank("exam")} disabled={!!busy}>新建空白试卷</button>
          <button className="btn btn-ghost" onClick={() => blank("courseware")} disabled={!!busy}>新建空白课件</button>
        </div>
        {aiOff && (
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <div className="font-medium">自动解析当前不可用：服务器未配置大模型 API Key</div>
          </div>
        )}
      </section>

      <section className="card mt-6">
        <h2 className="text-lg font-semibold">我的小班</h2>
        {myClasses.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">暂无小班（由校长在后台分配）。</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {myClasses.map((c) => (
              <li key={c.id} className="rounded border border-slate-200 px-3 py-2">
                <span className="font-medium">{c.name}</span>
                <span className="text-slate-500"> · {c.subject}</span>
                <div className="text-slate-500 mt-1">学生：{c.students.map((s) => s.displayName).join("、")}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card mt-6">
        <h2 className="text-lg font-semibold">我的试卷 / 课件</h2>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">还没有内容，先上传一份吧。</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr><th className="py-2">标题</th><th>类型</th><th>状态</th><th>码</th><th>题数</th><th>知识点</th><th>时长</th><th>已交卷</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="py-2 font-medium">
                    <div>{r.title}</div>
                    {!!r.sourceCount && (
                      <div className="mt-0.5 text-xs font-normal text-slate-400 truncate max-w-[220px]" title={(r.sourceNames || []).join(", ")}>
                        附件：{(r.sourceNames || []).join("、")}
                      </div>
                    )}
                  </td>
                  <td>
                    {r.kind === "courseware" ? (
                      <span className="rounded bg-violet-100 px-2 py-0.5 text-violet-700">课件</span>
                    ) : (
                      <span className="rounded bg-sky-100 px-2 py-0.5 text-sky-700">考试</span>
                    )}
                  </td>
                  <td>
                    {r.status === "published" ? (
                      <span className="rounded bg-green-100 px-2 py-0.5 text-green-700">已发布</span>
                    ) : r.pendingEntry ? (
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800">已上传待录入</span>
                    ) : (
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600">草稿</span>
                    )}
                  </td>
                  <td className="font-mono">{r.code}</td>
                  <td>{r.count}</td>
                  <td>{r.knowledgeCount || 0}</td>
                  <td>{r.kind === "courseware" ? "—" : `${r.durationMin} 分钟`}</td>
                  <td>{r.kind === "courseware" ? "—" : r.submissions}</td>
                  <td className="text-right whitespace-nowrap">
                    <Link className="text-blue-600" href={`/teacher/exam/${r.id}`}>编辑 →</Link>
                    <button
                      className="ml-3 text-red-600 hover:underline disabled:opacity-50"
                      disabled={deleting === r.id}
                      onClick={() => removeExam(r)}
                    >
                      {deleting === r.id ? "删除中…" : "删除"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {ai?.enabled && <p className="mt-4 text-xs text-slate-400">AI：{ai.provider} / {ai.model}</p>}
        {storage === "file" && (
          <p className="mt-4 text-xs text-slate-400">数据保存在本机服务器（本地 JSON 文件存储）。</p>
        )}
      </section>
    </main>
  );
}
