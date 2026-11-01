import { COOKIE } from "@/lib/auth";
import { cookies } from "next/headers";
export async function POST() {
  (await cookies()).delete(COOKIE);
  return Response.json({ ok: true });
}
