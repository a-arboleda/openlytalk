import { and, desc, eq, gt, lte } from "drizzle-orm";
import { parseServerEnv } from "@/lib/env";
import { createDatabase, type OpenlyTalkDatabase } from "@/lib/persistence/postgres/database";
import { storyPractices } from "@/lib/persistence/postgres/schema";
import { storyStateSchema, type StoryState } from "@/lib/story-practice/contracts";

export interface StoryRepository {
  create(state: StoryState): Promise<void>;
  get(id: string, owner: string, now: string): Promise<StoryState | null>;
  recent(owner: string, now: string): Promise<string[]>;
  compareAndSwap(previous: StoryState, next: StoryState, now: string): Promise<boolean>;
  delete(id: string, owner: string): Promise<void>;
}
export class PostgresStoryRepository implements StoryRepository {
  constructor(private db: OpenlyTalkDatabase) {}
  async purge(now: string) {
    await this.db.delete(storyPractices).where(lte(storyPractices.expiresAt, now));
  }
  async create(state: StoryState) {
    const s = storyStateSchema.parse(state);
    await this.purge(s.createdAt);
    await this.db.insert(storyPractices).values({ id: s.id, anonymousSessionId: s.anonymousSessionId, stateJson: s, createdAt: s.createdAt, updatedAt: s.updatedAt, expiresAt: s.expiresAt });
  }
  async get(id: string, owner: string, now: string) {
    await this.purge(now);
    const [row] = await this.db.select().from(storyPractices).where(and(eq(storyPractices.id, id), eq(storyPractices.anonymousSessionId, owner), gt(storyPractices.expiresAt, now))).limit(1);
    return row ? storyStateSchema.parse(row.stateJson) : null;
  }
  async recent(owner: string, now: string) {
    const rows = await this.db.select({ state: storyPractices.stateJson }).from(storyPractices).where(and(eq(storyPractices.anonymousSessionId, owner), gt(storyPractices.expiresAt, now))).orderBy(desc(storyPractices.updatedAt)).limit(5);
    return [...new Set(rows.flatMap(row => storyStateSchema.parse(row.state).recentQuestionIds))].slice(0, 5);
  }
  async compareAndSwap(previous: StoryState, next: StoryState, now: string) {
    const s = storyStateSchema.parse(next);
    if (s.id !== previous.id || s.anonymousSessionId !== previous.anonymousSessionId || s.updatedAt <= previous.updatedAt) throw new Error("Invalid state transition.");
    const rows = await this.db.update(storyPractices).set({ stateJson: s, updatedAt: s.updatedAt }).where(and(eq(storyPractices.id, previous.id), eq(storyPractices.anonymousSessionId, previous.anonymousSessionId), eq(storyPractices.updatedAt, previous.updatedAt), gt(storyPractices.expiresAt, now))).returning({ id: storyPractices.id });
    return rows.length === 1;
  }
  async delete(id: string, owner: string) {
    await this.db.delete(storyPractices).where(and(eq(storyPractices.id, id), eq(storyPractices.anonymousSessionId, owner)));
  }
}
let repository: PostgresStoryRepository | undefined;
export function getStoryRepository() {
  if (!repository) {
    const { DATABASE_URL } = parseServerEnv();
    if (!DATABASE_URL) throw new Error("Database unavailable.");
    repository = new PostgresStoryRepository(createDatabase(DATABASE_URL));
  }
  return repository;
}
