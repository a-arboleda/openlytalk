import { describe, expect, it } from "vitest";

import { buildDeterministicPracticePlan } from "@/lib/coaching/plan-builder";
import {
  practiceSessionStateSchema,
  type PracticeSessionState,
} from "@/lib/coaching/schemas";
import {
  startPracticeSession,
} from "@/lib/coaching/start-practice-session";
import { InMemoryPracticeRepository } from "@/lib/persistence/in-memory-practice-repository";

const OWNER_ID = "10000000-0000-4000-8000-000000000001";
const OTHER_OWNER_ID = "10000000-0000-4000-8000-000000000002";
const PRACTICE_ID = "20000000-0000-4000-8000-000000000001";
const MESSAGE_ID = "30000000-0000-4000-8000-000000000001";
const CREATED_AT = "2026-07-27T12:00:00.000Z";
const EXPIRES_AT = "2026-08-03T12:00:00.000Z";

function briefingState(input: {
  ownerId?: string;
  partnerStarts: boolean;
}): PracticeSessionState {
  const setup = input.partnerStarts
    ? ({
        primarySkill: "responding_naturally",
        supportingSkill: null,
        context: "job_interviews",
        targetBehavior: "ask_natural_follow_up",
        targetBehaviors: ["ask_natural_follow_up"],
        desiredImpression: "professional_prepared",
        situationMode: "choose_for_me",
        situationDetail: null,
      } as const)
    : ({
        primarySkill: "speaking_assertively",
        supportingSkill: null,
        context: "work",
        targetBehavior: "make_clear_request",
        targetBehaviors: ["make_clear_request"],
        desiredImpression: "direct_respectful",
        situationMode: "choose_for_me",
        situationDetail: null,
      } as const);

  const generatedPlan = buildDeterministicPracticePlan(setup);
  const plan = input.partnerStarts
    ? generatedPlan
    : {
        ...generatedPlan,
        opening: {
          ...generatedPlan.opening,
          speaker: "learner" as const,
          partnerOpeningText: null,
          rationale: "Retained learner-first practice.",
        },
      };

  return practiceSessionStateSchema.parse({
    schemaVersion: 3,
    practiceSessionId: PRACTICE_ID,
    anonymousSessionId: input.ownerId ?? OWNER_ID,
    status: "active",
    phase: "briefing",
    setup,
    plan,
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
}

async function repositoryWith(state: PracticeSessionState) {
  const repository = new InMemoryPracticeRepository();
  await repository.createSession({
    id: OWNER_ID,
    createdAt: CREATED_AT,
    expiresAt: EXPIRES_AT,
  });
  await repository.createSession({
    id: OTHER_OWNER_ID,
    createdAt: CREATED_AT,
    expiresAt: EXPIRES_AT,
  });
  await repository.createPracticeSession({
    anonymousSessionId: state.anonymousSessionId,
    state,
  });
  return repository;
}

describe("starting a practice simulation", () => {
  it("keeps retained learner-first practices readable", async () => {
    const briefing = briefingState({ partnerStarts: false });
    const repository = await repositoryWith(briefing);

    const started = await startPracticeSession({
      anonymousSessionId: OWNER_ID,
      practiceSessionId: PRACTICE_ID,
      expectedUpdatedAt: CREATED_AT,
      repository,
      now: new Date("2026-07-27T12:00:01.000Z"),
      idFactory: () => MESSAGE_ID,
    });

    expect(started.phase).toBe("initial_simulation");
    expect(started.messages).toEqual([]);
    expect(started.acceptedResponseCount).toBe(0);
    expect(started.expectedLearnerSequence).toBe(0);
  });

  it("atomically appends the planned partner opening when the partner starts", async () => {
    const briefing = briefingState({ partnerStarts: true });
    const repository = await repositoryWith(briefing);

    const started = await startPracticeSession({
      anonymousSessionId: OWNER_ID,
      practiceSessionId: PRACTICE_ID,
      expectedUpdatedAt: CREATED_AT,
      repository,
      now: new Date("2026-07-27T12:00:01.000Z"),
      idFactory: () => MESSAGE_ID,
    });
    const opening = started.messages[0];

    expect(started.phase).toBe("initial_simulation");
    expect(opening).toMatchObject({
      id: MESSAGE_ID,
      role: "partner",
      phase: "initial_simulation",
      learnerResponseNumber: null,
      sequence: 0,
      text: briefing.plan.opening.partnerOpeningText,
    });
    expect(started.acceptedResponseCount).toBe(0);
    expect(
      (
        await repository.getPracticeSession({
          anonymousSessionId: OWNER_ID,
          practiceSessionId: PRACTICE_ID,
          now: "2026-07-27T12:00:02.000Z",
        })
      )?.state.messages,
    ).toEqual(started.messages);
  });

  it("is idempotent after the first successful start", async () => {
    const briefing = briefingState({ partnerStarts: true });
    const repository = await repositoryWith(briefing);
    const input = {
      anonymousSessionId: OWNER_ID,
      practiceSessionId: PRACTICE_ID,
      expectedUpdatedAt: CREATED_AT,
      repository,
      now: new Date("2026-07-27T12:00:01.000Z"),
      idFactory: () => MESSAGE_ID,
    };

    const first = await startPracticeSession(input);
    const replay = await startPracticeSession(input);

    expect(replay).toEqual(first);
    expect(replay.messages).toHaveLength(1);
  });

  it("does not reveal practices owned by another anonymous session", async () => {
    const repository = await repositoryWith(
      briefingState({ partnerStarts: false }),
    );

    await expect(
      startPracticeSession({
        anonymousSessionId: OTHER_OWNER_ID,
        practiceSessionId: PRACTICE_ID,
        expectedUpdatedAt: CREATED_AT,
        repository,
        now: new Date("2026-07-27T12:00:01.000Z"),
      }),
    ).rejects.toMatchObject({
      reason: "not_found",
    });
  });
});
