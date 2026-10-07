import { z } from "zod";
import data from "./daily-questions.json";
import { questionSchema } from "./contracts";

const catalogSchema = z.object({
  id: z.literal("getting-to-know-yourself"), title: z.string().min(1),
  questions: z.array(questionSchema.extend({ supportPrompt: z.string().min(1).nullable() })).min(1),
}).strict();
export function validateDailyCatalog(input: unknown) {
  const catalog = catalogSchema.parse(input);
  const ids = new Set<string>();
  const wordings = new Set<string>();
  for (const question of catalog.questions) {
    if (ids.has(question.id)) throw new Error("Duplicate question ID.");
    const wording = question.text.trim().toLowerCase();
    if (wordings.has(wording)) throw new Error("Duplicate question wording.");
    if (question.status !== "approved") throw new Error("Daily questions must be approved.");
    ids.add(question.id); wordings.add(wording);
  }
  return catalog;
}
// Server pages and the session engine select one question; never serialize the catalog to the client.
export const dailyCatalog = validateDailyCatalog(data);
export const DAILY_SCHEDULE_START = "2026-10-07T00:00:00.000Z";
export function getDailyPractice(now = new Date()) {
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid schedule date.");
  const elapsed = Math.max(0, Math.floor((now.getTime() - Date.parse(DAILY_SCHEDULE_START)) / 86_400_000));
  const { supportPrompt, ...question } = dailyCatalog.questions[elapsed % dailyCatalog.questions.length];
  return {
    question,
    daily: {
      categoryId: dailyCatalog.id, categoryTitle: dailyCatalog.title,
      date: now.toISOString().slice(0, 10), supportPrompt,
    },
  };
}
export function getTodayCard(now = new Date()) {
  const { daily, question } = getDailyPractice(now);
  return { ...daily, question: question.text };
}
export type TodayCard = ReturnType<typeof getTodayCard>;
