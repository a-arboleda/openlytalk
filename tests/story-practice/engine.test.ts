import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { storyCatalog, validateCatalog } from "@/lib/story-practice/catalog";
import { createStorySchema, publicStory, storyStateSchema, type StoryState, type StoryFeedback } from "@/lib/story-practice/contracts";
import { actOnStory, createStory, submitStory, validateFeedback, type FeedbackProvider } from "@/lib/story-practice/engine";
import type { StoryRepository } from "@/lib/story-practice/repository";
import { feedbackInstructions } from "@/lib/story-practice/feedback-provider";
import { signPreview, verifyPreview } from "@/lib/story-practice/preview-proof";

export class MemoryStoryRepository implements StoryRepository {
  rows = new Map<string, StoryState>();
  async create(s: StoryState) { this.rows.set(s.id, structuredClone(s)); }
  async get(id: string, owner: string, now: string) {
    const s = this.rows.get(id);
    return s && s.anonymousSessionId === owner && s.expiresAt > now ? structuredClone(s) : null;
  }
  async recent(owner: string) { return [...this.rows.values()].filter(s => s.anonymousSessionId === owner).flatMap(s => s.recentQuestionIds).slice(0, 5); }
  async compareAndSwap(before: StoryState, after: StoryState, now: string) {
    const s = this.rows.get(before.id);
    if (!s || s.updatedAt !== before.updatedAt || s.anonymousSessionId !== before.anonymousSessionId || s.expiresAt <= now) return false;
    this.rows.set(after.id, structuredClone(storyStateSchema.parse(after))); return true;
  }
  async delete(id: string, owner: string) { if (this.rows.get(id)?.anonymousSessionId === owner) this.rows.delete(id); }
}
const transcript = "Last week I tried baking bread. It looked strange, but it tasted good.";
function feedback(mode: "free_share" | "random_question", message: string): StoryFeedback {
  const observation = { text: "You kept the attempt and its outcome together.", quote: "It looked strange, but it tasted good.", learnerMessageId: message };
  return mode === "free_share" ? { entryMode: mode, kind: "full", concision: { observation, nextStep: null, conciseExample: null } } : {
    entryMode: mode, kind: "full", whatYouPracticed: "Describing a first attempt.", whatWorked: observation,
    oneImprovement: { ...observation, text: "Add one detail about the attempt to explain what looked strange." },
    concision: { observation, nextStep: null }, naturalExample: { text: transcript, learnerMessageId: message }, englishPolish: [], tryItInRealLife: "Describe one recent attempt to someone you know.",
  };
}
const provider = vi.fn<FeedbackProvider>(async input => ({ substantiallyEnglish: true, safetyStop: false, feedback: feedback(input.entryMode, input.learnerMessageId) }));
async function setup(mode: "free_share" | "random_question" = "free_share") {
  const repo = new MemoryStoryRepository(); const owner = randomUUID();
  const briefing = await createStory(repo, owner, { mode: mode === "random_question" ? "daily_question" : mode });
  const state = await actOnStory(repo, briefing.id, owner, { action: "start", expectedUpdatedAt: briefing.updatedAt, idempotencyKey: randomUUID() });
  const input = { repo, id: state.id, owner, key: randomUUID(), expectedUpdatedAt: state.updatedAt, expectedLearnerSequence: 0, prepareTranscript: vi.fn(async () => transcript), feedback: provider };
  return { repo, owner, state, input };
}
describe("story catalog and contracts", () => {
  it("matches every exact approved wording and all reviewed guide metadata", () => {
    const doc = readFileSync("docs/simple-practice-question-catalog.md", "utf8");
    expect(storyCatalog).toHaveLength(15);
    for (const q of storyCatalog) {
      expect(doc).toContain(`| \`${q.id}\` | \`approved\` | ${q.text} |`);
      const record = doc.split(`### ${q.id}\n`)[1].split("\n### ")[0].replace(/\s+/g, " ");
      expect(record).toContain(q.coachingLens); expect(record).toContain(q.techniqueId);
      for (const step of q.responseGuide.steps) expect(record).toContain(step);
      expect(record).toContain(q.responseGuide.example);
      expect(record).toContain(q.feedbackGuidance.observe[0]); expect(record).toContain(q.feedbackGuidance.avoid[0]);
    }
  });
  it("rejects duplicate, invalid technique, long and incomplete entries", () => {
    expect(() => validateCatalog([storyCatalog[0], storyCatalog[0]])).toThrow();
    expect(() => validateCatalog([{ ...storyCatalog[0], techniqueId: "made_up" }])).toThrow();
    expect(() => validateCatalog([{ ...storyCatalog[0], text: "recently ".repeat(17) }])).toThrow();
    expect(() => validateCatalog([{ ...storyCatalog[0], responseGuide: { steps: [], example: "" } }])).toThrow();
  });
  it("rejects legacy and client-owned setup fields", () => {
    for (const key of ["questionId", "topic", "family", "primarySkill", "technique", "metadata"]) expect(createStorySchema.safeParse({ mode: "free_share", [key]: "value" }).success).toBe(false);
    expect(createStorySchema.safeParse({ mode: "other" }).success).toBe(false);
  });
});
describe("story lifecycle", () => {
  it("creates free sharing with no question or preselected coaching metadata", async () => {
    const { state } = await setup();
    expect(state.questionReference).toBeNull(); expect(state.privateCoachingMetadata).toBeNull();
    expect(publicStory(state).question).toBeNull(); expect(state.responseLimit).toBe(1);
    expect(storyStateSchema.safeParse({ ...state, responseLimit: 2 }).success).toBe(false);
    expect(storyStateSchema.safeParse({ ...state, privateCoachingMetadata: storyCatalog[0] }).success).toBe(false);
  });
  it("creates the same daily question and rejects replacements", async () => {
    const repo = new MemoryStoryRepository(); const owner = randomUUID();
    const s = await createStory(repo, owner, { mode: "daily_question" });
    const other = await createStory(repo, randomUUID(), { mode: "daily_question" });
    expect(other.questionReference).toEqual(s.questionReference);
    expect(s.daily).toMatchObject({ categoryId: "getting-to-know-yourself" });
    expect(s.replacementCount).toBe(0);
    await expect(actOnStory(repo, s.id, owner, { action: "replace", expectedUpdatedAt: s.updatedAt, idempotencyKey: randomUUID() })).rejects.toThrow("no longer available");
    await expect(createStory(repo, owner, { mode: "random_question" })).rejects.toThrow();
  });
  it.each(["free_share", "random_question"] as const)("completes %s once and replays a duplicate without provider work", async mode => {
    const { input } = await setup(mode);
    const result = await submitStory(input);
    expect(result.status).toBe("completed"); expect(result.acceptedResponseCount).toBe(1);
    const after = vi.fn(async () => { throw new Error("must not run"); });
    expect(await submitStory({ ...input, prepareTranscript: after })).toEqual(result);
    expect(after).not.toHaveBeenCalled();
    await expect(submitStory({ ...input, key: randomUUID(), expectedUpdatedAt: result.updatedAt })).rejects.toThrow();
    const visible = JSON.stringify(publicStory(result));
    expect(visible).not.toContain("coachingLens"); expect(visible).not.toContain("anonymousSessionId"); expect(visible).not.toContain("reservation");
  });
  it.each(["free_share", "random_question"] as const)("commits %s feedback with presentation quotes without requesting a second evaluation", async mode => {
    const { input } = await setup(mode);
    const quotedProvider = vi.fn<FeedbackProvider>(async request => {
      const f = feedback(mode, request.learnerMessageId);
      const observations = [f.concision.observation, ...(f.entryMode === "random_question" ? [f.oneImprovement, ...(f.whatWorked ? [f.whatWorked] : [])] : [])];
      // The fixture shares its strength and concision observation object.
      for (const item of new Set(observations)) item.quote = `“${item.quote}”`;
      return { substantiallyEnglish: true, safetyStop: false, feedback: f };
    });
    const result = await submitStory({ ...input, feedback: quotedProvider });
    expect(result.status).toBe("completed");
    expect(result.acceptedResponseCount).toBe(1);
    expect(quotedProvider).toHaveBeenCalledTimes(1);
  });
  it("sends the dedicated free provider no question, topic or lens", async () => {
    const { input } = await setup();
    const spy = vi.fn<FeedbackProvider>(provider);
    await submitStory({ ...input, feedback: spy });
    expect(Object.keys(spy.mock.calls[0][0]).sort()).toEqual(["entryMode", "learnerMessageId", "transcript"]);
  });
  it("rejects a wrong owner or stale timestamp before provider work", async () => {
    const { input } = await setup();
    await expect(submitStory({ ...input, owner: randomUUID() })).rejects.toThrow();
    await expect(submitStory({ ...input, expectedUpdatedAt: new Date(0).toISOString() })).rejects.toThrow();
    expect(input.prepareTranscript).not.toHaveBeenCalled();
  });
  it("reserves once for simultaneous requests", async () => {
    const { input } = await setup();
    const results = await Promise.allSettled([submitStory(input), submitStory(input)]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(input.prepareTranscript).toHaveBeenCalledTimes(1);
  });
  it("releases a failed operation without persisting preview text or consuming a response", async () => {
    const { input, repo, owner } = await setup();
    await expect(submitStory({ ...input, feedback: async () => { throw new Error("provider failed"); } })).rejects.toThrow();
    const s = (await repo.get(input.id, owner, new Date().toISOString()))!;
    expect(s.acceptedResponseCount).toBe(0); expect(s.transcript).toBeNull(); expect(s.reservation).toBeNull();
    expect((await submitStory({ ...input, expectedUpdatedAt: s.updatedAt })).status).toBe("completed");
  });
  it("blocks moderated content before feedback and releases the response safely", async () => {
    const { input, repo, owner } = await setup();
    const feedback = vi.fn<FeedbackProvider>(async () => { throw new Error("must not run"); });
    await expect(submitStory({ ...input, feedback, moderateTranscript: async () => ({ allowed: false }) })).rejects.toThrow("can’t process");
    expect(feedback).not.toHaveBeenCalled();
    const state = (await repo.get(input.id, owner, new Date().toISOString()))!;
    expect(state.acceptedResponseCount).toBe(0);
    expect(state.reservation).toBeNull();
  });
  it("rejects invalid and non-English responses without consumption; honors safety stops", async () => {
    const { input, repo, owner } = await setup();
    await expect(submitStory({ ...input, prepareTranscript: async () => "" })).rejects.toThrow();
    let s = (await repo.get(input.id, owner, new Date().toISOString()))!;
    await expect(submitStory({ ...input, expectedUpdatedAt: s.updatedAt, feedback: async () => ({ substantiallyEnglish: false, safetyStop: false, feedback: null }) })).rejects.toThrow("English");
    s = (await repo.get(input.id, owner, new Date().toISOString()))!;
    const ended = await submitStory({ ...input, expectedUpdatedAt: s.updatedAt, feedback: async () => ({ substantiallyEnglish: true, safetyStop: true, feedback: null }) });
    expect(ended.status).toBe("ended"); expect(ended.acceptedResponseCount).toBe(0); expect(ended.transcript).toBeNull();
  });
  it("cannot commit a provider result after ending or deleting a session", async () => {
    for (const remove of [false, true]) {
      const { input, repo, owner } = await setup();
      await expect(submitStory({ ...input, feedback: async request => {
        const current = (await repo.get(input.id, owner, new Date().toISOString()))!;
        if (remove) await repo.delete(input.id, owner);
        else await actOnStory(repo, input.id, owner, { action: "end", expectedUpdatedAt: current.updatedAt, idempotencyKey: randomUUID() });
        return { substantiallyEnglish: true, safetyStop: false, feedback: feedback(request.entryMode, request.learnerMessageId) };
      } })).rejects.toThrow();
    }
  });
});
describe("feedback and preview integrity", () => {
  it("rejects unsupported evidence, a wrong learner ID, and extra free-sharing feedback", () => {
    const id = randomUUID(); const request = { entryMode: "free_share" as const, transcript, learnerMessageId: id };
    const f = feedback("free_share", id);
    expect(() => validateFeedback({ ...f, whatYouPracticed: "A story" }, request)).toThrow();
    expect(() => validateFeedback(feedback("free_share", randomUUID()), request)).toThrow();
    expect(() => validateFeedback(f, { ...request, transcript: "different words" })).toThrow();
    expect(validateFeedback(f, request)).toEqual(f);
  });
  it.each(['"It looked strange, but it tasted good."', '“It looked strange, but it tasted good.”', "‘It looked strange, but it tasted good.’", "«It looked strange, but it tasted good.»"])("accepts balanced presentation quotes around verbatim evidence: %s", quote => {
    const id = randomUUID(); const request = { entryMode: "free_share" as const, transcript, learnerMessageId: id };
    const f = feedback("free_share", id);
    f.concision.observation.quote = quote;
    expect(validateFeedback(f, request)).toEqual(f);
  });
  it.each(['“”', '“ ”', '“invented words”', '“It looked strange…tasted good.”', '“It looked strange, but it tasted good."', '“It looked strange, but it tasted great.”'])("still rejects empty, mismatched, stitched and altered evidence: %s", quote => {
    const id = randomUUID(); const f = feedback("free_share", id);
    f.concision.observation.quote = quote;
    expect(() => validateFeedback(f, { entryMode: "free_share", transcript, learnerMessageId: id })).toThrow("Unsupported evidence");
  });
  it("accepts quoted verbatim originals in English polish without allowing corrections as evidence", () => {
    const id = randomUUID(); const f = feedback("random_question", id);
    if (f.entryMode !== "random_question") throw new Error("Wrong fixture");
    const request = { entryMode: "random_question" as const, transcript, learnerMessageId: id, question: storyCatalog[0] };
    f.englishPolish = [{ original: "“I tried baking bread”", suggestion: "I baked bread for the first time", explanation: "Be precise about the attempt.", learnerMessageId: id }];
    expect(validateFeedback(f, request)).toEqual(f);
    f.englishPolish[0].original = "“I baked bread for the first time”";
    expect(() => validateFeedback(f, request)).toThrow("Unsupported English polish");
  });
  it("binds stateless previews to the owner, session, audio and transcript", () => {
    vi.stubEnv("OPENAI_API_KEY", "test-secret");
    const owner = randomUUID(), id = randomUUID(), audio = new Uint8Array([1, 2]);
    const proof = signPreview(owner, id, audio, transcript);
    expect(verifyPreview(owner, id, audio, transcript, proof)).toBe(true);
    expect(verifyPreview(randomUUID(), id, audio, transcript, proof)).toBe(false);
    expect(verifyPreview(owner, id, new Uint8Array([3]), transcript, proof)).toBe(false);
    expect(verifyPreview(owner, id, audio, "forged", proof)).toBe(false);
    vi.unstubAllEnvs();
  });
  it("keeps evidence, privacy and observable choices in the provider instructions", () => {
    for (const mode of ["free_share", "random_question"] as const) {
      const prompt = feedbackInstructions(mode);
      for (const rule of ["untrusted learner data", "Never infer personality", "Shortness alone is not success", "Quote exact learner language", "No numeric scores"]) expect(prompt).toContain(rule);
    }
    expect(feedbackInstructions("free_share")).toContain("ONLY the dedicated concision result");
  });
});
