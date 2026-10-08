import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { expect, it } from "vitest";
import { generateStoryFeedback } from "@/lib/story-practice/feedback-provider";
import { storyCatalog } from "@/lib/story-practice/catalog";
import { validateFeedback } from "@/lib/story-practice/engine";
import { getDailyPractice } from "@/lib/story-practice/daily";
config({ path: ".env.local", quiet: true });
it.skipIf(process.env.RUN_LIVE_STORY_TESTS !== "1")("generates grounded concision with the configured live provider", async () => {
  const input = { entryMode: "free_share" as const, transcript: "Last week I tried baking bread for the first time. It looked a little strange, but it tasted good. I want to try again next weekend.", learnerMessageId: randomUUID() };
  const result = await generateStoryFeedback(input);
  expect(result.substantiallyEnglish).toBe(true);
  expect(validateFeedback(result.feedback, input).entryMode).toBe("free_share");
}, 120000);

it.skipIf(process.env.RUN_LIVE_STORY_TESTS !== "1")("offers idiomatic activity coordination without changing the evidence", async () => {
  // Synthetic reproduction of the reported language-quality problem.
  const input = {
    entryMode: "random_question" as const,
    transcript: "I'd like to make more room for working out and time with my family. I work out once a week now, and I would like to do it more often. I also want to spend more time with my family. Those are the two things I want to make more time for.",
    learnerMessageId: randomUUID(),
    question: getDailyPractice(new Date("2026-10-08T12:00:00Z")).question,
  };
  const result = await generateStoryFeedback(input);
  const feedback = validateFeedback(result.feedback, input);
  expect(feedback.entryMode).toBe("random_question");
  if (feedback.entryMode !== "random_question") throw new Error("Wrong feedback mode");
  const coaching = [feedback.naturalExample.text, feedback.tryItInRealLife, ...feedback.englishPolish.map(item => item.suggestion)].join(" ");
  expect(coaching).not.toMatch(/\bpractis(?:e|es|ed|ing)\b/i);
  expect(feedback.naturalExample.text).not.toContain("working out and time with my family");
  expect(feedback.naturalExample.text).toMatch(/family/i);
  expect(feedback.naturalExample.text).toMatch(/work(?:ing)? out|exercise|exercising|workouts/i);
  expect(feedback.naturalExample.text).not.toMatch(/because/i);
  expect(feedback.tryItInRealLife).not.toMatch(/_{2,}/);
  // Human review remains necessary: regex checks cannot establish naturalness.
  console.info("Synthetic language-quality sample", { example: feedback.naturalExample.text, realLife: feedback.tryItInRealLife });
}, 120000);

it.skipIf(process.env.RUN_LIVE_STORY_TESTS !== "1").each(["free_share", "random_question"] as const)("validates a short memory in %s", async entryMode => {
  const base = { transcript: "I remember when I was younger, my neighbor used to help me fix my bicycle. We would sit outside, and he would show me how to put the chain back on. It was always very special.", learnerMessageId: randomUUID() };
  const input = entryMode === "free_share" ? { ...base, entryMode } : { ...base, entryMode, question: storyCatalog[0] };
  const result = await generateStoryFeedback(input);
  expect(result.substantiallyEnglish).toBe(true);
  expect(validateFeedback(result.feedback, input).entryMode).toBe(entryMode);
}, 120000);
