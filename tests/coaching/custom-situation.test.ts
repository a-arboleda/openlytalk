import { describe, expect, it } from "vitest";

import {
  GUIDED_SITUATION_LIMITS,
  composeGuidedSituationDetail,
  customSituationGuidance,
  guidedSituationForBrief,
  guidedSituationIsComplete,
  guidedSituationPartnerRole,
  guidedSituationSummary,
  parseGuidedSituationDetail,
} from "@/lib/coaching/custom-situation";

const answers = {
  partner: "",
  background: "My manager gave me two urgent projects with the same deadline.",
  goal: "I want my manager to tell me which project should come first.",
  difficulty: "",
};

describe("guided custom situations", () => {
  it("requires only the background and desired outcome", () => {
    expect(guidedSituationIsComplete(answers)).toBe(true);
    expect(
      guidedSituationIsComplete({ ...answers, partner: "" }),
    ).toBe(true);
    expect(guidedSituationIsComplete({ ...answers, goal: "" })).toBe(false);
    expect(guidedSituationIsComplete({ ...answers, background: "" })).toBe(
      false,
    );
  });

  it("composes and parses bounded labeled context", () => {
    const detail = composeGuidedSituationDetail(answers);

    expect(detail.length).toBeLessThanOrEqual(800);
    expect(parseGuidedSituationDetail(detail)).toEqual(answers);
    expect(detail).not.toContain("Speaking with:");
    expect(detail).not.toContain("Expected response or difficulty:");
  });

  it("creates readable fallback copy without inventing a partner role", () => {
    const detail = composeGuidedSituationDetail(answers);

    expect(guidedSituationPartnerRole(detail)).toBeNull();
    expect(guidedSituationSummary(detail)).toBe(answers.background);
    expect(guidedSituationForBrief(detail)).toContain(
      answers.background,
    );
    expect(guidedSituationForBrief(detail)).toContain(
      `Your desired outcome: ${answers.goal}`,
    );
  });

  it("keeps the earlier four-answer format read-compatible", () => {
    const legacyAnswers = {
      partner: "my manager",
      background: "Two urgent projects have the same deadline.",
      goal: "I want to ask which project should come first.",
      difficulty: "My manager may say that both projects are urgent.",
    };
    const detail = composeGuidedSituationDetail(legacyAnswers);

    expect(parseGuidedSituationDetail(detail)).toEqual(legacyAnswers);
    expect(guidedSituationPartnerRole(detail)).toBe("your manager");
    expect(guidedSituationSummary(detail)).toBe(
      "With your manager: Two urgent projects have the same deadline.",
    );
  });

  it("adapts examples to the selected context and main skill", () => {
    const guidance = customSituationGuidance({
      context: "job_interviews",
      primarySkill: "responding_naturally",
    });

    expect(guidance.backgroundPlaceholder).toContain("interviewer");
    expect(guidance.goalPlaceholder).toContain("interviewer");
    expect(guidance.goalPlaceholder).toContain("keep the conversation moving");
    expect(GUIDED_SITUATION_LIMITS.background).toBeGreaterThan(
      GUIDED_SITUATION_LIMITS.partner,
    );

    const personalGuidance = customSituationGuidance({
      context: "everyday_situations",
      primarySkill: "speaking_assertively",
    });
    expect(personalGuidance.backgroundPlaceholder).toContain("My friend");
    expect(personalGuidance.goalPlaceholder).toContain("my friend");
    expect(personalGuidance.goalPlaceholder).not.toBe(
      guidance.goalPlaceholder,
    );
  });
});
