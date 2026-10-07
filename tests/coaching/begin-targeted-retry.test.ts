import { describe, expect, it } from "vitest";

import {
  beginPracticeTargetedRetry,
} from "@/lib/coaching/begin-targeted-retry";
import { buildDeterministicPracticePlan } from "@/lib/coaching/plan-builder";
import {
  practiceSessionStateSchema,
  type PracticeSessionState,
} from "@/lib/coaching/schemas";
import { InMemoryPracticeRepository } from "@/lib/persistence/in-memory-practice-repository";

const OWNER_ID = "10000000-0000-4000-8000-000000000001";
const PRACTICE_ID = "20000000-0000-4000-8000-000000000001";
const CREATED_AT = "2026-07-27T12:00:00.000Z";
const EXPIRES_AT = "2026-08-03T12:00:00.000Z";
const LEARNER_IDS = [
  "30000000-0000-4000-8000-000000000001",
  "30000000-0000-4000-8000-000000000002",
  "30000000-0000-4000-8000-000000000003",
];
const PARTNER_IDS = [
  "40000000-0000-4000-8000-000000000001",
  "40000000-0000-4000-8000-000000000002",
  "40000000-0000-4000-8000-000000000003",
];

function coachingState(): PracticeSessionState {
  const setup = {
    primarySkill: "speaking_assertively",
    supportingSkill: null,
    context: "work",
    targetBehavior: "make_clear_request",
    targetBehaviors: ["make_clear_request"],
    desiredImpression: "direct_respectful",
    situationMode: "choose_for_me",
    situationDetail: null,
  } as const;
  const messages = LEARNER_IDS.flatMap((learnerId, index) => [
    {
      id: learnerId,
      role: "learner" as const,
      phase: "initial_simulation" as const,
      learnerResponseNumber: index + 1,
      sequence: index * 2,
      text: `Learner response ${index + 1}.`,
      createdAt: CREATED_AT,
    },
    {
      id: PARTNER_IDS[index],
      role: "partner" as const,
      phase: "initial_simulation" as const,
      learnerResponseNumber: null,
      sequence: index * 2 + 1,
      text: `Partner response ${index + 1}.`,
      createdAt: CREATED_AT,
    },
  ]);

  return practiceSessionStateSchema.parse({
    schemaVersion: 3,
    practiceSessionId: PRACTICE_ID,
    anonymousSessionId: OWNER_ID,
    status: "active",
    phase: "coaching_break",
    setup,
    plan: buildDeterministicPracticePlan(setup),
    acceptedResponseCount: 3,
    expectedLearnerSequence: 3,
    messages,
    evidenceEvents: [],
    helpEvents: [],
    challengeState: {
      introduced: false,
      resolved: false,
      evidenceMessageIds: [],
      conductWarningActive: false,
      conductWarningEvidenceMessageId: null,
    },
    coachingBreak: {
      whatWorked: null,
      oneImprovement: {
        title: "Add the reason",
        observation: "Connect the request to one useful reason.",
        evidenceMessageIds: [LEARNER_IDS[2]],
      },
      tryItThisWay: {
        originalMeaning: "Move the deadline.",
        naturalExample:
          "Could we move it to Friday so I can check the final numbers?",
      },
      retryGoal: "State the request and reason together.",
      retryPrompt: "Ask again and include your reason.",
      retryTargetMessageIds: [LEARNER_IDS[2]],
    },
    retryTarget: {
      learnerMessageIds: [LEARNER_IDS[2]],
      partnerMessageId: PARTNER_IDS[2],
      prompt: "Ask again and include your reason.",
      goal: "State the request and reason together.",
    },
    retryOutcome: null,
    takeaway: null,
    terminationReason: null,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    expiresAt: EXPIRES_AT,
  });
}

async function repositoryWith(state: PracticeSessionState) {
  const repository = new InMemoryPracticeRepository();
  await repository.createSession({
    id: OWNER_ID,
    createdAt: CREATED_AT,
    expiresAt: EXPIRES_AT,
  });
  await repository.createPracticeSession({
    anonymousSessionId: OWNER_ID,
    state,
  });
  return repository;
}

describe("begin targeted retry", () => {
  it("moves the coaching break to the retry without changing messages or allowance", async () => {
    const state = coachingState();
    const repository = await repositoryWith(state);

    const result = await beginPracticeTargetedRetry({
      anonymousSessionId: OWNER_ID,
      practiceSessionId: PRACTICE_ID,
      expectedUpdatedAt: CREATED_AT,
      repository,
      now: new Date("2026-07-27T12:00:01.000Z"),
    });

    expect(result).toMatchObject({
      phase: "targeted_retry",
      acceptedResponseCount: 3,
      expectedLearnerSequence: 3,
      messages: state.messages,
      retryTarget: state.retryTarget,
    });
  });

  it("is idempotent after the retry has started", async () => {
    const state = coachingState();
    const repository = await repositoryWith(state);
    const input = {
      anonymousSessionId: OWNER_ID,
      practiceSessionId: PRACTICE_ID,
      expectedUpdatedAt: CREATED_AT,
      repository,
      now: new Date("2026-07-27T12:00:01.000Z"),
    };

    const first = await beginPracticeTargetedRetry(input);
    const replay = await beginPracticeTargetedRetry(input);

    expect(replay).toEqual(first);
  });

  it("rejects a stale coaching screen", async () => {
    const state = coachingState();
    const repository = await repositoryWith(state);

    await expect(
      beginPracticeTargetedRetry({
        anonymousSessionId: OWNER_ID,
        practiceSessionId: PRACTICE_ID,
        expectedUpdatedAt: "2026-07-27T11:59:00.000Z",
        repository,
        now: new Date("2026-07-27T12:00:01.000Z"),
      }),
    ).rejects.toMatchObject({
      reason: "stale_state",
    });
  });
});
