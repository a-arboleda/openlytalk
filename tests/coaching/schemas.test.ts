import { describe, expect, it } from "vitest";

import {
  coachingBreakSchema,
  finalSessionTakeawaySchema,
  practicePlanSchema,
  practiceSessionStateSchema,
  practiceSetupSchema,
  type PracticePlan,
  type PracticeSetup,
} from "@/lib/coaching/schemas";

const customSetup: PracticeSetup = practiceSetupSchema.parse({
  primarySkill: "speaking_assertively",
  supportingSkill: "explaining_clearly",
  context: "work",
  targetBehavior: "make_clear_request",
  targetBehaviors: ["make_clear_request"],
  desiredImpression: "direct_respectful",
  situationMode: "learner_provided",
  situationDetail: "I need to ask my manager to clarify my priorities.",
});

function validPlan(setup: PracticeSetup = customSetup): PracticePlan {
  return practicePlanSchema.parse({
    schemaVersion: 1,
    setup,
    situation:
      "The learner asks a manager to clarify priorities for several urgent tasks.",
    sessionGoal:
      "Make a clear request for priorities while remaining direct and respectful.",
    partner: {
      roleLabel: "Your manager",
      relationshipToLearner: "The learner reports to this manager.",
      immediateGoal: "Understand what clarification the learner needs.",
      knownFacts: ["Several tasks currently appear urgent."],
      unknownFacts: ["Which task the learner believes should come first."],
      baselineTone: "Busy but willing to listen.",
      prohibitedBehavior: [
        "Do not humiliate the learner or refuse every reasonable request.",
      ],
    },
    opening: {
      speaker: "learner",
      learnerCue: "Ask your manager to clarify which task should come first.",
      partnerOpeningText: null,
      rationale: "The learner is raising the request.",
    },
    technique: {
      familyId: "main_point_reason_next_step",
      title: "Main point → Reason → Next step",
      whyItFits:
        "It helps the learner make the request before adding background.",
      steps: [
        "State the request",
        "Give the reason",
        "Suggest the next step",
      ],
      example:
        "Could you clarify which task should come first? I have three urgent deadlines, and I want to focus on the right one.",
    },
    challenge: {
      kind: "mild_resistance",
      triggerCondition: "The learner makes a clear initial request.",
      behavior: "Ask why the learner cannot decide independently.",
      repairCondition:
        "The learner explains the competing priorities or restates the request.",
    },
    evidenceRubric: {
      primaryDimensions: ["direct_request", "main_point_clarity"],
      supportingDimension: "relevant_context",
      desiredImpressionCues: [
        "The request appears before the background.",
        "The wording remains neutral.",
      ],
    },
    retryCriteria: [
      "The learner states the request in the first sentence.",
      "The learner gives one concise reason.",
    ],
    safetyConstraints: ["Keep disagreement low stakes and professional."],
    prohibitedAssumptions: [
      "Do not invent the learner's job title or workplace history.",
    ],
  });
}

function coachingBreak() {
  return coachingBreakSchema.parse({
    whatWorked: {
      title: "You explained why the decision matters",
      observation:
        "You connected the competing deadlines to the need for clarification.",
      evidenceMessageIds: ["learner-1"],
    },
    oneImprovement: {
      title: "Make the request earlier",
      observation:
        "Your manager had to wait for the main request until the end.",
      evidenceMessageIds: ["learner-3"],
    },
    tryItThisWay: {
      originalMeaning: "You need your manager to choose the priority.",
      naturalExample:
        "Could you clarify which task should come first? I have three urgent deadlines.",
    },
    retryGoal: "State the request in the first sentence.",
    retryPrompt: "Ask your manager to clarify the priority again.",
    retryTargetMessageIds: ["learner-3"],
  });
}

