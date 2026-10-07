import { describe, expect, it } from "vitest";

import { buildDeterministicPracticePlan } from "@/lib/coaching/plan-builder";
import type { GeneratePracticePlanRequest } from "@/lib/coaching/provider-contracts";
import {
  replacePracticeSituation,
} from "@/lib/coaching/replace-practice-situation";
import {
  practiceSessionStateSchema,
  type PracticePlan,
  type PracticeSetup,
} from "@/lib/coaching/schemas";
import { InMemoryPracticeRepository } from "@/lib/persistence/in-memory-practice-repository";

const OWNER_ID = "10000000-0000-4000-8000-000000000001";
const PRACTICE_ID = "20000000-0000-4000-8000-000000000001";
const CREATED_AT = "2026-07-27T12:00:00.000Z";
const EXPIRES_AT = "2026-08-03T12:00:00.000Z";
const KEY_ONE = "replacement-key-00000001";
const KEY_TWO = "replacement-key-00000002";
const KEY_THREE = "replacement-key-00000003";

const setup = {
  primarySkill: "speaking_assertively",
  supportingSkill: "explaining_clearly",
  practiceArea: "work",
  context: "work",
  targetBehavior: "make_clear_request",
  targetBehaviors: ["make_clear_request"],
  desiredImpression: "direct_respectful",
  situationMode: "choose_for_me",
  situationDetail: null,
} as const satisfies PracticeSetup;

function alternatePlan(label: string): PracticePlan {
  const plan = buildDeterministicPracticePlan(setup);
  return {
    ...plan,
    situation: `You need to discuss ${label} with your manager before the next shift.`,
    sessionGoal: `Explain ${label} clearly and make one respectful request.`,
    partner: {
      ...plan.partner,
      roleLabel: "Your manager",
      relationshipToLearner: "The learner reports to this manager at work.",
      immediateGoal: `Understand the learner's concern about ${label}.`,
      knownFacts: [`The manager knows ${label} needs attention.`],
      unknownFacts: ["The manager does not know what solution the learner wants."],
    },
    opening: {
      ...plan.opening,
      learnerCue: `Tell your manager what happened with ${label} and what you need.`,
    },
    challenge: {
      ...plan.challenge,
      behavior: `The manager asks for one concrete detail about ${label}.`,
    },
  };
}

class QueuedPlanModel {
  readonly calls: GeneratePracticePlanRequest[] = [];

  constructor(private readonly outputs: unknown[]) {}

  async generatePlan(request: GeneratePracticePlanRequest): Promise<unknown> {
    this.calls.push(request);
    return this.outputs.shift();
  }
}

async function repositoryWithSetup(targetSetup: PracticeSetup = setup) {
  const repository = new InMemoryPracticeRepository();
  await repository.createSession({
    id: OWNER_ID,
    createdAt: CREATED_AT,
    expiresAt: EXPIRES_AT,
  });
  const state = practiceSessionStateSchema.parse({
    schemaVersion: 3,
    practiceSessionId: PRACTICE_ID,
    anonymousSessionId: OWNER_ID,
    status: "active",
    phase: "briefing",
    setup: targetSetup,
    plan: buildDeterministicPracticePlan(targetSetup),
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
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    expiresAt: EXPIRES_AT,
  });
  await repository.createPracticeSession({
    anonymousSessionId: OWNER_ID,
    state,
  });
  return { repository, state };
}

