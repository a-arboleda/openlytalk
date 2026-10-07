import { describe, expect, it } from "vitest";

import { buildQuickPracticeSetup } from "@/lib/coaching/quick-practice";
import { quickPracticeSelectionSchema } from "@/lib/coaching/schemas";

describe("quick practice setup", () => {
  it.each([
    ["everyday_life", "personal_life", "everyday_situations"],
    ["understanding_myself", "personal_life", "personal_decisions"],
  ] as const)(
    "maps %s to its bounded learner context",
    (topic, practiceArea, context) => {
      const setup = buildQuickPracticeSetup({
        selection: {
          primarySkill: "expressing_yourself",
          topic,
        },
        variationSeed: "stable-seed",
      });

      expect(setup).toMatchObject({
        primarySkill: "expressing_yourself",
        supportingSkill: null,
        practiceArea,
        context,
        situationMode: "choose_for_me",
        situationDetail: null,
      });
      expect(setup.targetBehaviors).toHaveLength(1);
    },
  );

  it("keeps work prompts inside the controlled work contexts", () => {
    const setup = buildQuickPracticeSetup({
      selection: {
        primarySkill: "responding_naturally",
        topic: "work",
      },
      variationSeed: "different-seed",
    });

    expect(setup.practiceArea).toBe("work");
    expect([
      "coworkers_teamwork",
      "managers_feedback",
      "customers_clients",
      "job_interviews",
    ]).toContain(setup.context);
  });

  it("rejects What matters to me for skills that do not fit it", () => {
    expect(
      quickPracticeSelectionSchema.safeParse({
        primarySkill: "speaking_assertively",
        topic: "understanding_myself",
      }).success,
    ).toBe(false);
    expect(
      quickPracticeSelectionSchema.safeParse({
        primarySkill: "expressing_yourself",
        topic: "understanding_myself",
      }).success,
    ).toBe(true);
  });

  it("rejects Work for Expressing what I think and feel", () => {
    expect(
      quickPracticeSelectionSchema.safeParse({
        primarySkill: "expressing_yourself",
        topic: "work",
      }).success,
    ).toBe(false);
    expect(
      quickPracticeSelectionSchema.safeParse({
        primarySkill: "expressing_yourself",
        topic: "everyday_life",
      }).success,
    ).toBe(true);
  });
});
