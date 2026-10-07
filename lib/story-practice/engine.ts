import { SESSION_ACCESS_DAYS } from "@/lib/operations/retention-policy";
import { randomUUID } from "node:crypto";
import { getDailyPractice } from "@/lib/story-practice/daily";
import { createStorySchema, storyActionSchema, storyFeedbackSchema, storyStateSchema, type StoryState, type StoryQuestion, type StoryFeedback } from "@/lib/story-practice/contracts";
import type { StoryRepository } from "@/lib/story-practice/repository";

export class StoryError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const unavailable = () => new StoryError(409, "This practice has changed. Refresh it before continuing.");
const stamp = (s: StoryState, now = new Date()) => new Date(Math.max(now.getTime(), Date.parse(s.updatedAt) + 1)).toISOString();
export async function requireStory(repo: StoryRepository, id: string, owner: string) {
  const state = await repo.get(id, owner, new Date().toISOString());
  if (!state) throw new StoryError(404, "This practice has expired or is no longer available.");
  return state;
}
async function save(repo: StoryRepository, before: StoryState, after: StoryState) {
  const next = storyStateSchema.parse({ ...after, updatedAt: stamp(before) });
  if (!await repo.compareAndSwap(before, next, new Date().toISOString())) throw unavailable();
  return next;
}
export async function createStory(repo: StoryRepository, owner: string, input: unknown): Promise<StoryState> {
  const { mode } = createStorySchema.parse(input);
  const now = new Date();
  const today = mode === "daily_question" ? getDailyPractice(now) : null;
  const question = today?.question ?? null;
  const state = storyStateSchema.parse({
    schemaVersion: 7, id: randomUUID(), anonymousSessionId: owner,
    // Keep the existing schema-7 storage/feedback discriminator for retained sessions.
    // Creation accepts daily_question only; no random selection is performed.
    entryMode: mode === "daily_question" ? "random_question" : mode, daily: today?.daily, status: "active", phase: "briefing", responseLimit: 1,
    acceptedResponseCount: 0, expectedLearnerSequence: 0, replacementCount: 0,
    questionReference: question ? { id: question.id, version: question.version } : null,
    privateCoachingMetadata: question, recentQuestionIds: question ? [question.id] : [],
    lastAction: null, learnerMessageId: null, committedKey: null, reservation: null,
    transcript: null, feedback: null, createdAt: now.toISOString(), updatedAt: now.toISOString(),
    // A daily cleanup needs headroom before the public seven-day maximum.
    // Retained sessions keep their original expiry; only new sessions use five days.
    expiresAt: new Date(now.getTime() + SESSION_ACCESS_DAYS * 86400000).toISOString(),
  });
  await repo.create(state);
  return state;
}
export async function actOnStory(repo: StoryRepository, id: string, owner: string, input: unknown) {
  const request = storyActionSchema.parse(input);
  const state = await requireStory(repo, id, owner);
  if (state.lastAction?.key === request.idempotencyKey && state.lastAction.action === request.action) return state;
  if (state.status !== "active" || state.updatedAt !== request.expectedUpdatedAt) throw unavailable();
  const next = { ...state, lastAction: { key: request.idempotencyKey, action: request.action } };
  if (request.action === "end") {
    next.status = "ended";
    next.reservation = null;
  } else {
    if (state.phase !== "briefing" || state.reservation) throw unavailable();
    if (request.action === "start") next.phase = "initial_simulation";
    else {
      throw new StoryError(409, "Question replacement is no longer available.");
    }
  }
  return save(repo, state, next);
}
export function acceptsResponse(s: StoryState) {
  return s.status === "active" && s.phase === "initial_simulation" && s.acceptedResponseCount === 0;
}
export type FeedbackInput = { entryMode: "free_share"; transcript: string; learnerMessageId: string } |
  { entryMode: "random_question"; transcript: string; learnerMessageId: string; question: StoryQuestion };
export type FeedbackProvider = (input: FeedbackInput) => Promise<{ substantiallyEnglish: boolean; safetyStop: boolean; feedback: StoryFeedback | null }>;
export type TranscriptModerator = (transcript: string) => Promise<{ allowed: boolean }>;

function containsEvidence(transcript: string, excerpt: string) {
  const normalize = (value: string) => value.replace(/\s+/g, " ").trim().toLowerCase();
  const source = normalize(transcript);
  const quote = normalize(excerpt);
  if (quote && source.includes(quote)) return true;
  // Models sometimes wrap an otherwise verbatim excerpt in quotation marks.
  // Remove only one balanced presentation pair, never words or punctuation
  // inside the excerpt. Empty quotes must not match every transcript.
  const pairs: Record<string, string> = { '"': '"', "'": "'", "“": "”", "‘": "’", "«": "»" };
  if (quote.length < 3 || pairs[quote[0]] !== quote.at(-1)) return false;
  const unwrapped = quote.slice(1, -1).trim();
  return Boolean(unwrapped) && source.includes(unwrapped);
}