describe("practice setup schema", () => {
  it("normalizes optional fields for choose-for-me setup", () => {
    expect(
      practiceSetupSchema.parse({
        primarySkill: "responding_naturally",
        context: "everyday_situations",
        targetBehavior: "ask_natural_follow_up",
        targetBehaviors: ["ask_natural_follow_up"],
        situationMode: "choose_for_me",
      }),
    ).toMatchObject({
      supportingSkill: null,
      desiredImpression: null,
      situationDetail: null,
    });
  });

  it("accepts multiple equal behaviors and canonicalizes click order", () => {
    const first = practiceSetupSchema.parse({
      primarySkill: "explaining_clearly",
      context: "work",
      targetBehaviors: [
        "give_reasons_for_decision_or_opinion",
        "describe_problem_and_causes",
      ],
      situationMode: "choose_for_me",
    });
    const reversed = practiceSetupSchema.parse({
      primarySkill: "explaining_clearly",
      context: "work",
      targetBehaviors: [...first.targetBehaviors].reverse(),
      situationMode: "choose_for_me",
    });

    expect(first.targetBehaviors).toEqual([
      "describe_problem_and_causes",
      "give_reasons_for_decision_or_opinion",
    ]);
    expect(reversed.targetBehaviors).toEqual(first.targetBehaviors);
  });

  it("requires at least one unique selected behavior", () => {
    expect(
      practiceSetupSchema.safeParse({
        primarySkill: "explaining_clearly",
        context: "work",
        targetBehaviors: [],
        situationMode: "choose_for_me",
      }).success,
    ).toBe(false);
    expect(
      practiceSetupSchema.safeParse({
        primarySkill: "explaining_clearly",
        context: "work",
        targetBehaviors: [
          "describe_problem_and_causes",
          "describe_problem_and_causes",
        ],
        situationMode: "choose_for_me",
      }).success,
    ).toBe(false);
  });

  it("keeps retained legacy setups readable during anonymous retention", () => {
    expect(
      practiceSetupSchema.safeParse({
        primarySkill: "asking_better_questions",
        context: "everyday_situations",
        targetBehavior: "ask_useful_follow_up",
        targetBehaviors: ["ask_useful_follow_up"],
        situationMode: "choose_for_me",
      }).success,
    ).toBe(true);
    expect(
      practiceSetupSchema.safeParse({
        primarySkill: "handling_difficult_conversation",
        context: "family_relationships",
        targetBehavior: "apologize_or_repair",
        targetBehaviors: ["apologize_or_repair"],
        situationMode: "choose_for_me",
      }).success,
    ).toBe(true);
  });

  it("rejects the same primary and supporting skill", () => {
    expect(
      practiceSetupSchema.safeParse({
        ...customSetup,
        supportingSkill: customSetup.primarySkill,
      }).success,
    ).toBe(false);
  });

  it("rejects a behavior from another main skill", () => {
    expect(
      practiceSetupSchema.safeParse({
        ...customSetup,
        targetBehavior: "ask_useful_follow_up",
        targetBehaviors: ["ask_useful_follow_up"],
      }).success,
    ).toBe(false);
  });

  it("requires custom text only for learner-provided situations", () => {
    expect(
      practiceSetupSchema.safeParse({
        ...customSetup,
        situationDetail: null,
      }).success,
    ).toBe(false);
    expect(
      practiceSetupSchema.safeParse({
        ...customSetup,
        situationMode: "choose_for_me",
      }).success,
    ).toBe(false);
  });
});

describe("practice plan schema", () => {
  it("accepts a compatible adaptive plan", () => {
    expect(validPlan().technique.familyId).toBe(
      "main_point_reason_next_step",
    );
  });

  it("rejects a technique unrelated to the main skill and behavior", () => {
    const plan = validPlan();
    expect(
      practicePlanSchema.safeParse({
        ...plan,
        technique: {
          ...plan.technique,
          familyId: "open_followup_clarify",
        },
      }).success,
    ).toBe(false);
  });

  it("requires an opening message exactly when the partner starts", () => {
    const plan = validPlan();
    expect(
      practicePlanSchema.safeParse({
        ...plan,
        opening: {
          ...plan.opening,
          speaker: "partner",
          partnerOpeningText: null,
        },
      }).success,
    ).toBe(false);
  });
});

describe("coaching and takeaway schemas", () => {
  it("allows one evidence-based coaching focus without mandatory praise", () => {
    expect(
      coachingBreakSchema.parse({
        ...coachingBreak(),
        whatWorked: null,
      }).whatWorked,
    ).toBeNull();
  });

  it("requires retry comparison only for a full takeaway", () => {
    const base = {
      whatYouPracticed:
        "You practiced making a direct and respectful request.",
      whatChanged: {
        initialObservation: "The request appeared after the background.",
        retryObservation: "The retry began with the request.",
        evidenceMessageIds: ["learner-3", "learner-4"],
      },
      strongestMoment: {
        title: "Clear next step",
        observation: "You asked your manager to choose the priority.",
        evidenceMessageIds: ["learner-4"],
      },
      keepUsingTechnique: {
        title: "Main point → Reason → Next step",
        reminder: "Lead with the request before the explanation.",
        personalizedExample:
          "Could you clarify which task should come first?",
      },
      englishPolish: [],
      tryItInRealLife:
        "Use the same structure the next time priorities compete.",
      optionalRetell: null,
    };

    expect(
      finalSessionTakeawaySchema.safeParse({ kind: "full", ...base })
        .success,
    ).toBe(true);
    expect(
      finalSessionTakeawaySchema.safeParse({
        kind: "partial",
        ...base,
      }).success,
    ).toBe(false);
    expect(
      finalSessionTakeawaySchema.safeParse({
        kind: "partial",
        ...base,
        whatChanged: {
          ...base.whatChanged,
          retryObservation: null,
          evidenceMessageIds: ["learner-1"],
        },
      }).success,
    ).toBe(true);
  });
});

