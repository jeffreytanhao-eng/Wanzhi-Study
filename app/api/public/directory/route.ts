import { initDb } from "@/lib/db";
import { listLoginDirectory } from "@/lib/accounts";

export async function GET(req: Request) {
  await initDb();
  const role = new URL(req.url).searchParams.get("role");
  if (role !== "teacher" && role !== "student") {
    return Response.json({ error: "role 须为 teacher 或 student" }, { status: 400 });
  }
  return Response.json({ items: listLoginDirectory(role) });
}
