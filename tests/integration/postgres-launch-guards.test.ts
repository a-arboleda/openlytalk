import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createDatabase } from "@/lib/persistence/postgres/database";
import { anonymousSessions, storyPractices, requestRateLimits } from "@/lib/persistence/postgres/schema";
import { consumeBudgets, RateLimitExceeded } from "@/lib/operations/rate-limit";
import { cleanupExpiredTransaction, removeExpiredOwners } from "@/lib/operations/retention";
import { createStory } from "@/lib/story-practice/engine";
import { PostgresStoryRepository } from "@/lib/story-practice/repository";
config({ path: ".env.local", quiet: true });
const enabled = process.env.RUN_DATABASE_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const db = enabled ? createDatabase(process.env.DATABASE_URL!) : undefined;
afterAll(async () => { await db?.$client.end(); });
(enabled ? describe : describe.skip)("Postgres launch guards", () => {
  it("atomically limits concurrent requests and rolls back other budgets on rejection", async () => {
    if (!db) throw new Error("Missing DB");
    const keys = [randomUUID(), randomUUID()].sort();
    const now = Date.now();
    try {
      const budget = { key: keys[1], limit: 3, windowMs: 86_400_000 };
      const results = await Promise.allSettled(Array.from({ length: 10 }, () => consumeBudgets(db, [budget], now)));
      expect(results.filter(r => r.status === "fulfilled")).toHaveLength(3);
      expect(results.filter(r => r.status === "rejected" && r.reason instanceof RateLimitExceeded)).toHaveLength(7);
      await expect(consumeBudgets(db, [{ ...budget, key: keys[0] }, budget], now)).rejects.toBeInstanceOf(RateLimitExceeded);
      expect(await db.select().from(requestRateLimits).where(eq(requestRateLimits.key, keys[0]))).toHaveLength(0);
      await expect(consumeBudgets(db, [budget], now + 86_400_000)).resolves.toBeUndefined();
    } finally { await db.delete(requestRateLimits).where(inArray(requestRateLimits.key, keys)); }
  }, 30000);
  it("cleans expired data, preserves active practices even under expired owners, and is idempotent", async () => {
    if (!db) throw new Error("Missing DB");
    const owner = randomUUID();
    const expiredOwner = randomUUID();
    const rateKey = randomUUID();
    // A historical cutoff isolates fixtures from real current sessions.
    const now = new Date("2000-01-10T00:00:00Z");
    await db.transaction(async tx => {
    try {
      await tx.insert(anonymousSessions).values([owner, expiredOwner].map(id => ({ id, createdAt: "2000-01-01T00:00:00Z", expiresAt: "2000-01-09T00:00:00Z" })));
      // Build valid records in memory; repository create/get opportunistically purges.
      const memory = { create: async () => {}, recent: async () => [] };
      const base = await createStory(memory as unknown as PostgresStoryRepository, owner, { mode: "free_share" });
      const expired = { ...base, createdAt: "2000-01-01T00:00:00.000Z", updatedAt: "2000-01-01T00:00:00.000Z", expiresAt: "2000-01-06T00:00:00.000Z" };
      const active = { ...base, id: randomUUID(), createdAt: "2000-01-09T00:00:00.000Z", updatedAt: "2000-01-09T00:00:00.000Z", expiresAt: "2000-01-14T00:00:00.000Z" };
      await tx.insert(storyPractices).values([expired, active].map(state => ({ id: state.id, anonymousSessionId: owner, stateJson: state, createdAt: state.createdAt, updatedAt: state.updatedAt, expiresAt: state.expiresAt })));
      await tx.insert(requestRateLimits).values({ key: rateKey, windowStart: "2000-01-01T00:00:00Z", expiresAt: "2000-01-02T00:00:00Z", count: 1 });
      await removeExpiredOwners(tx, now.toISOString());
      expect(await tx.select().from(anonymousSessions).where(eq(anonymousSessions.id, owner))).toHaveLength(1);
      await cleanupExpiredTransaction(tx, now);
      const remaining = await tx.select().from(storyPractices).where(eq(storyPractices.anonymousSessionId, owner));
      expect(remaining.map(row => row.id)).toEqual([active.id]);
      expect(await tx.select().from(anonymousSessions).where(eq(anonymousSessions.id, expiredOwner))).toHaveLength(0);
      expect(await tx.select().from(requestRateLimits).where(eq(requestRateLimits.key, rateKey))).toHaveLength(0);
      expect(await cleanupExpiredTransaction(tx, now)).toMatchObject({ skipped: false, deleted: { story_practices: 0 } });
    } finally {
      await tx.delete(anonymousSessions).where(inArray(anonymousSessions.id, [owner, expiredOwner]));
      await tx.execute(sql`DELETE FROM request_rate_limits WHERE key = ${rateKey}`);
    }
    });
  }, 30000);
});
