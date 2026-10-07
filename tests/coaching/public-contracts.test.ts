import { describe, expect, it } from "vitest";

import { buildCoachSpeechText } from "@/lib/coaching/coach-speech";
import { buildDeterministicPracticePlan } from "@/lib/coaching/plan-builder";
import { buildPracticeFieldErrors } from "@/lib/coaching/public-errors";
import {
  coachSpeechRequestSchema,
  createPracticeSessionRequestSchema,
  practiceApiErrorSchema,
  practiceHelpRequestSchema,
  practiceTurnFieldsSchema,
  publicPracticeSessionSchema,
  toPublicPracticeSession,
} from "@/lib/coaching/public-contracts";
import {
  practiceSessionStateSchema,
  type PracticeSessionState,
} from "@/lib/coaching/schemas";

const PRACTICE_ID = "20000000-0000-4000-8000-000000000001";
const OWNER_ID = "10000000-0000-4000-8000-000000000001";

function briefingState(
  overrides: Partial<PracticeSessionState> = {},
): PracticeSessionState {
  const setup = {
    primarySkill: "speaking_assertively",
    supportingSkill: "explaining_clearly",
    context: "work",
    targetBehavior: "make_clear_request",
    targetBehaviors: ["make_clear_request"],
    desiredImpression: "direct_respectful",
    situationMode: "choose_for_me",
  } as const;

  return practiceSessionStateSchema.parse({
    schemaVersion: 3,
    practiceSessionId: PRACTICE_ID,
    anonymousSessionId: OWNER_ID,
    status: "active",
    phase: "briefing",
    setup,
    plan: buildDeterministicPracticePlan(setup),
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
    createdAt: "2026-07-26T12:00:00.000Z",
    updatedAt: "2026-07-26T12:00:00.000Z",
    expiresAt: "2026-08-02T12:00:00.000Z",
    ...overrides,
  });
}

describe("learner-safe practice projection", () => {
  it("shows the complete brief without exposing private engine fields", () => {
    const publicSession = toPublicPracticeSession(briefingState());
    const serialized = JSON.stringify(publicSession);
    const forbiddenKeys = [
      "anonymousSessionId",
      "immediateGoal",
      "knownFacts",
      "unknownFacts",
      "baselineTone",
      "prohibitedBehavior",
      "rationale",
      "challenge",
      "evidenceRubric",
      "retryCriteria",
      "safetyConstraints",
      "prohibitedAssumptions",
      "evidenceEvents",
      "helpEvents",
      "challengeState",
    ];

    expect(publicPracticeSessionSchema.safeParse(publicSession).success).toBe(
      true,
    );
    expect(publicSession.brief).toMatchObject({
      coachLabel: "Your coach",
      partnerRole: "Your coworker",
      situation:
        "You and a coworker are discussing an upcoming project with overlapping tasks and unclear priorities.",
      desiredImpression: "Direct but respectful",
    });
    expect(publicSession.actions).toEqual({
      canStart: true,
      canReplaceSituation: true,
      canRecord: false,
      canRequestHelp: false,
      canEnd: true,
      canResumeFinalization: false,
      canDelete: true,
    });
    expect(publicSession.situationReplacementsRemaining).toBe(2);
    expect(publicSession.updatedAt).toBe(
      "2026-07-26T12:00:00.000Z",
    );
    for (const key of forbiddenKeys) {
      expect(serialized).not.toContain(`"${key}"`);
    }
    expect(serialized).not.toContain("Sofia");
  });

  it("addresses the user directly in legacy generated situations", () => {
    const state = briefingState();
    const legacyState = briefingState({
      plan: {
        ...state.plan,
        situation:
          "You and your neighbor are choosing what to buy; the learner prefers better recycling bins.",
      },
    });

    expect(toPublicPracticeSession(legacyState).brief.situation).toBe(
      "You and your neighbor are choosing what to buy; you prefer better recycling bins.",
    );
  });

  it("labels transcript roles and exposes speech only for the partner", () => {
    const state = briefingState({
      phase: "initial_simulation",
      acceptedResponseCount: 1,
      expectedLearnerSequence: 1,
      messages: [
        {
          id: "30000000-0000-4000-8000-000000000001",
          role: "learner",
          phase: "initial_simulation",
          learnerResponseNumber: 1,
          sequence: 0,
          text: "Could we clarify the priority?",
          createdAt: "2026-07-26T12:01:00.000Z",
        },
        {
          id: "30000000-0000-4000-8000-000000000002",
          role: "partner",
          phase: "initial_simulation",
          learnerResponseNumber: null,
          sequence: 1,
          text: "What part is unclear?",
          createdAt: "2026-07-26T12:01:01.000Z",
        },
      ],
    });
    const messages = toPublicPracticeSession(state).messages;

    expect(messages[0]).toMatchObject({
      speakerLabel: "You",
      speechUrl: null,
    });
    expect(messages[1]).toMatchObject({
      speakerLabel: "Your coworker",
      speechUrl:
        `/api/practice-sessions/${PRACTICE_ID}/messages/30000000-0000-4000-8000-000000000002/speech`,
    });
  });
});

