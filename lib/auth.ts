import "server-only";
import { cookies } from "next/headers";
import { createHash } from "crypto";

export const COOKIE = "teacher_auth";

export function passcode() {
  return process.env.TEACHER_PASSCODE || "teacher123";
}

export function tokenFor(code: string) {
  return createHash("sha256")
    .update(`${code}::${process.env.APP_SECRET || "exam-grader-secret"}`)
    .digest("hex");
}

export async function isTeacher() {
  const c = await cookies();
  return c.get(COOKIE)?.value === tokenFor(passcode());
}

export function unauthorized() {
  return Response.json({ error: "未登录或口令错误" }, { status: 401 });
}
