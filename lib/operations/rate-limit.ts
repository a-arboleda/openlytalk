import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { sql } from "drizzle-orm";
import { createDatabase, type OpenlyTalkDatabase } from "@/lib/persistence/postgres/database";

export class RateLimitExceeded extends Error {
  constructor(readonly retryAfter: number) { super("Too many requests"); }
}
export interface RequestBudget { key: string; limit: number; windowMs: number }

export function needsRequestLimit(method: string, path: string): boolean {
  if (!/^\/api\/(story-practices|practice-sessions|conversations|episodes)(\/|$)/.test(path)) return false;
  return method === "POST" || (method === "GET" && /\/(speech|coach-speech|prompt-speech)$/.test(path));
}

export function requestBudgets(request: Request, env = process.env): RequestBudget[] {
  const secret = env.RATE_LIMIT_SECRET;
  if (!secret || secret.length < 32) throw new Error("Rate limit configuration unavailable");
  // Only trust this header on Vercel, where the platform overwrites it.
  const ip = env.VERCEL === "1" ? request.headers.get("x-vercel-forwarded-for")?.trim() : "local";
  if (!ip || (env.VERCEL === "1" && !isIP(ip))) throw new Error("Client identity unavailable");
  const hash = (value: string) => createHmac("sha256", secret).update(value).digest("hex");
  const budget = (key: string, limit: number, windowMs: number) => ({ key: hash(key), limit, windowMs });
  const day = 86_400_000;
  const budgets = [
    budget("global:day", 1000, day),
    budget(`ip:${ip}:burst`, 30, 600_000),
    budget(`ip:${ip}:day`, 120, day),
  ];
  const owner = request.headers.get("cookie")?.match(/(?:^|;\s*)openlytalk_session=([0-9a-f-]{36})(?:;|$)/i)?.[1];
  if (owner) budgets.push(budget(`owner:${owner}:burst`, 20, 600_000), budget(`owner:${owner}:day`, 80, day));
  return budgets.sort((a, b) => a.key.localeCompare(b.key));
}

/** Atomic across instances; rejecting any budget rolls back every increment. */
export async function consumeBudgets(db: OpenlyTalkDatabase, budgets: RequestBudget[], now = Date.now()) {
  await db.transaction(async tx => {
    for (const budget of [...budgets].sort((a, b) => a.key.localeCompare(b.key))) {
      const start = Math.floor(now / budget.windowMs) * budget.windowMs;
      const end = start + budget.windowMs;
      const result = await tx.execute(sql`
        INSERT INTO request_rate_limits (key, window_start, expires_at, count)
        VALUES (${budget.key}, ${new Date(start).toISOString()}::timestamptz, ${new Date(end).toISOString()}::timestamptz, 1)
        ON CONFLICT (key, window_start) DO UPDATE SET count = request_rate_limits.count + 1
        WHERE request_rate_limits.count < ${budget.limit}
        RETURNING count
      `);
      if (!result.rows.length) throw new RateLimitExceeded(Math.max(1, Math.ceil((end - now) / 1000)));
    }
  });
}

let database: OpenlyTalkDatabase | undefined;
export async function enforceRequestLimit(request: Request) {
  const budgets = requestBudgets(request);
  if (!process.env.DATABASE_URL) throw new Error("Database unavailable");
  database ??= createDatabase(process.env.DATABASE_URL);
  await consumeBudgets(database, budgets);
}