describe("replacing a generated practice situation", () => {
  it("replaces the complete plan without consuming a learner response", async () => {
    const { repository, state } = await repositoryWithSetup();
    const alternative = alternatePlan("a last-minute schedule change");
    const model = new QueuedPlanModel([alternative]);

    const replaced = await replacePracticeSituation({
      anonymousSessionId: OWNER_ID,
      practiceSessionId: PRACTICE_ID,
      idempotencyKey: KEY_ONE,
      expectedUpdatedAt: state.updatedAt,
      model,
      repository,
      now: new Date("2026-07-27T12:00:01.000Z"),
    });

    expect(replaced.plan).toEqual(alternative);
    expect(replaced.situationReplacementCount).toBe(1);
    expect(replaced.acceptedResponseCount).toBe(0);
    expect(replaced.expectedLearnerSequence).toBe(0);
    expect(replaced.messages).toEqual([]);
    expect(model.calls[0].scenarioVariation).toEqual({
      seed: `${PRACTICE_ID}:replacement:1`,
      recentlyUsedSituations: [state.plan.situation],
    });
  });

  it("treats a repeated idempotency key as the same replacement", async () => {
    const { repository, state } = await repositoryWithSetup();
    const model = new QueuedPlanModel([
      alternatePlan("a missing delivery"),
      alternatePlan("a customer complaint"),
    ]);
    const first = await replacePracticeSituation({
      anonymousSessionId: OWNER_ID,
      practiceSessionId: PRACTICE_ID,
      idempotencyKey: KEY_ONE,
      expectedUpdatedAt: state.updatedAt,
      model,
      repository,
      now: new Date("2026-07-27T12:00:01.000Z"),
    });
    const replay = await replacePracticeSituation({
      anonymousSessionId: OWNER_ID,
      practiceSessionId: PRACTICE_ID,
      idempotencyKey: KEY_ONE,
      expectedUpdatedAt: state.updatedAt,
      model,
      repository,
      now: new Date("2026-07-27T12:00:02.000Z"),
    });

    expect(replay).toEqual(first);
    expect(model.calls).toHaveLength(1);
  });

  it("allows two replacements and rejects a third", async () => {
    const { repository, state } = await repositoryWithSetup();
    const model = new QueuedPlanModel([
      alternatePlan("a missing delivery"),
      alternatePlan("a customer complaint"),
    ]);
    const first = await replacePracticeSituation({
      anonymousSessionId: OWNER_ID,
      practiceSessionId: PRACTICE_ID,
      idempotencyKey: KEY_ONE,
      expectedUpdatedAt: state.updatedAt,
      model,
      repository,
      now: new Date("2026-07-27T12:00:01.000Z"),
    });
    const second = await replacePracticeSituation({
      anonymousSessionId: OWNER_ID,
      practiceSessionId: PRACTICE_ID,
      idempotencyKey: KEY_TWO,
      expectedUpdatedAt: first.updatedAt,
      model,
      repository,
      now: new Date("2026-07-27T12:00:02.000Z"),
    });
    const callsBeforeThirdAttempt = model.calls.length;

    await expect(
      replacePracticeSituation({
        anonymousSessionId: OWNER_ID,
        practiceSessionId: PRACTICE_ID,
        idempotencyKey: KEY_THREE,
        expectedUpdatedAt: second.updatedAt,
        model,
        repository,
        now: new Date("2026-07-27T12:00:03.000Z"),
      }),
    ).rejects.toMatchObject({
      reason: "replacement_limit",
    });
    expect(second.situationReplacementCount).toBe(2);
    expect(model.calls).toHaveLength(callsBeforeThirdAttempt);
  });

  it("does not replace a learner-provided situation", async () => {
    const customSetup = {
      ...setup,
      situationMode: "learner_provided",
      situationDetail: "I need to ask my manager for a schedule change.",
    } as const satisfies PracticeSetup;
    const { repository, state } = await repositoryWithSetup(customSetup);
    const model = new QueuedPlanModel([]);

    await expect(
      replacePracticeSituation({
        anonymousSessionId: OWNER_ID,
        practiceSessionId: PRACTICE_ID,
        idempotencyKey: KEY_ONE,
        expectedUpdatedAt: state.updatedAt,
        model,
        repository,
        now: new Date("2026-07-27T12:00:01.000Z"),
      }),
    ).rejects.toMatchObject({
      reason: "phase_not_available",
    });
    expect(model.calls).toHaveLength(0);
  });
});
