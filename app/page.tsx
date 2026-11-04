"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import AccountPicker from "@/components/AccountPicker";

export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [tUser, setTUser] = useState("");
  const [tPass, setTPass] = useState("");
  const [tErr, setTErr] = useState("");
  const [tBusy, setTBusy] = useState(false);
  const [sUser, setSUser] = useState("");
  const [sPass, setSPass] = useState("");
  const [sErr, setSErr] = useState("");
  const [sBusy, setSBusy] = useState(false);

  async function teacherLogin(e: FormEvent) {
    e.preventDefault();
    setTErr("");
    if (!tUser.trim() || !tPass) {
      setTErr("请填写老师账号和密码");
      return;
    }
    setTBusy(true);
    try {
      const r = await fetch("/api/teacher/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: tUser.trim(), password: tPass }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "账号或密码错误");
      router.push("/teacher");
    } catch (err) {
      setTErr(err instanceof Error ? err.message : String(err));
    } finally {
      setTBusy(false);
    }
  }

  async function studentLogin(e: FormEvent) {
    e.preventDefault();
    setSErr("");
    if (!sUser.trim() || !sPass) {
      setSErr("请填写学号和密码");
      return;
    }
    setSBusy(true);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: sUser.trim(), password: sPass }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "学号或密码错误");
      if (j.user?.role !== "student") {
        await fetch("/api/auth/logout", { method: "POST" });
        throw new Error("此账号不是学生，请用对应入口登录");
      }
      router.push("/student");
    } catch (err) {
      setSErr(err instanceof Error ? err.message : String(err));
    } finally {
      setSBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-16">
      <h1 className="text-3xl font-bold text-center">万智学习 · 智能阅卷</h1>
      <p className="mt-3 text-center text-slate-500">多老师 / 多学生档案 · 小班教学 · 考试与课件</p>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        <div className="card flex flex-col">
          <div className="text-4xl">🏫</div>
          <h2 className="mt-3 text-xl font-semibold">超级校长</h2>
          <p className="mt-2 flex-1 text-sm text-slate-500">
            管理老师与学生档案，编排小班（1 位老师 + 最多 5 名学生）。
          </p>
          <Link href="/principal" className="btn btn-primary mt-5 justify-center">
            校长后台
          </Link>
        </div>

        <div className="card flex flex-col">
          <div className="text-4xl">👩‍🏫</div>
          <h2 className="mt-3 text-xl font-semibold">老师登录</h2>
          <p className="mt-2 text-sm text-slate-500">输入或下拉选择老师账号，再填密码。</p>
          <form onSubmit={teacherLogin} className="mt-1 flex flex-1 flex-col">
            <AccountPicker
              role="teacher"
              value={tUser}
              onChange={setTUser}
              label="老师账号"
              placeholder="输入姓名/账号，自动匹配"
              compact
            />
            <label className="label mt-2">密码</label>
            <input
              className="input"
              type="password"
              value={tPass}
              onChange={(e) => setTPass(e.target.value)}
              autoComplete="current-password"
            />
            {tErr && <p className="mt-2 text-sm text-red-600">{tErr}</p>}
            <button className="btn btn-primary mt-4 w-full justify-center" disabled={tBusy}>
              {tBusy ? "登录中…" : "登录教师后台"}
            </button>
          </form>
        </div>

        <div className="card flex flex-col">
          <div className="text-4xl">🧑‍🎓</div>
          <h2 className="mt-3 text-xl font-semibold">学生登录</h2>
          <p className="mt-2 text-sm text-slate-500">输入学号登录；也可直接用 6 位码进考试/课件。</p>
          <form onSubmit={studentLogin} className="mt-1">
            <AccountPicker
              role="student"
              value={sUser}
              onChange={setSUser}
              label="学号"
              placeholder="输入或选择学号"
              compact
            />
            <label className="label mt-2">密码</label>
            <input
              className="input"
              type="password"
              value={sPass}
              onChange={(e) => setSPass(e.target.value)}
              autoComplete="current-password"
            />
            {sErr && <p className="mt-2 text-sm text-red-600">{sErr}</p>}
            <button className="btn btn-green mt-4 w-full justify-center" disabled={sBusy}>
              {sBusy ? "登录中…" : "学生登录"}
            </button>
          </form>
          <form
            className="mt-3 flex gap-2 border-t border-slate-100 pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim()) router.push(`/s/${code.trim().toUpperCase()}`);
            }}
          >
            <input
              className="input uppercase tracking-widest"
              placeholder="考试/课件码"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <button className="btn btn-ghost shrink-0" type="submit">
              进入
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
