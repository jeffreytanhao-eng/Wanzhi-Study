import { COOKIE, passcode, tokenFor } from "@/lib/auth";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  const { code } = await req.json();
  if (String(code || "").trim() !== passcode())
    return Response.json({ error: "口令错误" }, { status: 401 });
  (await cookies()).set(COOKIE, tokenFor(passcode()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return Response.json({ ok: true });
}
