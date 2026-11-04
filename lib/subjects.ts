export const SUBJECTS = [
  "语文",
  "数学",
  "英语",
  "物理",
  "化学",
  "生物",
  "历史",
  "地理",
  "道德与法治",
  "其他",
] as const;

export type Subject = (typeof SUBJECTS)[number];

export function isSubject(v: unknown): v is Subject {
  return typeof v === "string" && (SUBJECTS as readonly string[]).includes(v);
}
