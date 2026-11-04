"use client";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import type { Components } from "react-markdown";

function normalize(s: string) {
  // convert \( \) and \[ \] to $ delimiters
  return (s || "")
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, m) => `$$${m}$$`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, m) => `$${m}$`);
}

const components: Components = {
  img: ({ src, alt }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src || ""}
      alt={alt || "图"}
      className="exam-figure mx-auto my-3 max-h-72 max-w-full rounded border border-slate-200 bg-white p-2"
    />
  ),
};

export default function Md({ children, className = "" }: { children: string; className?: string }) {
  return (
    <div className={`md ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={components}>
        {normalize(children)}
      </ReactMarkdown>
    </div>
  );
}
