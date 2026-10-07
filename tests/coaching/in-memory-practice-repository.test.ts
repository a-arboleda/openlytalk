import { describe, expect, it } from "vitest";

import { buildDeterministicPracticePlan } from "@/lib/coaching/plan-builder";
import {
  practiceSessionStateSchema,
  type PracticeMessage,
  type PracticeSessionState,
} from "@/lib/coaching/schemas";
import { InMemoryPracticeRepository } from "@/lib/persistence/in-memory-practice-repository";

const OWNER_ID = "10000000-0000-4000-8000-000000000001";
const OTHER_OWNER_ID = "10000000-0000-4000-8000-000000000002";
const PRACTICE_ID = "20000000-0000-4000-8000-000000000001";
const LEARNER_MESSAGE_ID = "30000000-0000-4000-8000-000000000001";
const PARTNER_MESSAGE_ID = "30000000-0000-4000-8000-000000000002";
const CREATED_AT = "2026-07-26T12:00:00.000Z";
const EXPIRES_AT = "2026-08-02T12:00:00.000Z";

function practiceState(
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
  const plan = buildDeterministicPracticePlan(setup);

  return practiceSessionStateSchema.parse({
    schemaVersion: 3,
    practiceSessionId: PRACTICE_ID,
    anonymousSessionId: OWNER_ID,
    status: "active",
    phase: "initial_simulation",
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
    ...overrides,
  });
}

async function readyRepository(
  state = practiceState(),
): Promise<InMemoryPracticeRepository> {
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
    anonymousSessionId: OWNER_ID,
    state,
  });
  return repository;
}

function acceptedMessages(): PracticeMessage[] {
  return [
    {
      id: LEARNER_MESSAGE_ID,
      role: "learner",
      phase: "initial_simulation",
      learnerResponseNumber: 1,
      sequence: 0,
      text: "Could we clarify which task I should complete first?",
      createdAt: "2026-07-26T12:01:00.000Z",
    },
    {
      id: PARTNER_MESSAGE_ID,
      role: "partner",
      phase: "initial_simulation",
      learnerResponseNumber: null,
      sequence: 1,
      text: "What makes the priority unclear right now?",
      createdAt: "2026-07-26T12:01:01.000Z",
    },
  ];
}

describe("in-memory practice repository ownership", () => {
  it("loads only an unexpired practice owned by the anonymous session", async () => {
    const repository = await readyRepository();

    expect(
      await repository.getPracticeSession({
        anonymousSessionId: OWNER_ID,
        practiceSessionId: PRACTICE_ID,
        now: "2026-07-26T13:00:00.000Z",
      }),
    ).not.toBeNull();
    expect(
      await repository.getPracticeSession({
        anonymousSessionId: OTHER_OWNER_ID,
        practiceSessionId: PRACTICE_ID,
        now: "2026-07-26T13:00:00.000Z",
      }),
    ).toBeNull();
    expect(
      await repository.getPracticeSession({
        anonymousSessionId: OWNER_ID,
        practiceSessionId: PRACTICE_ID,
        now: EXPIRES_AT,
      }),
    ).toBeNull();

    expect(
      await repository.lookupPracticeSession({
        anonymousSessionId: OWNER_ID,
        practiceSessionId: PRACTICE_ID,
        now: EXPIRES_AT,
      }),
    ).toEqual({ kind: "expired" });
    expect(
      await repository.lookupPracticeSession({
        anonymousSessionId: OTHER_OWNER_ID,
        practiceSessionId: PRACTICE_ID,
        now: "2026-07-26T13:00:00.000Z",
      }),
    ).toEqual({ kind: "not_found" });
  });

  it("deletes only a practice owned by the requesting session", async () => {
    const repository = await readyRepository();

    expect(
      await repository.deletePracticeSession({
        anonymousSessionId: OTHER_OWNER_ID,
        practiceSessionId: PRACTICE_ID,
      }),
    ).toBe(false);
    expect(
      await repository.deletePracticeSession({
        anonymousSessionId: OWNER_ID,
        practiceSessionId: PRACTICE_ID,
      }),
    ).toBe(true);
    expect(
      await repository.lookupPracticeSession({
        anonymousSessionId: OWNER_ID,
        practiceSessionId: PRACTICE_ID,
        now: "2026-07-26T13:00:00.000Z",
      }),
    ).toEqual({ kind: "not_found" });
  });
});

