import { describe, expect, it } from "vitest";

import {
  COACHING_BETA_RULES,
  COMMUNICATION_SKILLS,
  COMMUNICATION_SKILL_VALUES,
  DESIRED_IMPRESSIONS,
  isTargetBehaviorForSkill,
  PRACTICE_AREAS,
  PRACTICE_CONTEXTS,
  PRACTICE_TOPICS,
  practiceTopicsForSkill,
  practiceContextsForArea,
  TARGET_BEHAVIORS,
  TARGET_BEHAVIOR_VALUES,
  targetBehaviorsForSkill,
} from "@/lib/coaching/product-rules";

describe("coaching product rules", () => {
  it("keeps one skill choice and the confirmed two-level contexts", () => {
    expect(COMMUNICATION_SKILLS.map((option) => option.label)).toEqual([
      "Explaining something clearly",
      "Responding naturally",
      "Expressing what I think and feel",
      "Speaking up for myself",
    ]);
    expect(PRACTICE_TOPICS.map((option) => option.label)).toEqual([
      "Everyday life",
      "Work",
      "What matters to me",
    ]);
    expect(PRACTICE_AREAS.map((option) => option.label)).toEqual([
      "Work",
      "Personal life",
    ]);
    expect(
      practiceContextsForArea("work").map((option) => option.label),
    ).toEqual([
      "Coworkers and teamwork",
      "Managers and feedback",
      "Customers and clients",
      "Job interviews",
    ]);
    expect(
      practiceContextsForArea("personal_life").map((option) => option.label),
    ).toEqual([
      "Everyday situations",
      "Personal decisions",
    ]);
    expect(PRACTICE_CONTEXTS).toHaveLength(6);
  });

  it("keeps the six optional desired impressions", () => {
    expect(DESIRED_IMPRESSIONS.map((option) => option.label)).toEqual([
      "Calm and confident",
      "Warm and approachable",
      "Natural and relaxed",
      "Direct but respectful",
      "Thoughtful and composed",
      "Professional and prepared",
    ]);
  });

  it("shows only topics that fit the selected communication skill", () => {
    expect(
      practiceTopicsForSkill("expressing_yourself").map(
        (option) => option.value,
      ),
    ).toEqual(["everyday_life", "understanding_myself"]);

    for (const skill of [
      "explaining_clearly",
      "responding_naturally",
      "speaking_assertively",
    ] as const) {
      expect(
        practiceTopicsForSkill(skill).map((option) => option.value),
      ).toEqual(["everyday_life", "work"]);
    }
  });

  it("gives every active skill a focused set of distinct target behaviors", () => {
    const allValues = COMMUNICATION_SKILL_VALUES.flatMap((skill) => {
      const options = targetBehaviorsForSkill(skill);
      expect(options.length).toBeGreaterThanOrEqual(4);
      expect(new Set(options.map((option) => option.value)).size).toBe(
        options.length,
      );
      return options.map((option) => option.value);
    });

    expect(new Set(allValues).size).toBe(allValues.length);
    for (const value of allValues) {
      expect(TARGET_BEHAVIOR_VALUES).toContain(value);
    }
  });

  it("validates a behavior only against its main skill", () => {
    expect(
      isTargetBehaviorForSkill(
        "responding_naturally",
        "ask_natural_follow_up",
      ),
    ).toBe(true);
    expect(
      isTargetBehaviorForSkill(
        "explaining_clearly",
        "ask_natural_follow_up",
      ),
    ).toBe(false);

    for (const skill of COMMUNICATION_SKILL_VALUES) {
      for (const option of TARGET_BEHAVIORS[skill]) {
        expect(isTargetBehaviorForSkill(skill, option.value)).toBe(true);
      }
    }
  });

  it("keeps retired values valid without showing retired skill cards", () => {
    const activeValues: readonly string[] = COMMUNICATION_SKILLS.map(
      (option) => option.value,
    );
    expect(activeValues).not.toContain("asking_better_questions");
    expect(activeValues).not.toContain("handling_difficult_conversation");
    expect(
      isTargetBehaviorForSkill(
        "asking_better_questions",
        "ask_useful_follow_up",
      ),
    ).toBe(true);
    expect(
      isTargetBehaviorForSkill(
        "handling_difficult_conversation",
        "apologize_or_repair",
      ),
    ).toBe(true);
    expect(
      isTargetBehaviorForSkill(
        "speaking_assertively",
        "state_opinion_confidently",
      ),
    ).toBe(true);
  });

  it("encodes the confirmed beta boundaries separately from legacy rules", () => {
    expect(COACHING_BETA_RULES).toMatchObject({
      captionsDefaultOn: false,
      language: "English",
      learnerLevel: "B1-B2",
      currentPracticeResponseLimit: 1,
      previousTwoResponsePracticeLimit: 2,
      previousContinuousPracticeResponseLimit: 3,
      maxAcceptedResponses: 5,
      maxRecordingSeconds: 60,
      persistAudio: false,
      retentionDays: 7,
      textResponseFallback: false,
    });
  });
});