describe("practice session state schema", () => {
  it("keeps a schema-version-3 briefing state read-compatible", () => {
    const now = "2026-07-26T12:00:00.000Z";
    expect(
      practiceSessionStateSchema.safeParse({
        schemaVersion: 3,
        practiceSessionId: "practice-1",
        anonymousSessionId: "anonymous-1",
        status: "active",
        phase: "briefing",
        setup: customSetup,
        plan: validPlan(),
        acceptedResponseCount: 0,
        expectedLearnerSequence: 0,
        messages: [],
        evidenceEvents: [],
        helpEvents: [],
        challengeState: {
          introduced: false,
          resolved: false,
          evidenceMessageIds: [],
        },
        coachingBreak: null,
        retryTarget: null,
        retryOutcome: null,
        takeaway: null,
        terminationReason: null,
        createdAt: now,
        updatedAt: now,
        expiresAt: "2026-08-02T12:00:00.000Z",
      }).success,
    ).toBe(true);
  });

  it("accepts a current two-response briefing and rejects retry state", () => {
    const now = "2026-07-26T12:00:00.000Z";
    const current = {
      schemaVersion: 5,
      responseLimit: 2,
      practiceSessionId: "practice-1",
      anonymousSessionId: "anonymous-1",
      status: "active",
      phase: "briefing",
      setup: customSetup,
      plan: validPlan(),
      acceptedResponseCount: 0,
      expectedLearnerSequence: 0,
      messages: [],
      evidenceEvents: [],
      helpEvents: [],
      challengeState: {
        introduced: false,
        resolved: false,
        evidenceMessageIds: [],
      },
      coachingBreak: null,
      retryTarget: null,
      retryOutcome: null,
      takeaway: null,
      terminationReason: null,
      createdAt: now,
      updatedAt: now,
      expiresAt: "2026-08-02T12:00:00.000Z",
    } as const;

    expect(practiceSessionStateSchema.safeParse(current).success).toBe(true);
    expect(
      practiceSessionStateSchema.safeParse({
        ...current,
        phase: "coaching_break",
      }).success,
    ).toBe(false);
  });

  it("requires learner response numbers to match the accepted count", () => {
    const now = "2026-07-26T12:00:00.000Z";
    expect(
      practiceSessionStateSchema.safeParse({
        schemaVersion: 3,
        practiceSessionId: "practice-1",
        anonymousSessionId: "anonymous-1",
        status: "active",
        phase: "initial_simulation",
        setup: customSetup,
        plan: validPlan(),
        acceptedResponseCount: 1,
        expectedLearnerSequence: 1,
        messages: [],
        evidenceEvents: [],
        helpEvents: [],
        challengeState: {
          introduced: false,
          resolved: false,
          evidenceMessageIds: [],
        },
        coachingBreak: null,
        retryTarget: null,
        retryOutcome: null,
        takeaway: null,
        terminationReason: null,
        createdAt: now,
        updatedAt: now,
        expiresAt: "2026-08-02T12:00:00.000Z",
      }).success,
    ).toBe(false);
  });

  it("accepts a coaching break only after three learner responses", () => {
    const now = "2026-07-26T12:00:00.000Z";
    const learnerMessages = [1, 2, 3].map((responseNumber) => ({
      id: `learner-${responseNumber}`,
      role: "learner",
      phase: "initial_simulation",
      learnerResponseNumber: responseNumber,
      sequence: responseNumber - 1,
      text: `Learner response ${responseNumber}`,
      createdAt: now,
    }));
    const feedback = coachingBreak();

    expect(
      practiceSessionStateSchema.safeParse({
        schemaVersion: 3,
        practiceSessionId: "practice-1",
        anonymousSessionId: "anonymous-1",
        status: "active",
        phase: "coaching_break",
        setup: customSetup,
        plan: validPlan(),
        acceptedResponseCount: 3,
        expectedLearnerSequence: 3,
        messages: learnerMessages,
        evidenceEvents: [
          {
            id: "evidence-1",
            learnerMessageIds: ["learner-3"],
            dimension: "direct_request",
            classification: "opportunity",
            observation: "The request appeared after the explanation.",
            setupRelevance: "The main skill is speaking assertively.",
          },
        ],
        helpEvents: [],
        challengeState: {
          introduced: true,
          resolved: false,
          evidenceMessageIds: ["learner-2"],
        },
        coachingBreak: feedback,
        retryTarget: {
          learnerMessageIds: ["learner-3"],
          partnerMessageId: null,
          prompt: feedback.retryPrompt,
          goal: feedback.retryGoal,
        },
        retryOutcome: null,
        takeaway: null,
        terminationReason: null,
        createdAt: now,
        updatedAt: now,
        expiresAt: "2026-08-02T12:00:00.000Z",
      }).success,
    ).toBe(true);
  });
});
