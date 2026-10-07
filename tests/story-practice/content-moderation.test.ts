import { describe, expect, it } from "vitest";
import { moderationResultFromCategories, moderateStoryTranscript } from "@/lib/story-practice/content-moderation";

describe("story transcript moderation", () => {
  it("allows ordinary sensitive stories when no blocked category is present", () => {
    expect(moderationResultFromCategories({ violence: false, sexual: false, harassment: false })).toEqual({ allowed: true });
  });

  it.each(["harassment", "hate/threatening", "sexual", "self-harm/intent", "violence/graphic", "illicit/violent"])("blocks %s", category => {
    expect(moderationResultFromCategories({ [category]: true })).toMatchObject({ allowed: false });
  });

  it("blocks direct email and phone details before making a provider request", async () => {
    await expect(moderateStoryTranscript("Call me at +1 (555) 123-4567 or email me@example.com")).resolves.toMatchObject({ allowed: false, reason: "personal_data" });
  });
});
