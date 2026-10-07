import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createDatabase } from "@/lib/persistence/postgres/database";
import { anonymousSessions } from "@/lib/persistence/postgres/schema";
import { PostgresStoryRepository } from "@/lib/story-practice/repository";
import { actOnStory, createStory, submitStory } from "@/lib/story-practice/engine";
config({ path: ".env.local", quiet: true });
const enabled = process.env.RUN_DATABASE_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const db = enabled ? createDatabase(process.env.DATABASE_URL!) : undefined;
afterAll(async () => { await db?.$client.end(); });
(enabled ? describe : describe.skip)("Postgres story practice", () => {
  it("persists across workers and fences duplicate submits; enforces ownership and deletion", async () => {
    if (!db) throw new Error("Missing database");
    const owner = randomUUID(); const now = new Date();
    await db.insert(anonymousSessions).values({ id: owner, createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + 86400000).toISOString() });
    const repo = new PostgresStoryRepository(db), other = new PostgresStoryRepository(db);
    try {
      let state = await createStory(repo, owner, { mode: "daily_question" });
      expect(await other.get(state.id, owner, now.toISOString())).toEqual(state);
      expect(await other.get(state.id, randomUUID(), now.toISOString())).toBeNull();
      expect(await repo.recent(owner, now.toISOString())).toContain(state.questionReference!.id);
      state = await actOnStory(repo, state.id, owner, { action: "start", expectedUpdatedAt: state.updatedAt, idempotencyKey: randomUUID() });
      const key = randomUUID();
      const request = { repo, id: state.id, owner, key, expectedUpdatedAt: state.updatedAt, expectedLearnerSequence: 0, prepareTranscript: async () => "Last week I baked bread.", feedback: async ({ learnerMessageId }: { learnerMessageId: string }) => ({ substantiallyEnglish: true, safetyStop: false, feedback: { entryMode: "random_question" as const, kind: "full" as const, whatYouPracticed: "Describing a recent attempt.", whatWorked: null, oneImprovement: { text: "Add the outcome.", quote: "I baked bread", learnerMessageId }, concision: { observation: { text: "You kept to one event.", quote: "I baked bread", learnerMessageId }, nextStep: null }, naturalExample: { text: "Last week I baked bread.", learnerMessageId }, englishPolish: [], tryItInRealLife: "Describe a recent attempt." } }) };
      const results = await Promise.allSettled([submitStory(request), submitStory({ ...request, repo: other })]);
      expect(results.some(r => r.status === "fulfilled")).toBe(true);
      const completed = (await repo.get(state.id, owner, now.toISOString()))!;
      expect(completed.acceptedResponseCount).toBe(1);
      expect(await submitStory(request)).toEqual(completed);
      await other.delete(state.id, randomUUID());
      expect(await repo.get(state.id, owner, now.toISOString())).not.toBeNull();
      await other.delete(state.id, owner);
      expect(await repo.get(state.id, owner, now.toISOString())).toBeNull();
      const free = await createStory(repo, owner, { mode: "free_share" });
      expect(free.questionReference).toBeNull();
      expect(free.expiresAt > free.createdAt).toBe(true);
    } finally { await db.delete(anonymousSessions).where(eq(anonymousSessions.id, owner)); }
  }, 30000);
});