export function validateFeedback(output: unknown, input: FeedbackInput) {
  const parsed = storyFeedbackSchema.safeParse(output);
  if (!parsed.success) throw new Error("Invalid feedback structure.");
  const feedback = parsed.data;
  if (feedback.entryMode !== input.entryMode) throw new Error("Wrong feedback mode.");
  const observations = [feedback.concision.observation, ...(feedback.entryMode === "random_question" ? [feedback.oneImprovement, ...(feedback.whatWorked ? [feedback.whatWorked] : [])] : [])];
  for (const item of observations) {
    if (item.learnerMessageId !== input.learnerMessageId || !containsEvidence(input.transcript, item.quote)) throw new Error("Unsupported evidence.");
  }
  const examples = feedback.entryMode === "random_question" ? [feedback.naturalExample] : feedback.concision.conciseExample ? [feedback.concision.conciseExample] : [];
  if (examples.some(item => item.learnerMessageId !== input.learnerMessageId || /_{2,}|\[(?:insert|add|your|name|place)\b/i.test(item.text))) throw new Error("Unsupported example.");
  if (feedback.entryMode === "random_question" && feedback.englishPolish.some(item => item.learnerMessageId !== input.learnerMessageId || !containsEvidence(input.transcript, item.original))) throw new Error("Unsupported English polish.");
  if (feedback.entryMode === "free_share" && feedback.concision.nextStep === null && feedback.concision.conciseExample !== null) throw new Error("Unnecessary trimming example.");
  return feedback;
}
export async function submitStory(input: {
  repo: StoryRepository; id: string; owner: string; key: string; expectedUpdatedAt: string; expectedLearnerSequence: number;
  prepareTranscript: () => Promise<string>; feedback: FeedbackProvider; moderateTranscript?: TranscriptModerator;
}) {
  const { repo } = input;
  const state = await requireStory(repo, input.id, input.owner);
  if (state.committedKey === input.key && state.status === "completed") return state;
  if (!acceptsResponse(state) || state.expectedLearnerSequence !== input.expectedLearnerSequence || state.updatedAt !== input.expectedUpdatedAt) throw unavailable();
  if (state.reservation && state.reservation.expiresAt > new Date().toISOString()) throw new StoryError(409, "Your response is still being processed. Please wait, then retry.");
  const reserved = await save(repo, state, { ...state, reservation: { key: input.key, token: randomUUID(), expiresAt: new Date(Date.now() + 180000).toISOString() } });
  try {
    const transcript = (await input.prepareTranscript()).replace(/\s+/g, " ").trim();
    if (!transcript || transcript.length > 4000) throw new StoryError(422, "We could not hear a clear response. Please record it again.");
    const moderation = await (input.moderateTranscript?.(transcript) ?? Promise.resolve({ allowed: true }));
    if (!moderation.allowed) throw new StoryError(422, "That response includes content we can’t process. Please record another response.");
    const learnerMessageId = randomUUID();
    const request: FeedbackInput = reserved.entryMode === "free_share"
      ? { entryMode: "free_share", transcript, learnerMessageId }
      : { entryMode: "random_question", transcript, learnerMessageId, question: reserved.privateCoachingMetadata! };
    let output = await input.feedback(request);
    if (output.substantiallyEnglish && !output.safetyStop) {
      try { validateFeedback(output.feedback, request); }
      catch { output = await input.feedback(request); } // One bounded retry for unsupported evidence or invalid output.
    }
    if (output.safetyStop) {
      return await save(repo, reserved, { ...reserved, status: "ended", reservation: null });
    }
    if (!output.substantiallyEnglish) throw new StoryError(422, "Please record your response in English.");
    const feedback = validateFeedback(output.feedback, request);
    return await save(repo, reserved, {
      ...reserved, status: "completed", phase: "final_takeaway", transcript, feedback,
      learnerMessageId, committedKey: input.key, acceptedResponseCount: 1, expectedLearnerSequence: 1, reservation: null,
    });
  } catch (error) {
    const validationFailures = ["Invalid feedback structure.", "Wrong feedback mode.", "Unsupported evidence.", "Unsupported example.", "Unsupported English polish.", "Unnecessary trimming example."];
    console.warn("story_submission_failure", JSON.stringify({ stage: error instanceof Error && validationFailures.includes(error.message) ? error.message : "provider_or_persistence" }));
    // The reservation's timestamp is a fencing token: a stale worker cannot release or commit a newer lease.
    await save(repo, reserved, { ...reserved, reservation: null }).catch(() => undefined);
    throw error;
  }
}
