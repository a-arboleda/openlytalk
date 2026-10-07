import { z } from "zod";

const text = z.string().trim().min(1).max(4000);
export const entryModeSchema = z.enum(["free_share", "random_question"]);
export const createStorySchema = z.object({ mode: z.enum(["free_share", "daily_question"]) }).strict();
export const storyActionSchema = z.object({
  action: z.enum(["start", "replace", "end"]),
  expectedUpdatedAt: z.iso.datetime(),
  idempotencyKey: z.uuid(),
}).strict();
export const observationSchema = z.object({ text, learnerMessageId: z.uuid(), quote: text }).strict();
export const exampleSchema = z.object({ text, learnerMessageId: z.uuid() }).strict();
export const freeFeedbackSchema = z.object({
  entryMode: z.literal("free_share"), kind: z.enum(["full", "partial"]),
  concision: z.object({ observation: observationSchema, nextStep: text.nullable(), conciseExample: exampleSchema.nullable() }).strict(),
}).strict();
export const randomFeedbackSchema = z.object({
  entryMode: z.literal("random_question"), kind: z.enum(["full", "partial"]),
  whatYouPracticed: text, whatWorked: observationSchema.nullable(), oneImprovement: observationSchema,
  concision: z.object({ observation: observationSchema, nextStep: text.nullable() }).strict(),
  naturalExample: exampleSchema,
  englishPolish: z.array(z.object({ original: text, suggestion: text, explanation: text, learnerMessageId: z.uuid() }).strict()).max(2),
  tryItInRealLife: text,
}).strict();
export const storyFeedbackSchema = z.discriminatedUnion("entryMode", [freeFeedbackSchema, randomFeedbackSchema]);
export type StoryFeedback = z.infer<typeof storyFeedbackSchema>;
export const questionSchema = z.object({
  id: z.string().regex(/^STORY-\d{3}$/), version: z.number().int().positive(), text: z.string().min(1).max(200),
  status: z.enum(["draft", "wording_approved", "approved", "retired"]),
  coachingLens: z.enum(["explaining_clearly", "responding_naturally", "expressing_yourself", "speaking_assertively"]),
  techniqueId: z.enum(["scene_event_response", "expectation_change_outcome", "first_attempt_outcome", "choice_reason_outcome", "lesson_origin_application", "view_change_reason"]),
  responseGuide: z.object({ steps: z.array(text).min(2).max(3), example: text }).strict(),
  feedbackGuidance: z.object({ observe: z.array(text).min(1), avoid: z.array(text).min(1) }).strict(),
}).strict();
export type StoryQuestion = z.infer<typeof questionSchema>;
const retainedWeeklyContextSchema = z.object({
  themeId: z.string().min(1), themeTitle: text, day: z.number().int().min(1).max(7),
  date: z.iso.date(), supportPrompt: text.nullable(),
}).strict();
export const dailyContextSchema = z.union([
  retainedWeeklyContextSchema,
  z.object({ categoryId: z.literal("getting-to-know-yourself"), categoryTitle: text,
    date: z.iso.date(), supportPrompt: text.nullable() }).strict(),
]);
export const publicStorySchema = z.object({
  schemaVersion: z.literal(7), id: z.uuid(), entryMode: entryModeSchema,
  daily: dailyContextSchema.optional(),
  status: z.enum(["active", "completed", "ended"]),
  phase: z.enum(["briefing", "initial_simulation", "finalizing", "final_takeaway"]),
  responseLimit: z.literal(1), acceptedResponseCount: z.number().int().min(0).max(1),
  expectedLearnerSequence: z.number().int().min(0).max(1), replacementCount: z.number().int().min(0).max(2),
  question: z.object({ id: z.string(), version: z.number().int(), text, responseGuide: questionSchema.shape.responseGuide }).strict().nullable(),
  transcript: text.nullable(), feedback: storyFeedbackSchema.nullable(),
  updatedAt: z.iso.datetime(), expiresAt: z.iso.datetime(),
}).strict();
export type PublicStory = z.infer<typeof publicStorySchema>;
export const publicStoryResponseSchema = z.object({ session: publicStorySchema }).strict();
export const storyStateSchema = publicStorySchema.omit({ question: true }).extend({
  anonymousSessionId: z.uuid(), createdAt: z.iso.datetime(),
  questionReference: z.object({ id: z.string(), version: z.number().int().positive() }).strict().nullable(),
  privateCoachingMetadata: questionSchema.nullable(), recentQuestionIds: z.array(z.string()).max(8),
  lastAction: z.object({ key: z.uuid(), action: storyActionSchema.shape.action }).strict().nullable(),
  learnerMessageId: z.uuid().nullable(), committedKey: z.uuid().nullable(),
  reservation: z.object({ key: z.uuid(), token: z.uuid(), expiresAt: z.iso.datetime() }).strict().nullable(),
}).strict().superRefine((s, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: "custom", message });
  if (s.daily && (s.entryMode !== "random_question" || s.replacementCount !== 0)) fail("Invalid daily practice.");
  if (s.entryMode === "free_share" && (s.questionReference || s.privateCoachingMetadata || s.replacementCount)) fail("Free sharing has no question metadata.");
  if (s.entryMode === "random_question" && (!s.questionReference || !s.privateCoachingMetadata || s.questionReference.id !== s.privateCoachingMetadata.id || s.questionReference.version !== s.privateCoachingMetadata.version)) fail("An exact reviewed question is required.");
  if (s.acceptedResponseCount !== s.expectedLearnerSequence) fail("Invalid response sequence.");
  if (s.status === "completed" && (!s.feedback || !s.transcript || !s.learnerMessageId || !s.committedKey || s.acceptedResponseCount !== 1 || s.phase !== "final_takeaway")) fail("Incomplete result.");
  if (s.status !== "completed" && (s.feedback || s.transcript || s.learnerMessageId || s.committedKey || s.acceptedResponseCount)) fail("Uncommitted response.");
  if (s.feedback && s.feedback.entryMode !== s.entryMode) fail("Wrong feedback mode.");
  if (s.reservation && (s.status !== "active" || s.phase !== "initial_simulation")) fail("Invalid reservation.");
  if (Date.parse(s.expiresAt) - Date.parse(s.createdAt) > 7 * 86400000 || s.expiresAt <= s.createdAt) fail("Invalid retention window.");
});
export type StoryState = z.infer<typeof storyStateSchema>;
export function publicStory(s: StoryState): PublicStory {
  const q = s.privateCoachingMetadata;
  return publicStorySchema.parse({
    schemaVersion: 7, id: s.id, entryMode: s.entryMode, daily: s.daily, status: s.status, phase: s.phase,
    responseLimit: 1, acceptedResponseCount: s.acceptedResponseCount,
    expectedLearnerSequence: s.expectedLearnerSequence, replacementCount: s.replacementCount,
    question: q ? { id: q.id, version: q.version, text: q.text, responseGuide: q.responseGuide } : null,
    transcript: s.transcript, feedback: s.feedback, updatedAt: s.updatedAt, expiresAt: s.expiresAt,
  });
}