describe("in-memory practice turn reservations", () => {
  it("replays an active reservation and blocks competing work", async () => {
    const repository = await readyRepository();
    const input = {
      anonymousSessionId: OWNER_ID,
      practiceSessionId: PRACTICE_ID,
      idempotencyKey: "practice-turn-1",
      expectedLearnerSequence: 0,
      now: "2026-07-26T12:01:00.000Z",
    };

    expect((await repository.beginPracticeTurn(input)).kind).toBe("ready");
    expect(
      await repository.beginPracticeTurn({
        ...input,
        now: "2026-07-26T12:01:01.000Z",
      }),
    ).toMatchObject({ kind: "in_progress" });
    expect(
      await repository.beginPracticeTurn({
        ...input,
        idempotencyKey: "practice-turn-competing",
        now: "2026-07-26T12:01:02.000Z",
      }),
    ).toMatchObject({ kind: "in_progress" });
  });

  it("releases failed work without consuming a response", async () => {
    const repository = await readyRepository();
    const input = {
      anonymousSessionId: OWNER_ID,
      practiceSessionId: PRACTICE_ID,
      idempotencyKey: "practice-turn-retry",
      expectedLearnerSequence: 0,
      now: "2026-07-26T12:01:00.000Z",
    };
    const first = await repository.beginPracticeTurn(input);
    if (first.kind !== "ready") {
      throw new Error("Expected the first reservation to be ready.");
    }

    await repository.releasePracticeTurn({
      practiceSessionId: PRACTICE_ID,
      reservationId: first.reservationId,
      idempotencyKey: input.idempotencyKey,
      reason: "unclear_audio",
    });

    expect(
      await repository.beginPracticeTurn({
        ...input,
        now: "2026-07-26T12:01:02.000Z",
      }),
    ).toMatchObject({ kind: "ready" });
    expect(
      (
        await repository.getPracticeSession({
          anonymousSessionId: OWNER_ID,
          practiceSessionId: PRACTICE_ID,
          now: "2026-07-26T12:01:02.000Z",
        })
      )?.state.acceptedResponseCount,
    ).toBe(0);
  });

  it("commits messages and state once, then replays the receipt", async () => {
    const repository = await readyRepository();
    const beginInput = {
      anonymousSessionId: OWNER_ID,
      practiceSessionId: PRACTICE_ID,
      idempotencyKey: "practice-turn-commit",
      expectedLearnerSequence: 0,
      now: "2026-07-26T12:01:00.000Z",
    };
    const reservation = await repository.beginPracticeTurn(beginInput);
    if (reservation.kind !== "ready") {
      throw new Error("Expected a ready reservation.");
    }
    const messages = acceptedMessages();
    const nextState = practiceState({
      acceptedResponseCount: 1,
      expectedLearnerSequence: 1,
      messages,
      updatedAt: "2026-07-26T12:01:01.000Z",
    });
    const commitInput = {
      anonymousSessionId: OWNER_ID,
      practiceSessionId: PRACTICE_ID,
      reservationId: reservation.reservationId,
      idempotencyKey: beginInput.idempotencyKey,
      expectedLearnerSequence: 0,
      acceptedMessages: messages,
      nextState,
    };

    expect(await repository.commitPracticeTurn(commitInput)).toMatchObject({
      kind: "committed",
      receipt: {
        practiceSessionId: PRACTICE_ID,
        acceptedMessages: messages,
      },
    });
    expect(await repository.commitPracticeTurn(commitInput)).toMatchObject({
      kind: "duplicate",
    });
    expect(
      await repository.beginPracticeTurn({
        ...beginInput,
        now: "2026-07-26T12:01:02.000Z",
      }),
    ).toMatchObject({ kind: "committed" });
  });
});

describe("in-memory practice progress and cleanup", () => {
  it("uses compare-and-set when starting the simulation", async () => {
    const briefing = practiceState({ phase: "briefing" });
    const repository = await readyRepository(briefing);
    const started = practiceState({
      phase: "initial_simulation",
      updatedAt: "2026-07-26T12:00:01.000Z",
    });

    expect(
      await repository.savePracticeProgress({
        anonymousSessionId: OWNER_ID,
        practiceSessionId: PRACTICE_ID,
        expectedPhase: "briefing",
        expectedUpdatedAt: CREATED_AT,
        now: "2026-07-26T12:00:01.000Z",
        nextState: started,
      }),
    ).toMatchObject({ kind: "saved" });
    expect(
      await repository.savePracticeProgress({
        anonymousSessionId: OWNER_ID,
        practiceSessionId: PRACTICE_ID,
        expectedPhase: "briefing",
        expectedUpdatedAt: CREATED_AT,
        now: "2026-07-26T12:00:02.000Z",
        nextState: started,
      }),
    ).toEqual({ kind: "rejected", reason: "stale_state" });
  });

  it("deletes expired practices in bounded batches", async () => {
    const repository = await readyRepository();

    expect(
      await repository.deleteExpiredPracticeSessions(EXPIRES_AT, 1),
    ).toBe(1);
    expect(
      await repository.getPracticeSession({
        anonymousSessionId: OWNER_ID,
        practiceSessionId: PRACTICE_ID,
        now: "2026-08-02T12:00:01.000Z",
      }),
    ).toBeNull();
  });
});
