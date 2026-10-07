import { describe, expect, it } from "vitest";

import {
  COMMUNICATION_SKILL_VALUES,
  DESIRED_IMPRESSION_VALUES,
  PRACTICE_CONTEXT_VALUES,
  targetBehaviorsForSkill,
} from "@/lib/coaching/product-rules";
import {
  buildDeterministicPracticePlan,
  deterministicTechniqueFor,
} from "@/lib/coaching/plan-builder";
import { composeGuidedSituationDetail } from "@/lib/coaching/custom-situation";
import {
  isTechniqueCompatible,
  TECHNIQUE_FAMILY_IDS,
} from "@/lib/coaching/technique-library";
import { practicePlanSchema } from "@/lib/coaching/schemas";

describe("deterministic practice-plan builder", () => {
  it("builds a valid compatible plan for every skill, behavior, and context", () => {
    for (const primarySkill of COMMUNICATION_SKILL_VALUES) {
      for (const targetBehavior of targetBehaviorsForSkill(primarySkill)) {
        for (const context of PRACTICE_CONTEXT_VALUES) {
          const plan = buildDeterministicPracticePlan({
            primarySkill,
            context,
            targetBehavior: targetBehavior.value,
            situationMode: "choose_for_me",
          });

          expect(
            practicePlanSchema.safeParse(plan).success,
            `${primarySkill}/${targetBehavior.value}/${context}`,
          ).toBe(true);
          expect(
            isTechniqueCompatible({
              familyId: plan.technique.familyId,
              primarySkill,
              targetBehavior: targetBehavior.value,
            }),
          ).toBe(true);
          expect(plan.challenge.kind).toBeTruthy();
          expect(plan.partner.prohibitedBehavior.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("uses every mapped technique from the controlled library only", () => {
    for (const primarySkill of COMMUNICATION_SKILL_VALUES) {
      for (const targetBehavior of targetBehaviorsForSkill(primarySkill)) {
        expect(TECHNIQUE_FAMILY_IDS).toContain(
          deterministicTechniqueFor(targetBehavior.value),
        );
      }
    }
  });

  it("uses broad relatable single prompts with skill-appropriate endings", () => {
    const combinations = [
      ["explaining_clearly", "everyday_situations", 1],
      ["explaining_clearly", "work", 1],
      ["responding_naturally", "everyday_situations", 0],
      ["responding_naturally", "work", 0],
      ["expressing_yourself", "everyday_situations", 1],
      ["expressing_yourself", "personal_decisions", 1],
      ["speaking_assertively", "everyday_situations", 0],
      ["speaking_assertively", "work", 0],
    ] as const;

    for (const [primarySkill, context, expectedQuestionCount] of combinations) {
      const targetBehavior = targetBehaviorsForSkill(primarySkill)[0].value;
      const plan = buildDeterministicPracticePlan(
        {
          primarySkill,
          context,
          targetBehavior,
          targetBehaviors: [targetBehavior],
          situationMode: "choose_for_me",
        },
        { singlePrompt: true, variationSeed: `relatable-${primarySkill}` },
      );
      const opening = plan.opening.partnerOpeningText ?? "";

      expect(opening.match(/\?/g)?.length ?? 0).toBe(expectedQuestionCount);
      expect(opening).not.toMatch(/^Imagine\b/i);
      expect(opening.split(/\s+/).length).toBeGreaterThanOrEqual(8);
    }
  });

  it("is stable when the validated setup is unchanged", () => {
    const setup = {
      primarySkill: "speaking_assertively",
      supportingSkill: "explaining_clearly",
      context: "work",
      targetBehavior: "make_clear_request",
      targetBehaviors: ["make_clear_request"],
      desiredImpression: "direct_respectful",
      situationMode: "choose_for_me",
    };

    expect(buildDeterministicPracticePlan(setup)).toEqual(
      buildDeterministicPracticePlan(setup),
    );
  });

  it("builds one coherent plan from multiple equal behavior choices", () => {
    const plan = buildDeterministicPracticePlan({
      primarySkill: "explaining_clearly",
      context: "work",
      targetBehaviors: [
        "give_reasons_for_decision_or_opinion",
        "describe_problem_and_causes",
      ],
      situationMode: "choose_for_me",
    });

    expect(plan.setup.targetBehaviors).toEqual([
      "describe_problem_and_causes",
      "give_reasons_for_decision_or_opinion",
    ]);
    expect(plan.technique.familyId).toBe("main_point_reason_next_step");
    expect(plan.sessionGoal).toContain("describe a problem and its causes");
    expect(plan.sessionGoal).toContain(
      "give clear reasons for a decision or opinion",
    );
  });

  it("rotates away from a recently used generated situation", () => {
    const setup = {
      primarySkill: "expressing_yourself",
      context: "everyday_situations",
      targetBehavior: "share_experience_and_meaning",
      targetBehaviors: ["share_experience_and_meaning"],
      situationMode: "choose_for_me",
    } as const;
    const first = buildDeterministicPracticePlan(setup, {
      variationSeed: "first-session",
    });
    const next = buildDeterministicPracticePlan(setup, {
      variationSeed: "first-session",
      avoidSituations: [first.situation],
    });

    expect(next.situation).not.toBe(first.situation);
  });

  it("uses the learner's situation without inventing a specific relationship", () => {
    const situation =
      "I need to discuss a recurring schedule problem with someone at work.";
    const plan = buildDeterministicPracticePlan({
      primarySkill: "speaking_assertively",
      supportingSkill: "responding_naturally",
      context: "work",
      targetBehavior: "raise_problem_without_blaming",
      targetBehaviors: ["raise_problem_without_blaming"],
      desiredImpression: "calm_confident",
      situationMode: "learner_provided",
      situationDetail: situation,
    });

    expect(plan.setup.situationDetail).toBe(situation);
    expect(plan.opening.learnerCue).toContain(situation);
    expect(plan.partner.relationshipToLearner).toContain(
      "No additional relationship is assumed",
    );
    expect(plan.technique.example).toContain(situation);
  });

  it("uses guided situation answers in the deterministic fallback", () => {
    const situationDetail = composeGuidedSituationDetail({
      partner: "my manager",
      background: "Two urgent projects have the same deadline.",
      goal: "I want to ask which project should come first.",
      difficulty: "My manager may say both projects are urgent.",
    });
    const plan = buildDeterministicPracticePlan({
      primarySkill: "speaking_assertively",
      context: "work",
      targetBehavior: "make_clear_request",
      targetBehaviors: ["make_clear_request"],
      situationMode: "learner_provided",
      situationDetail,
    });

    expect(plan.partner.roleLabel).toBe("your manager");
    expect(plan.situation).toContain("conversation with your manager");
    expect(plan.situation).toContain("Two urgent projects");
    expect(plan.situation).toContain("Your desired outcome:");
    expect(plan.partner.knownFacts).toContain(
      "The learner wants this outcome: I want to ask which project should come first.",
    );
  });

  it("adds one secondary observation and impression cues only when selected", () => {
    const plan = buildDeterministicPracticePlan({
      primarySkill: "responding_naturally",
      supportingSkill: "expressing_yourself",
      context: "personal_decisions",
      targetBehavior: "ask_natural_follow_up",
      targetBehaviors: ["ask_natural_follow_up"],
      desiredImpression: "warm_approachable",
      situationMode: "choose_for_me",
    });

    expect(plan.evidenceRubric.supportingDimension).not.toBeNull();
    expect(plan.evidenceRubric.primaryDimensions).not.toContain(
      plan.evidenceRubric.supportingDimension,
    );
    expect(plan.evidenceRubric.desiredImpressionCues).toHaveLength(2);
  });

  it("omits optional evidence when the learner does not select it", () => {
    const plan = buildDeterministicPracticePlan({
      primarySkill: "explaining_clearly",
      context: "everyday_situations",
      targetBehavior: "explain_how_it_works",
      targetBehaviors: ["explain_how_it_works"],
      situationMode: "choose_for_me",
    });

    expect(plan.evidenceRubric.supportingDimension).toBeNull();
    expect(plan.evidenceRubric.desiredImpressionCues).toEqual([]);
  });

  it("always gives the learner a natural partner opening", () => {
    const interviewPlan = buildDeterministicPracticePlan({
      primarySkill: "explaining_clearly",
      context: "job_interviews",
      targetBehavior: "tell_in_logical_order",
      targetBehaviors: ["tell_in_logical_order"],
      situationMode: "choose_for_me",
    });
    const requestPlan = buildDeterministicPracticePlan({
      primarySkill: "speaking_assertively",
      context: "work",
      targetBehavior: "make_clear_request",
      targetBehaviors: ["make_clear_request"],
      situationMode: "choose_for_me",
    });

    expect(interviewPlan.opening.speaker).toBe("partner");
    expect(interviewPlan.opening.partnerOpeningText).not.toBeNull();
    expect(requestPlan.opening.speaker).toBe("partner");
    expect(requestPlan.opening.partnerOpeningText).not.toBeNull();
    expect(requestPlan.opening.partnerOpeningText).toContain("?");
  });

  it("varies What matters to me across concrete, deeper moments", () => {
    const openings = Array.from({ length: 12 }, (_, index) => {
      const variationSeed = String.fromCharCode(65 + index);
      const plan = buildDeterministicPracticePlan(
        {
          primarySkill: "expressing_yourself",
          context: "personal_decisions",
          targetBehavior: "share_opinion_and_reason",
          targetBehaviors: ["share_opinion_and_reason"],
          situationMode: "choose_for_me",
        },
        { singlePrompt: true, variationSeed },
      );
      const opening = plan.opening.partnerOpeningText ?? "";

      expect(opening).toMatch(/[.!]\s+.+\?$/);
      expect(opening).not.toMatch(/^\s*(?:think|imagine|describe|explain)\b/i);
      expect(opening).not.toContain("What comes to mind when you hear that?");
      expect(opening.match(/\?/g)).toHaveLength(1);
      if (/\b(?:I|my|me)\b/i.test(opening)) {
        expect(plan.partner.knownFacts).toContain(
          "The temporary practice partner owns the first-person experience and reaction stated in the opening; those facts exist only for this prompt.",
        );
      }
      return opening;
    });
    const combined = openings.join(" ").toLowerCase();

    expect(new Set(openings).size).toBe(12);
    expect(combined).toContain("personality");
    expect(combined).toContain("free time");
    expect(combined).toContain("family");
    expect(combined).toContain("success");
    expect(combined).toContain("boundary");
    expect(combined).toContain("calendar");
    expect(combined).toContain("family tradition");
    expect(combined).toContain("personal growth");
  });

  it("supports every desired impression without changing the main technique", () => {
    const techniques = DESIRED_IMPRESSION_VALUES.map((desiredImpression) =>
      buildDeterministicPracticePlan({
        primarySkill: "expressing_yourself",
        context: "personal_decisions",
        targetBehavior: "share_opinion_and_reason",
        targetBehaviors: ["share_opinion_and_reason"],
        desiredImpression,
        situationMode: "choose_for_me",
      }).technique.familyId,
    );

    expect(new Set(techniques)).toEqual(
      new Set(["opinion_reason_example"]),
    );
  });
});
