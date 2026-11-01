"use client";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

function normalize(s: string) {
  // convert \( \) and \[ \] to $ delimiters
  return (s || "")
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, m) => `$$${m}$$`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, m) => `$${m}$`);
}

export default function Md({ children, className = "" }: { children: string; className?: string }) {
  return (
    <div className={`md ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {normalize(children)}
      </ReactMarkdown>
    </div>
  );
}
