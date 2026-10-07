import { timingSafeEqual } from "node:crypto";
import { createDatabase } from "@/lib/persistence/postgres/database";
import { cleanupExpiredData } from "@/lib/operations/retention";
export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store, private" };
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) return Response.json({ error: "Cleanup is not configured." }, { status: 503, headers });
  const expected = Buffer.from(`Bearer ${secret}`);
  const provided = Buffer.from(request.headers.get("authorization") ?? "");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  }
  if (!process.env.DATABASE_URL) return Response.json({ error: "Cleanup is unavailable." }, { status: 503, headers });
  const db = createDatabase(process.env.DATABASE_URL);
  try {
    return Response.json(await cleanupExpiredData(db), { headers });
  } catch {
    // Failed invocations remain visible in Vercel without logging learner data.
    console.error("retention_cleanup_failed");
    return Response.json({ error: "Cleanup failed." }, { status: 503, headers });
  } finally {
    await db.$client.end();
  }
}