describe("practice Route Handler contracts", () => {
  it("accepts only the two learner-visible coach playback sections", () => {
    expect(
      coachSpeechRequestSchema.safeParse({ content: "coaching_break" })
        .success,
    ).toBe(true);
    expect(
      coachSpeechRequestSchema.safeParse({ content: "final_takeaway" })
        .success,
    ).toBe(true);
    expect(
      coachSpeechRequestSchema.safeParse({ content: "simulation" }).success,
    ).toBe(false);
  });

  it("validates complete setup and rejects a mismatched behavior", () => {
    const validSetup = {
      primarySkill: "responding_naturally",
      practiceArea: "work",
      context: "job_interviews",
      targetBehavior: "ask_natural_follow_up",
      targetBehaviors: ["ask_natural_follow_up"],
      situationMode: "choose_for_me",
    };

    expect(
      createPracticeSessionRequestSchema.safeParse(validSetup).success,
    ).toBe(true);
    expect(
      createPracticeSessionRequestSchema.safeParse({
        ...validSetup,
        targetBehavior: "make_clear_request",
        targetBehaviors: ["make_clear_request"],
      }).success,
    ).toBe(false);
  });

  it("enforces one skill and an area-compatible context for new setup", () => {
    const base = {
      primarySkill: "explaining_clearly",
      supportingSkill: null,
      practiceArea: "personal_life",
      context: "everyday_situations",
      targetBehaviors: ["tell_in_logical_order"],
      situationMode: "choose_for_me",
    } as const;

    expect(createPracticeSessionRequestSchema.safeParse(base).success).toBe(
      true,
    );
    expect(
      createPracticeSessionRequestSchema.safeParse({
        ...base,
        supportingSkill: "expressing_yourself",
      }).success,
    ).toBe(false);
    expect(
      createPracticeSessionRequestSchema.safeParse({
        ...base,
        context: "job_interviews",
      }).success,
    ).toBe(false);
    expect(
      createPracticeSessionRequestSchema.safeParse({
        ...base,
        context: "family_relationships",
      }).success,
    ).toBe(false);
  });

  it("accepts multiple equal behaviors for the selected skill", () => {
    const parsed = createPracticeSessionRequestSchema.safeParse({
      primarySkill: "responding_naturally",
      context: "everyday_situations",
      targetBehaviors: [
        "give_natural_first_reaction",
        "show_empathy_or_enthusiasm",
        "ask_natural_follow_up",
      ],
      situationMode: "choose_for_me",
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.targetBehaviors).toHaveLength(3);
  });

  it("rejects retired taxonomy values for new session creation", () => {
    expect(
      createPracticeSessionRequestSchema.safeParse({
        primarySkill: "asking_better_questions",
        context: "everyday_situations",
        targetBehavior: "ask_useful_follow_up",
        targetBehaviors: ["ask_useful_follow_up"],
        situationMode: "choose_for_me",
      }).success,
    ).toBe(false);
    expect(
      createPracticeSessionRequestSchema.safeParse({
        primarySkill: "speaking_assertively",
        context: "work",
        targetBehavior: "state_opinion_confidently",
        targetBehaviors: ["state_opinion_confidently"],
        situationMode: "choose_for_me",
      }).success,
    ).toBe(false);
  });

  it("bounds verbose validator messages before returning field errors", () => {
    const invalid = createPracticeSessionRequestSchema.safeParse({
      primarySkill: "explaining_clearly",
      context: "everyday_situations",
      targetBehavior: "not_a_real_behavior",
      targetBehaviors: ["not_a_real_behavior"],
      situationMode: "choose_for_me",
    });
    expect(invalid.success).toBe(false);
    if (invalid.success) return;

    const fieldErrors = buildPracticeFieldErrors(invalid.error.issues);

    expect(fieldErrors.targetBehavior?.[0].length).toBeLessThanOrEqual(200);
    expect(
      practiceApiErrorSchema.safeParse({
        error: {
          code: "invalid_request",
          message: "Check your practice choices and try again.",
          retryable: false,
          fieldErrors,
        },
      }).success,
    ).toBe(true);
  });

  it("coerces multipart sequence fields but keeps idempotency required", () => {
    expect(
      practiceTurnFieldsSchema.parse({
        idempotencyKey: "turn-1",
        expectedLearnerSequence: "2",
      }),
    ).toEqual({
      idempotencyKey: "turn-1",
      expectedLearnerSequence: 2,
    });
    expect(
      practiceTurnFieldsSchema.safeParse({
        expectedLearnerSequence: "2",
      }).success,
    ).toBe(false);
  });

  it("requires help to target the current state without consuming a turn", () => {
    expect(
      practiceHelpRequestSchema.safeParse({
        type: "organize",
        currentPartnerMessageId: null,
        expectedLearnerSequence: 2,
        expectedUpdatedAt: "2026-07-26T12:00:00.000Z",
      }).success,
    ).toBe(true);
  });

  it("keeps learner-facing failures bounded and explicit", () => {
    expect(
      practiceApiErrorSchema.safeParse({
        error: {
          code: "unclear_audio",
          message: "We could not hear a clear response. Please try again.",
          retryable: true,
        },
      }).success,
    ).toBe(true);
  });
});

describe("coach speech narration", () => {
  it("does not create speech before learner-visible coaching exists", () => {
    const state = briefingState();

    expect(buildCoachSpeechText(state, "coaching_break")).toBeNull();
    expect(buildCoachSpeechText(state, "final_takeaway")).toBeNull();
  });

  it("narrates the coaching break without exposing evidence identifiers", () => {
    const state = briefingState({
      coachingBreak: {
        whatWorked: {
          title: "A clear request",
          observation: "You said what you needed early.",
          evidenceMessageIds: ["private-evidence-id"],
        },
        oneImprovement: {
          title: "Add one reason",
          observation: "Connect your request to one practical reason.",
          evidenceMessageIds: ["private-improvement-id"],
        },
        tryItThisWay: {
          originalMeaning: "Move the deadline.",
          naturalExample: "Could we move it to Friday so I can review it?",
        },
        retryGoal: "State the request and reason together.",
        retryPrompt: "Ask for the deadline change again.",
        retryTargetMessageIds: ["private-retry-id"],
      },
    });

    const narration = buildCoachSpeechText(state, "coaching_break");

    expect(narration).toContain("You said what you needed early.");
    expect(narration).toContain(
      "Could we move it to Friday so I can review it?",
    );
    expect(narration).not.toContain("private-evidence-id");
    expect(narration).not.toContain("private-improvement-id");
    expect(narration).not.toContain("private-retry-id");
    expect(narration).not.toContain("Sofia");
  });

  it("narrates the final takeaway without private comparison evidence", () => {
    const state = briefingState({
      status: "completed",
      phase: "final_takeaway",
      terminationReason: "practice_completed",
      takeaway: {
        flow: "retry",
        kind: "full",
        whatYouPracticed: "You practiced making a clear request.",
        whatChanged: {
          initialObservation: "Your first answer gave helpful context.",
          retryObservation: "Your retry put the request first.",
          evidenceMessageIds: ["private-comparison-id"],
        },
        strongestMoment: {
          title: "Direct opening",
          observation: "You opened with a respectful request.",
          evidenceMessageIds: ["private-strongest-id"],
        },
        keepUsingTechnique: {
          title: "Request plus reason",
          reminder: "Say what you need, then add one reason.",
          personalizedExample: "Could we move it to Friday?",
        },
        englishPolish: [
          {
            originalMeaningOrWords: "Move it Friday.",
            naturalAlternative: "Could we move it to Friday?",
            briefExplanation: "Use to before a day.",
            learnerMessageId: "private-polish-id",
          },
        ],
        tryItInRealLife: "Use this structure for one request this week.",
        optionalRetell: null,
      },
    });

    const narration = buildCoachSpeechText(state, "final_takeaway");

    expect(narration).toContain("Your retry put the request first.");
    expect(narration).toContain("Could we move it to Friday?");
    expect(narration).not.toContain("private-comparison-id");
    expect(narration).not.toContain("private-strongest-id");
    expect(narration).not.toContain("private-polish-id");
  });
});
