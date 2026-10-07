import { sql } from "drizzle-orm";
import type { OpenlyTalkDatabase } from "@/lib/persistence/postgres/database";

type Transaction = Parameters<Parameters<OpenlyTalkDatabase["transaction"]>[0]>[0];

/** Lock parents first, then check references in a fresh READ COMMITTED snapshot.
 * SKIP LOCKED avoids blocking a concurrent renewal or practice creation.
 */
export async function removeExpiredOwners(tx: Transaction, timestamp: string) {
  const candidates = await tx.execute<{ id: string }>(sql`
    SELECT id FROM anonymous_sessions WHERE expires_at <= ${timestamp}::timestamptz
    ORDER BY expires_at LIMIT 5000 FOR UPDATE SKIP LOCKED
  `);
  if (!candidates.rows.length) return 0;
  const ids = sql.join(candidates.rows.map(row => sql`${row.id}::uuid`), sql`, `);
  const result = await tx.execute(sql`
    DELETE FROM anonymous_sessions a WHERE a.id IN (${ids})
      AND a.expires_at <= ${timestamp}::timestamptz
      AND NOT EXISTS (SELECT 1 FROM conversations c WHERE c.session_id = a.id)
      AND NOT EXISTS (SELECT 1 FROM practice_sessions p WHERE p.anonymous_session_id = a.id)
      AND NOT EXISTS (SELECT 1 FROM story_practices s WHERE s.anonymous_session_id = a.id)
    RETURNING a.id
  `);
  return result.rows.length;
}

export async function cleanupExpiredData(db: OpenlyTalkDatabase, now = new Date()) {
  return db.transaction(tx => cleanupExpiredTransaction(tx, now));
}

export async function cleanupExpiredTransaction(tx: Transaction, now: Date) {
    // Duplicate cron deliveries do not compete for the same rows.
    const lock = await tx.execute<{ locked: boolean }>(sql`SELECT pg_try_advisory_xact_lock(714023, 1) AS locked`);
    if (!lock.rows[0]?.locked) return { skipped: true };
    await tx.execute(sql`SET LOCAL statement_timeout = '20000'`);
    const timestamp = now.toISOString();
    const counts: Record<string, number> = {};
    for (const table of ["story_practices", "practice_sessions", "conversations", "request_rate_limits"] as const) {
      // Identifiers are a closed source-code allowlist, never request input.
      const name = sql.identifier(table);
      const result = await tx.execute(sql`
        DELETE FROM ${name} WHERE expires_at <= ${timestamp}::timestamptz RETURNING 1
      `);
      counts[table] = result.rows.length;
    }
    counts.anonymous_sessions = await removeExpiredOwners(tx, timestamp);
    return { skipped: false, deleted: counts };
}
