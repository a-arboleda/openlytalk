import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { expect, it } from "vitest";
import { generateStoryFeedback } from "@/lib/story-practice/feedback-provider";
import { storyCatalog } from "@/lib/story-practice/catalog";
import { validateFeedback } from "@/lib/story-practice/engine";
config({ path: ".env.local", quiet: true });
it.skipIf(process.env.RUN_LIVE_STORY_TESTS !== "1")("generates grounded concision with the configured live provider", async () => {
  const input = { entryMode: "free_share" as const, transcript: "Last week I tried baking bread for the first time. It looked a little strange, but it tasted good. I want to try again next weekend.", learnerMessageId: randomUUID() };
  const result = await generateStoryFeedback(input);
  expect(result.substantiallyEnglish).toBe(true);
  expect(validateFeedback(result.feedback, input).entryMode).toBe("free_share");
}, 120000);

it.skipIf(process.env.RUN_LIVE_STORY_TESTS !== "1").each(["free_share", "random_question"] as const)("validates a short memory in %s", async entryMode => {
  const base = { transcript: "I remember when I was younger, my neighbor used to help me fix my bicycle. We would sit outside, and he would show me how to put the chain back on. It was always very special.", learnerMessageId: randomUUID() };
  const input = entryMode === "free_share" ? { ...base, entryMode } : { ...base, entryMode, question: storyCatalog[0] };
  const result = await generateStoryFeedback(input);
  expect(result.substantiallyEnglish).toBe(true);
  expect(validateFeedback(result.feedback, input).entryMode).toBe(entryMode);
}, 120000);
