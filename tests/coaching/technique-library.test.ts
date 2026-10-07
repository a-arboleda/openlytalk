import { describe, expect, it } from "vitest";

import {
  COMMUNICATION_SKILL_VALUES,
  targetBehaviorsForSkill,
} from "@/lib/coaching/product-rules";
import {
  compatibleTechniqueFamilies,
  getTechniqueFamily,
  isTechniqueCompatible,
  TECHNIQUE_FAMILIES,
  TECHNIQUE_FAMILY_IDS,
} from "@/lib/coaching/technique-library";

describe("controlled communication technique library", () => {
  it("has one unique definition for every canonical technique id", () => {
    expect(TECHNIQUE_FAMILIES.map((family) => family.id)).toEqual(
      TECHNIQUE_FAMILY_IDS,
    );
    expect(new Set(TECHNIQUE_FAMILY_IDS).size).toBe(
      TECHNIQUE_FAMILY_IDS.length,
    );
  });

  it("keeps every technique concise and evidence-oriented", () => {
    for (const family of TECHNIQUE_FAMILIES) {
      expect(family.stepPattern.length).toBeGreaterThanOrEqual(2);
      expect(family.stepPattern.length).toBeLessThanOrEqual(5);
      expect(family.evidenceDimensions.length).toBeGreaterThan(0);
      expect(family.antiPatterns.length).toBeGreaterThan(0);
      expect(family.exampleConstraints.length).toBeGreaterThan(0);
    }
  });

  it("covers every learner-facing target behavior", () => {
    for (const skill of COMMUNICATION_SKILL_VALUES) {
      for (const behavior of targetBehaviorsForSkill(skill)) {
        expect(
          compatibleTechniqueFamilies({
            primarySkill: skill,
            targetBehavior: behavior.value,
          }).length,
          `${skill}/${behavior.value}`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("does not treat an unrelated technique as compatible", () => {
    expect(
      isTechniqueCompatible({
        familyId: "open_followup_clarify",
        primarySkill: "speaking_assertively",
        targetBehavior: "make_clear_request",
        targetBehaviors: ["make_clear_request"],
      }),
    ).toBe(false);
    expect(
      isTechniqueCompatible({
        familyId: "observation_impact_request",
        primarySkill: "speaking_assertively",
        targetBehavior: "make_clear_request",
        targetBehaviors: ["make_clear_request"],
      }),
    ).toBe(true);
  });

  it("ranks techniques by coverage of the equal behavior set", () => {
    const techniques = compatibleTechniqueFamilies({
      primarySkill: "explaining_clearly",
      targetBehaviors: [
        "describe_problem_and_causes",
        "give_reasons_for_decision_or_opinion",
      ],
    });

    expect(techniques[0]?.id).toBe("main_point_reason_next_step");
    expect(techniques[0]?.applicableBehaviors).toEqual(
      expect.arrayContaining([
        "describe_problem_and_causes",
        "give_reasons_for_decision_or_opinion",
      ]),
    );
  });

  it("retrieves a technique through its stable id", () => {
    expect(getTechniqueFamily("feeling_cause_need").title).toBe(
      "Feeling → Cause → Need or reflection",
    );
  });
});
