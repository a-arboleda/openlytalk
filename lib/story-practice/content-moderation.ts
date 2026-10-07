import OpenAI from "openai";
import { parseServerEnv } from "@/lib/env";

export type TranscriptModerationResult = {
  allowed: boolean;
  reason?: "harassment" | "hate" | "sexual" | "self_harm" | "violence" | "illicit" | "personal_data";
};

const blockedCategories = [
  "harassment", "harassment/threatening", "hate", "hate/threatening",
  "sexual", "sexual/minors", "self-harm", "self-harm/intent",
  "self-harm/instructions", "violence", "violence/graphic", "illicit", "illicit/violent",
] as const;

function directPersonalData(text: string): boolean {
  return /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text) || /(?:\+?\d[\s().-]?){7,}\d/.test(text);
}

function categoryReason(category: string): TranscriptModerationResult["reason"] {
  if (category.startsWith("harassment")) return "harassment";
  if (category.startsWith("hate")) return "hate";
  if (category.startsWith("sexual")) return "sexual";
  if (category.startsWith("self-harm")) return "self_harm";
  if (category.startsWith("violence")) return "violence";
  return "illicit";
}

export function moderationResultFromCategories(categories: object): TranscriptModerationResult {
  const values = categories as Record<string, boolean | null | undefined>;
  const category = blockedCategories.find((name) => values[name] === true);
  return category ? { allowed: false, reason: categoryReason(category) } : { allowed: true };
}

export async function moderateStoryTranscript(transcript: string): Promise<TranscriptModerationResult> {
  if (directPersonalData(transcript)) return { allowed: false, reason: "personal_data" };
  const env = parseServerEnv();
  if (!env.OPENAI_API_KEY) throw new Error("Content safety check unavailable.");
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: 15_000, maxRetries: 0 });
  const response = await client.moderations.create({ model: "omni-moderation-latest", input: transcript });
  return moderationResultFromCategories(response.results[0]?.categories ?? {});
}
