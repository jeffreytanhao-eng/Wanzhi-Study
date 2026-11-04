"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { SUBJECTS } from "@/lib/subjects";

type Teacher = {
  id: string;
  username: string;
  displayName: string;
  phone: string | null;
  email: string | null;
  active: boolean;
  subjects?: string[];
};
type Student = {
  id: string;
  username: string;
  displayName: string;
  phone: string | null;
  email: string | null;
  grade: string | null;
  active: boolean;
};
type Klass = {
  id: string;
  name: string;
  teacherId: string;
  teacherName: string;
  subject: string;
  note: string | null;
  students: { id: string; username: string; displayName: string; grade: string | null }[];
};

type Tab = "teachers" | "students" | "classes";

export default function PrincipalPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [meName, setMeName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<Tab>("teachers");
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Klass[]>([]);
  const [msg, setMsg] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [pwdCurrent, setPwdCurrent] = useState("");
  const [pwdNext, setPwdNext] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdMsg, setPwdMsg] = useState("");
  const [pwdErr, setPwdErr] = useState("");

  // teacher form
  const [tForm, setTForm] = useState({
    id: "",
    username: "",
    password: "",
    displayName: "",
    phone: "",
    email: "",
    subjects: [] as string[],
    active: true,
  });
  // student form
  const [sForm, setSForm] = useState({
    id: "",
    username: "",
    password: "",
    displayName: "",
    phone: "",
    email: "",
    grade: "",
    active: true,
  });
  // class form
  const [cForm, setCForm] = useState({
    id: "",
    name: "",
    teacherId: "",
    subject: "",
    note: "",
    studentIds: [] as string[],
  });

  const loadAll = useCallback(async () => {
    const meR = await fetch("/api/auth/me", { cache: "no-store" });
    const meJ = await meR.json();
    if (!meJ.user || meJ.user.role !== "principal") {
      setAuthed(false);
      return;
    }
    setMeName(meJ.user.displayName || meJ.user.username);
    const [tR, sR, cR] = await Promise.all([
      fetch("/api/principal/teachers", { cache: "no-store" }),
      fetch("/api/principal/students", { cache: "no-store" }),
      fetch("/api/principal/classes", { cache: "no-store" }),
    ]);
    if (tR.status === 401 || sR.status === 401 || cR.status === 401) {
      setAuthed(false);
      return;
    }
    const tJ = await tR.json();
    const sJ = await sR.json();
    const cJ = await cR.json();
    setTeachers(tJ.teachers || []);
    setStudents(sJ.students || []);
    setClasses(cJ.classes || []);
    setAuthed(true);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const teacherSubjects = useMemo(() => {
    const t = teachers.find((x) => x.id === cForm.teacherId);
    return t?.subjects || [];
  }, [teachers, cForm.teacherId]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(j.error || "登录失败");
    if (j.user?.role !== "principal") {
      setErr("此账号不是校长");
      await fetch("/api/auth/logout", { method: "POST" });
      return;
    }
    loadAll();
  }

  function resetTeacher() {
    setTForm({ id: "", username: "", password: "", displayName: "", phone: "", email: "", subjects: [], active: true });
  }
  function resetStudent() {
    setSForm({ id: "", username: "", password: "", displayName: "", phone: "", email: "", grade: "", active: true });
  }
  function resetClass() {
    setCForm({ id: "", name: "", teacherId: "", subject: "", note: "", studentIds: [] });
  }

  async function saveTeacher(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setErr("");
    const body: Record<string, unknown> = {
      displayName: tForm.displayName,
      phone: tForm.phone,
      email: tForm.email,
      subjects: tForm.subjects,
      active: tForm.active,
    };
    if (tForm.password) body.password = tForm.password;
    let r: Response;
    if (tForm.id) {
      r = await fetch(`/api/principal/teachers/${tForm.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      r = await fetch("/api/principal/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: tForm.username,
          password: tForm.password,
          ...body,
        }),
      });
    }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(j.error || "保存失败");
    setMsg(tForm.id ? "老师已更新" : "老师已创建");
    resetTeacher();
    loadAll();
  }

  async function saveStudent(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setErr("");
    const body: Record<string, unknown> = {
      displayName: sForm.displayName,
      phone: sForm.phone,
      email: sForm.email,
      grade: sForm.grade,
      active: sForm.active,
    };
    if (sForm.password) body.password = sForm.password;
    let r: Response;
    if (sForm.id) {
      r = await fetch(`/api/principal/students/${sForm.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      r = await fetch("/api/principal/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: sForm.username, password: sForm.password, ...body }),
      });
    }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(j.error || "保存失败");
    setMsg(sForm.id ? "学生已更新" : "学生已创建");
    resetStudent();
    loadAll();
  }

  async function saveClass(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setErr("");
    const body = {
      name: cForm.name,
      teacherId: cForm.teacherId,
      subject: cForm.subject,
      note: cForm.note,
      studentIds: cForm.studentIds,
    };
    const r = await fetch(cForm.id ? `/api/principal/classes/${cForm.id}` : "/api/principal/classes", {
      method: cForm.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(j.error || "保存失败");
    setMsg(cForm.id ? "小班已更新" : "小班已创建");
    resetClass();
    loadAll();
  }

  async function removeTeacher(id: string) {
    if (!confirm("确定删除该老师？")) return;
    const r = await fetch(`/api/principal/teachers/${id}`, { method: "DELETE" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(j.error || "删除失败");
    loadAll();
  }
  async function removeStudent(id: string) {
    if (!confirm("确定删除该学生？")) return;
    const r = await fetch(`/api/principal/students/${id}`, { method: "DELETE" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(j.error || "删除失败");
    loadAll();
  }
  async function removeClass(id: string) {
    if (!confirm("确定删除该小班？")) return;
    const r = await fetch(`/api/principal/classes/${id}`, { method: "DELETE" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(j.error || "删除失败");
    loadAll();
  }

  async function changePwd(e: FormEvent) {
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
      const r = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current: pwdCurrent, next: pwdNext, confirm: pwdConfirm }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "修改失败");
      setPwdMsg("密码已更新，请用新密码登录");
      setPwdCurrent("");
      setPwdNext("");
      setPwdConfirm("");
    } catch (err) {
      setPwdErr(err instanceof Error ? err.message : String(err));
    } finally {
      setPwdBusy(false);
    }
  }

  function toggleSubject(sub: string) {
    setTForm((f) => ({
      ...f,
      subjects: f.subjects.includes(sub) ? f.subjects.filter((x) => x !== sub) : [...f.subjects, sub],
    }));
  }
  function toggleStudent(id: string) {
    setCForm((f) => {
      if (f.studentIds.includes(id)) return { ...f, studentIds: f.studentIds.filter((x) => x !== id) };
      if (f.studentIds.length >= 5) {
        setErr("小班最多 5 名学生");
        return f;
      }
      setErr("");
      return { ...f, studentIds: [...f.studentIds, id] };
    });
  }

  if (authed === null) return <main className="p-10 text-center text-slate-400">加载中…</main>;
  if (!authed) {
    return (
      <main className="mx-auto mt-24 w-full max-w-sm px-4">
        <form onSubmit={login} className="card">
          <h1 className="text-xl font-semibold">超级校长登录</h1>
          <label className="label mt-4">用户名</label>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username" />
          <label className="label mt-3">密码</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
          <button className="btn btn-primary mt-4 w-full justify-center">登录</button>
          <Link href="/" className="mt-3 block text-center text-sm text-slate-500">
            返回首页
          </Link>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">校长后台</h1>
          <p className="text-sm text-slate-500">{meName}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/" className="btn btn-ghost">
            首页
          </Link>
          <button type="button" className="btn btn-ghost" onClick={() => { setShowPwd((v) => !v); setPwdErr(""); setPwdMsg(""); }}>
            {showPwd ? "收起改密" : "改自己的密码"}
          </button>
          <button
            className="btn btn-ghost"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              setAuthed(false);
            }}
          >
            退出
          </button>
        </div>
      </header>

      {showPwd && (
        <form onSubmit={changePwd} className="card mt-4 max-w-md">
          <h2 className="font-semibold">修改校长密码</h2>
          <label className="label mt-3">当前密码</label>
          <input className="input" type="password" value={pwdCurrent} onChange={(e) => setPwdCurrent(e.target.value)} autoComplete="current-password" />
          <label className="label mt-3">新密码（至少 6 位）</label>
          <input className="input" type="password" value={pwdNext} onChange={(e) => setPwdNext(e.target.value)} autoComplete="new-password" />
          <label className="label mt-3">确认新密码</label>
          <input className="input" type="password" value={pwdConfirm} onChange={(e) => setPwdConfirm(e.target.value)} autoComplete="new-password" />
          {pwdErr && <p className="mt-2 text-sm text-red-600">{pwdErr}</p>}
          {pwdMsg && <p className="mt-2 text-sm text-emerald-600">{pwdMsg}</p>}
          <button className="btn btn-primary mt-4" disabled={pwdBusy}>{pwdBusy ? "提交中…" : "保存新密码"}</button>
        </form>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {(
          [
            ["teachers", "老师档案"],
            ["students", "学生档案"],
            ["classes", "小班"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            className={`rounded-full px-4 py-1.5 text-sm border ${tab === k ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600"}`}
            onClick={() => {
              setTab(k);
              setErr("");
              setMsg("");
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {err && <p className="mt-4 text-sm text-red-600">{err}</p>}
      {msg && <p className="mt-4 text-sm text-green-700">{msg}</p>}

      {tab === "teachers" && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="card">
            <h2 className="text-lg font-semibold">{tForm.id ? "编辑老师" : "新增老师"}</h2>
            <form onSubmit={saveTeacher} className="mt-4 space-y-3">
              {!tForm.id && (
                <div>
                  <label className="label">用户名</label>
                  <input className="input" required value={tForm.username} onChange={(e) => setTForm({ ...tForm, username: e.target.value })} />
                </div>
              )}
              <div>
                <label className="label">显示姓名</label>
                <input className="input" required value={tForm.displayName} onChange={(e) => setTForm({ ...tForm, displayName: e.target.value })} />
              </div>
              <div>
                <label className="label">{tForm.id ? "新密码（留空不改）" : "初始密码"}</label>
                <input className="input" type="password" required={!tForm.id} value={tForm.password} onChange={(e) => setTForm({ ...tForm, password: e.target.value })} />
              </div>
              <div>
                <label className="label">手机 / 邮箱（可选）</label>
                <div className="flex gap-2">
                  <input className="input" placeholder="手机" value={tForm.phone} onChange={(e) => setTForm({ ...tForm, phone: e.target.value })} />
                  <input className="input" placeholder="邮箱" value={tForm.email} onChange={(e) => setTForm({ ...tForm, email: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">任教学科（可多选）</label>
                <div className="flex flex-wrap gap-2">
                  {SUBJECTS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`rounded-full px-3 py-1 text-xs border ${tForm.subjects.includes(s) ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200"}`}
                      onClick={() => toggleSubject(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={tForm.active} onChange={(e) => setTForm({ ...tForm, active: e.target.checked })} />
                启用账号
              </label>
              <div className="flex gap-2">
                <button className="btn btn-primary" type="submit">
                  保存
                </button>
                {tForm.id && (
                  <button className="btn btn-ghost" type="button" onClick={resetTeacher}>
                    取消编辑
                  </button>
                )}
              </div>
            </form>
          </section>
          <section className="card">
            <h2 className="text-lg font-semibold">老师列表（{teachers.length}）</h2>
            <ul className="mt-3 divide-y">
              {teachers.map((t) => (
                <li key={t.id} className="py-3 flex justify-between gap-3">
                  <div>
                    <div className="font-medium">
                      {t.displayName} <span className="text-slate-400 font-normal">@{t.username}</span>
                      {!t.active && <span className="ml-2 text-xs text-amber-700">已停用</span>}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">{(t.subjects || []).join("、") || "未设学科"}</div>
                  </div>
                  <div className="shrink-0 space-x-2 text-sm">
                    <button
                      className="text-blue-600"
                      type="button"
                      onClick={() =>
                        setTForm({
                          id: t.id,
                          username: t.username,
                          password: "",
                          displayName: t.displayName,
                          phone: t.phone || "",
                          email: t.email || "",
                          subjects: t.subjects || [],
                          active: t.active,
                        })
                      }
                    >
                      编辑
                    </button>
                    <button className="text-red-600" type="button" onClick={() => removeTeacher(t.id)}>
                      删除
                    </button>
                  </div>
                </li>
              ))}
              {teachers.length === 0 && <li className="py-4 text-sm text-slate-500">暂无老师，请先创建。</li>}
            </ul>
          </section>
        </div>
      )}

      {tab === "students" && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="card">
            <h2 className="text-lg font-semibold">{sForm.id ? "编辑学生" : "新增学生"}</h2>
            <form onSubmit={saveStudent} className="mt-4 space-y-3">
              {!sForm.id && (
                <div>
                  <label className="label">学号</label>
                  <input className="input" required value={sForm.username} onChange={(e) => setSForm({ ...sForm, username: e.target.value })} placeholder="登录用学号" />
                </div>
              )}
              <div>
                <label className="label">显示姓名</label>
                <input className="input" required value={sForm.displayName} onChange={(e) => setSForm({ ...sForm, displayName: e.target.value })} />
              </div>
              <div>
                <label className="label">{sForm.id ? "新密码（留空不改）" : "初始密码"}</label>
                <input className="input" type="password" required={!sForm.id} value={sForm.password} onChange={(e) => setSForm({ ...sForm, password: e.target.value })} />
              </div>
              <div>
                <label className="label">年级（可选）</label>
                <input className="input" placeholder="如：七年级" value={sForm.grade} onChange={(e) => setSForm({ ...sForm, grade: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <input className="input" placeholder="手机" value={sForm.phone} onChange={(e) => setSForm({ ...sForm, phone: e.target.value })} />
                <input className="input" placeholder="邮箱" value={sForm.email} onChange={(e) => setSForm({ ...sForm, email: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={sForm.active} onChange={(e) => setSForm({ ...sForm, active: e.target.checked })} />
                启用账号
              </label>
              <div className="flex gap-2">
                <button className="btn btn-primary" type="submit">
                  保存
                </button>
                {sForm.id && (
                  <button className="btn btn-ghost" type="button" onClick={resetStudent}>
                    取消编辑
                  </button>
                )}
              </div>
            </form>
          </section>
          <section className="card">
            <h2 className="text-lg font-semibold">学生列表（{students.length}）</h2>
            <ul className="mt-3 divide-y">
              {students.map((s) => (
                <li key={s.id} className="py-3 flex justify-between gap-3">
                  <div>
                    <div className="font-medium">
                      {s.displayName} <span className="text-slate-400 font-normal">@{s.username}</span>
                      {!s.active && <span className="ml-2 text-xs text-amber-700">已停用</span>}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">{s.grade || "未填年级"}</div>
                  </div>
                  <div className="shrink-0 space-x-2 text-sm">
                    <button
                      className="text-blue-600"
                      type="button"
                      onClick={() =>
                        setSForm({
                          id: s.id,
                          username: s.username,
                          password: "",
                          displayName: s.displayName,
                          phone: s.phone || "",
                          email: s.email || "",
                          grade: s.grade || "",
                          active: s.active,
                        })
                      }
                    >
                      编辑
                    </button>
                    <button className="text-red-600" type="button" onClick={() => removeStudent(s.id)}>
                      删除
                    </button>
                  </div>
                </li>
              ))}
              {students.length === 0 && <li className="py-4 text-sm text-slate-500">暂无学生。</li>}
            </ul>
          </section>
        </div>
      )}

      {tab === "classes" && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="card">
            <h2 className="text-lg font-semibold">{cForm.id ? "编辑小班" : "新建小班"}</h2>
            <p className="mt-1 text-sm text-slate-500">每位老师带班；每班 1–5 名学生；学科须属于该老师任教范围。</p>
            <form onSubmit={saveClass} className="mt-4 space-y-3">
              <div>
                <label className="label">小班名称</label>
                <input className="input" required value={cForm.name} onChange={(e) => setCForm({ ...cForm, name: e.target.value })} />
              </div>
              <div>
                <label className="label">老师</label>
                <select
                  className="input"
                  required
                  value={cForm.teacherId}
                  onChange={(e) => setCForm({ ...cForm, teacherId: e.target.value, subject: "" })}
                >
                  <option value="">请选择</option>
                  {teachers.filter((t) => t.active).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.displayName}（{(t.subjects || []).join("、")}）
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">学科</label>
                <select className="input" required value={cForm.subject} onChange={(e) => setCForm({ ...cForm, subject: e.target.value })}>
                  <option value="">请选择</option>
                  {teacherSubjects.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">备注（可选）</label>
                <input className="input" value={cForm.note} onChange={(e) => setCForm({ ...cForm, note: e.target.value })} />
              </div>
              <div>
                <label className="label">学生（已选 {cForm.studentIds.length}/5）</label>
                <div className="max-h-48 overflow-auto rounded border border-slate-200 p-2 space-y-1">
                  {students.filter((s) => s.active).map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={cForm.studentIds.includes(s.id)} onChange={() => toggleStudent(s.id)} />
                      {s.displayName} @{s.username}
                      {s.grade ? ` · ${s.grade}` : ""}
                    </label>
                  ))}
                  {students.length === 0 && <p className="text-xs text-slate-500">请先创建学生档案。</p>}
                </div>
              </div>
              <div className="flex gap-2">
                <button className="btn btn-primary" type="submit">
                  保存
                </button>
                {cForm.id && (
                  <button className="btn btn-ghost" type="button" onClick={resetClass}>
                    取消编辑
                  </button>
                )}
              </div>
            </form>
          </section>
          <section className="card">
            <h2 className="text-lg font-semibold">小班列表（{classes.length}）</h2>
            <ul className="mt-3 space-y-3">
              {classes.map((c) => (
                <li key={c.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex justify-between gap-2">
                    <div>
                      <div className="font-medium">
                        {c.name} · {c.subject}
                      </div>
                      <div className="text-sm text-slate-500 mt-1">老师：{c.teacherName}</div>
                      <div className="text-sm text-slate-500">
                        学生：{c.students.map((s) => s.displayName).join("、") || "无"}
                      </div>
                      {c.note && <div className="text-xs text-slate-400 mt-1">{c.note}</div>}
                    </div>
                    <div className="shrink-0 space-x-2 text-sm">
                      <button
                        className="text-blue-600"
                        type="button"
                        onClick={() =>
                          setCForm({
                            id: c.id,
                            name: c.name,
                            teacherId: c.teacherId,
                            subject: c.subject,
                            note: c.note || "",
                            studentIds: c.students.map((s) => s.id),
                          })
                        }
                      >
                        编辑
                      </button>
                      <button className="text-red-600" type="button" onClick={() => removeClass(c.id)}>
                        删除
                      </button>
                    </div>
                  </div>
                </li>
              ))}
              {classes.length === 0 && <li className="text-sm text-slate-500">暂无小班。</li>}
            </ul>
          </section>
        </div>
      )}
    </main>
  );
}
