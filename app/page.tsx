"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Home() {
  const [code, setCode] = useState("");
  const router = useRouter();
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-16">
      <h1 className="text-3xl font-bold text-center">智能阅卷 · 在线考试</h1>
      <p className="mt-3 text-center text-slate-500">上传试卷 → 自动识别题目 → 设置时间与分值 → 学生在线答题 → 自动评分并给出解题过程</p>
      <div className="mt-12 grid gap-6 md:grid-cols-2">
        <div className="card flex flex-col">
          <div className="text-4xl">👩‍🏫</div>
          <h2 className="mt-3 text-xl font-semibold">我是老师</h2>
          <p className="mt-2 flex-1 text-sm text-slate-500">上传 PDF / 图片试卷，AI 识别题目；编辑题目、设定分值与考试时长；发布后获得考试码；查看学生成绩。</p>
          <Link href="/teacher" className="btn btn-primary mt-5 justify-center">进入教师后台</Link>
        </div>
        <div className="card flex flex-col">
          <div className="text-4xl">🧑‍🎓</div>
          <h2 className="mt-3 text-xl font-semibold">我是学生</h2>
          <p className="mt-2 text-sm text-slate-500">输入老师给你的 6 位考试码开始答题。</p>
          <form
            className="mt-5 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim()) router.push(`/s/${code.trim().toUpperCase()}`);
            }}
          >
            <input className="input uppercase tracking-widest" placeholder="考试码，如 AB3XYZ" value={code} onChange={(e) => setCode(e.target.value)} />
            <button className="btn btn-green shrink-0">开始考试</button>
          </form>
        </div>
      </div>
    </main>
  );
}
