import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { dailyCatalog, getDailyPractice, getTodayCard, validateDailyCatalog } from "@/lib/story-practice/daily";
import { dailyContextSchema, publicStory, storyStateSchema, type StoryState } from "@/lib/story-practice/contracts";
import { createStory, actOnStory } from "@/lib/story-practice/engine";
import type { StoryRepository } from "@/lib/story-practice/repository";
import { POST as retiredSpeech } from "@/app/api/story-practices/[id]/speech/route";
import { feedbackInstructions } from "@/lib/story-practice/feedback-provider";

describe("personal daily practice", () => {
  it("changes at UTC midnight without switching categories after seven days", () => {
    const first = getDailyPractice(new Date("2026-10-07T23:59:59.999Z"));
    const second = getDailyPractice(new Date("2026-10-08T00:00:00Z"));
    expect(first.question.id).not.toBe(second.question.id);
    for (let i = 0; i < 28; i++) {
      const result = getDailyPractice(new Date(Date.UTC(2026, 9, 7 + i)));
      expect(result.question.id).toBe(dailyCatalog.questions[i].id);
      expect(result.daily.categoryId).toBe("getting-to-know-yourself");
      expect(result.daily).not.toHaveProperty("day");
      expect(result.daily).not.toHaveProperty("themeTitle");
    }
    expect(getDailyPractice(new Date("2026-11-04T00:00:00Z")).question).toEqual(first.question);
    expect(getDailyPractice(new Date("2026-01-01T00:00:00Z")).question).toEqual(first.question);
    expect(() => getDailyPractice(new Date("invalid"))).toThrow();
  });
  it("reveals only today's wording and public context", () => {
    const card = getTodayCard(new Date("2026-10-07T12:00:00Z"));
    const visible = JSON.stringify(card);
    for (const q of dailyCatalog.questions.slice(1)) expect(visible).not.toContain(q.text);
    for (const key of ["coachingLens", "feedbackGuidance", "responseGuide", "techniqueId"]) expect(visible).not.toContain(key);
  });
  it("validates the catalog and its editorial documentation", () => {
    expect(dailyCatalog.questions).toHaveLength(28);
    const doc = readFileSync("docs/daily-self-discovery-practice.md", "utf8");
    for (const q of dailyCatalog.questions) expect(doc).toContain(q.text);
    const duplicate = structuredClone(dailyCatalog); duplicate.questions[1].id = duplicate.questions[0].id;
    expect(() => validateDailyCatalog(duplicate)).toThrow();
    const wording = structuredClone(dailyCatalog); wording.questions[1].text = wording.questions[0].text;
    expect(() => validateDailyCatalog(wording)).toThrow();
    const draft = structuredClone(dailyCatalog); draft.questions[0].status = "draft";
    expect(() => validateDailyCatalog(draft)).toThrow();
    expect(() => validateDailyCatalog({ ...dailyCatalog, questions: [] })).toThrow();
  });
  it("keeps retained weekly snapshots readable", () => {
    const legacy = { themeId: "the-way-you-do-things", themeTitle: "The Way You Do Things", day: 7, date: "2026-10-07", supportPrompt: null };
    expect(dailyContextSchema.parse(legacy)).toEqual(legacy);
  });
  it("keeps an opened session's question across midnight", async () => {
    let row: StoryState | undefined;
    const repo: StoryRepository = {
      create: async s => { row = structuredClone(s); },
      get: async () => row ? structuredClone(row) : null,
      recent: async () => [], delete: async () => { row = undefined; },
      compareAndSwap: async (before, next) => {
        if (row?.updatedAt !== before.updatedAt) return false;
        row = storyStateSchema.parse(next); return true;
      },
    };
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-10-07T23:59:59Z"));
      const owner = randomUUID(); const s = await createStory(repo, owner, { mode: "daily_question" });
      vi.setSystemTime(new Date("2026-10-08T00:00:01Z"));
      const started = await actOnStory(repo, s.id, owner, { action: "start", expectedUpdatedAt: s.updatedAt, idempotencyKey: randomUUID() });
      expect(publicStory(started).question).toEqual(publicStory(s).question);
      expect(started.daily).toEqual(s.daily);
      expect(started.questionReference?.id).not.toBe(getDailyPractice().question.id);
    } finally { vi.useRealTimers(); }
  });
  it("keeps coaching about expression and retires question speech", async () => {
    expect(feedbackInstructions("random_question")).toContain("assess expression rather than the learner’s self-knowledge");
    expect(feedbackInstructions("random_question")).toContain("not psychological advice");
    expect((await retiredSpeech()).status).toBe(410);
  });
});
