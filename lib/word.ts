import "server-only";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";

export type ExtractedDoc = {
  text: string;
  titleHint: string;
  format: "docx" | "doc" | "txt";
};

function run(cmd: string, args: string[], cwd?: string): Promise<{ code: number; out: string; err: string }> {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { cwd, windowsHide: true });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("error", (e) => resolve({ code: 1, out, err: String(e) }));
    p.on("close", (code) => resolve({ code: code ?? 1, out, err }));
  });
}

async function which(bin: string) {
  const r = await run(process.platform === "win32" ? "where" : "which", [bin]);
  return r.code === 0 ? r.out.trim().split(/\r?\n/)[0] : "";
}

/** Strip Word junk; keep clean teaching content only. */
export function cleanDocText(raw: string) {
  let t = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  t = t.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  t = t.replace(/\u00ad/g, "");
  t = t.replace(/\u200b|\u200c|\u200d|\ufeff/g, "");
  t = t.replace(/[ \t]+\n/g, "\n");
  t = t.replace(/\n{3,}/g, "\n\n");
  t = t.replace(/^课程标准\s*课标解读\s*$/gm, "");
  return t.trim();
}

async function extractDocx(buf: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer: buf });
  return cleanDocText(result.value || "");
}

async function extractDocWithWordExtractor(buf: Buffer): Promise<string> {
  const mod = await import("word-extractor");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const WordExtractor = (mod as any).default || mod;
  const extractor = new WordExtractor();
  const doc = await extractor.extract(buf);
  return cleanDocText(doc.getBody() || "");
}

async function convertDocToDocx(buf: Buffer): Promise<Buffer | null> {
  const soffice = (await which("soffice")) || (await which("libreoffice"));
  if (!soffice) return null;
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "exam-doc-"));
  try {
    const src = path.join(dir, "in.doc");
    await fs.writeFile(src, buf);
    const r = await run(soffice, ["--headless", "--convert-to", "docx", "--outdir", dir, src]);
    if (r.code !== 0) return null;
    try {
      return await fs.readFile(path.join(dir, "in.docx"));
    } catch {
      return null;
    }
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

export function isWordName(name: string) {
  return /\.docx?$/i.test(name);
}

export function wordMime(name: string) {
  if (/\.docx$/i.test(name)) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (/\.doc$/i.test(name)) return "application/msword";
  return "application/octet-stream";
}

/** Extract clean plain text from .doc / .docx / .txt for AI structuring. */
export async function extractWord(buf: Buffer, name: string): Promise<ExtractedDoc> {
  const lower = name.toLowerCase();
  const titleHint = name.replace(/\.[^.]+$/, "").trim();

  if (lower.endsWith(".txt")) {
    return { text: cleanDocText(buf.toString("utf8")), titleHint, format: "txt" };
  }

  if (lower.endsWith(".docx")) {
    return { text: await extractDocx(buf), titleHint, format: "docx" };
  }

  if (lower.endsWith(".doc")) {
    const converted = await convertDocToDocx(buf);
    if (converted) {
      return { text: await extractDocx(converted), titleHint, format: "doc" };
    }
    try {
      const text = await extractDocWithWordExtractor(buf);
      if (text.trim()) return { text, titleHint, format: "doc" };
    } catch (e) {
      console.error("word-extractor failed", e);
    }
    throw new Error("无法解析 .doc 文件。请用 Word/WPS 另存为 .docx 后再上传，或在本机安装 LibreOffice。");
  }

  throw new Error("不支持的 Word 格式，请上传 .doc 或 .docx");
}
