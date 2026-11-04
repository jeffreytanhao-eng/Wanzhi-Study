"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Home() {
  const [code, setCode] = useState("");
  const router = useRouter();
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-16">
      <h1 className="text-3xl font-bold text-center">万智学习 · 智能阅卷</h1>
      <p className="mt-3 text-center text-slate-500">
        多老师 / 多学生档案 · 小班教学 · 考试与课件
      </p>

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
          <h2 className="mt-3 text-xl font-semibold">老师</h2>
          <p className="mt-2 flex-1 text-sm text-slate-500">
            账号密码登录；上传试卷 / 课件，查看我的小班。
          </p>
          <Link href="/teacher" className="btn btn-primary mt-5 justify-center">
            教师后台
          </Link>
        </div>

        <div className="card flex flex-col">
          <div className="text-4xl">🧑‍🎓</div>
          <h2 className="mt-3 text-xl font-semibold">学生</h2>
          <p className="mt-2 text-sm text-slate-500">登录查看我的小班与老师发布的内容；也可直接输入 6 位码。</p>
          <Link href="/student" className="btn btn-green mt-4 justify-center">
            学生登录
          </Link>
          <form
            className="mt-3 flex gap-2"
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
