import { describe, expect, it } from "vitest";

import {
  parseDescribedSituationDraft,
  parsePracticeSetupDraft,
  serializeDescribedSituationDraft,
  serializePracticeSetupDraft,
} from "@/lib/coaching/setup-draft";

const SAVED_AT = Date.UTC(2026, 7, 9, 12);
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1_000;

const setup = {
  primarySkill: "speaking_assertively",
  supportingSkill: null,
  practiceArea: "work",
  context: "managers_feedback",
  targetBehavior: "raise_problem_without_blaming",
  targetBehaviors: ["raise_problem_without_blaming"],
  desiredImpression: "direct_respectful",
  situationMode: "choose_for_me",
  situationDetail: null,
} as const;

describe("practice setup draft", () => {
  it("round-trips the two homepage answers within the retention window", () => {
    const answers = {
      background: "My coworker and I need to discuss a missed handoff.",
      goal: "I want us to agree on what happens next.",
    };
    const serialized = serializeDescribedSituationDraft(answers, SAVED_AT);

    expect(
      parseDescribedSituationDraft(serialized, SAVED_AT + SEVEN_DAYS),
    ).toEqual(answers);
    expect(
      parseDescribedSituationDraft(serialized, SAVED_AT + SEVEN_DAYS + 1),
    ).toBeNull();
  });

  it("round-trips an active setup within the retention window", () => {
    const serialized = serializePracticeSetupDraft(setup, SAVED_AT);

    expect(parsePracticeSetupDraft(serialized, SAVED_AT + SEVEN_DAYS)).toEqual(
      setup,
    );
  });

  it("rejects invalid or malformed drafts", () => {
    expect(parsePracticeSetupDraft("not-json", SAVED_AT)).toBeNull();
    expect(
      parsePracticeSetupDraft(JSON.stringify({ savedAt: SAVED_AT }), SAVED_AT),
    ).toBeNull();
  });

  it("rejects expired and future-dated drafts", () => {
    const serialized = serializePracticeSetupDraft(setup, SAVED_AT);

    expect(
      parsePracticeSetupDraft(serialized, SAVED_AT + SEVEN_DAYS + 1),
    ).toBeNull();
    expect(parsePracticeSetupDraft(serialized, SAVED_AT - 1)).toBeNull();
  });

  it("rejects retired setup choices for a new practice", () => {
    const legacyDraft = JSON.stringify({
      savedAt: SAVED_AT,
      setup: {
        ...setup,
        primarySkill: "asking_better_questions",
        supportingSkill: null,
        targetBehavior: "ask_open_follow_up",
        targetBehaviors: ["ask_open_follow_up"],
      },
    });

    expect(parsePracticeSetupDraft(legacyDraft, SAVED_AT)).toBeNull();
  });
});
