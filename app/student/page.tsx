"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AccountPicker from "@/components/AccountPicker";

type Me = { id: string; username: string; displayName: string };
type Klass = {
  id: string;
  name: string;
  subject: string;
  teacherName: string;
  note: string | null;
  students: { id: string; displayName: string }[];
};
type Mat = { id: string; code: string; title: string; kind: string; durationMin: number };

export default function StudentPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [me, setMe] = useState<Me | null>(null);
  const [classes, setClasses] = useState<Klass[]>([]);
  const [materials, setMaterials] = useState<Mat[]>([]);

  const load = useCallback(async () => {
    const meR = await fetch("/api/auth/me", { cache: "no-store" });
    const meJ = await meR.json();
    if (!meJ.user || meJ.user.role !== "student") {
      setAuthed(false);
      return;
    }
    const r = await fetch("/api/student/dashboard", { cache: "no-store" });
    if (r.status === 401) {
      setAuthed(false);
      return;
    }
    const j = await r.json();
    setMe(j.user);
    setClasses(j.classes || []);
    setMaterials(j.materials || []);
    setAuthed(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
    if (j.user?.role !== "student") {
      setErr("此账号不是学生，请使用对应入口登录");
      await fetch("/api/auth/logout", { method: "POST" });
      return;
    }
    load();
  }

  if (authed === null) return <main className="p-10 text-center text-slate-400">加载中…</main>;
  if (!authed) {
    return (
      <main className="mx-auto mt-24 w-full max-w-sm px-4">
        <form onSubmit={login} className="card">
          <h1 className="text-xl font-semibold">学生登录</h1>
          <AccountPicker
            role="student"
            value={username}
            onChange={setUsername}
            label="学号"
            placeholder="点击选择或搜索学号"
            autoFocus
          />
          <label className="label mt-3">密码</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
          <button className="btn btn-green mt-4 w-full justify-center" disabled={!username}>登录</button>
          <p className="mt-2 text-xs text-slate-400">学号即校长后台里登记的学生账号。</p>
          <Link href="/" className="mt-3 block text-center text-sm text-slate-500">
            返回首页
          </Link>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">学生中心</h1>
          <p className="text-sm text-slate-500">{me?.displayName}（学号 {me?.username}）</p>
        </div>
        <div className="flex gap-2">
          <Link href="/" className="btn btn-ghost">
            首页
          </Link>
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

      <section className="card mt-6">
        <h2 className="text-lg font-semibold">我的小班</h2>
        {classes.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">暂未加入小班，请联系校长或老师。</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {classes.map((c) => (
              <li key={c.id} className="rounded-lg border border-slate-200 p-3">
                <div className="font-medium">
                  {c.name} · {c.subject}
                </div>
                <div className="mt-1 text-sm text-slate-500">老师：{c.teacherName}</div>
                {c.note && <div className="mt-1 text-sm text-slate-500">{c.note}</div>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card mt-6">
        <h2 className="text-lg font-semibold">老师发布的考试 / 课件</h2>
        <p className="mt-1 text-sm text-slate-500">含小班老师发布的内容，以及尚未归属老师的旧版共享内容。</p>
        {materials.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">暂无已发布内容。</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-2">标题</th>
                <th>类型</th>
                <th>码</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {materials.map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="py-2 font-medium">{m.title}</td>
                  <td>{m.kind === "courseware" ? "课件" : "考试"}</td>
                  <td className="font-mono">{m.code}</td>
                  <td className="text-right">
                    <Link className="text-blue-600" href={`/s/${m.code}`}>
                      进入 →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
