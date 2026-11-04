import { cookies } from "next/headers";
import { SESSION_COOKIE, COOKIE } from "@/lib/auth";

export async function POST() {
  const c = await cookies();
  c.delete(SESSION_COOKIE);
  c.delete(COOKIE);
  return Response.json({ ok: true });
}
