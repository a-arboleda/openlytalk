import { describe, expect, it, vi } from "vitest";

import {
  endPracticeSession,
  EndPracticeSessionError,
} from "@/lib/coaching/end-practice-session";
import { buildDeterministicPracticePlan } from "@/lib/coaching/plan-builder";
import type { PracticeModel } from "@/lib/coaching/provider-contracts";
import {
  practiceSessionStateSchema,
  type PracticeMessage,
  type PracticeSessionState,
} from "@/lib/coaching/schemas";
import { InMemoryPracticeRepository } from "@/lib/persistence/in-memory-practice-repository";

const OWNER_ID = "10000000-0000-4000-8000-000000000001";
const OTHER_OWNER_ID = "10000000-0000-4000-8000-000000000002";
const PRACTICE_ID = "20000000-0000-4000-8000-000000000001";
const FIRST_LEARNER_ID = "30000000-0000-4000-8000-000000000001";
const SECOND_LEARNER_ID = "30000000-0000-4000-8000-000000000002";
const CREATED_AT = "2026-07-27T12:00:00.000Z";
const EXPIRES_AT = "2026-08-03T12:00:00.000Z";

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

function transcript(count: 0 | 1 | 2): PracticeMessage[] {
  const messages: PracticeMessage[] = [];
  if (count >= 1) {
    messages.push(
      {
        id: FIRST_LEARNER_ID,
        role: "learner",
        phase: "initial_simulation",
        learnerResponseNumber: 1,
        sequence: 0,
        text: "Could we move the deadline to Friday?",
        createdAt: CREATED_AT,
      },
      {
        id: "40000000-0000-4000-8000-000000000001",
        role: "partner",
        phase: "initial_simulation",
        learnerResponseNumber: null,
        sequence: 1,
        text: "What would the extra time help you finish?",
        createdAt: CREATED_AT,
      },
    );
  }
  if (count >= 2) {
    messages.push(
      {
        id: SECOND_LEARNER_ID,
        role: "learner",
        phase: "initial_simulation",
        learnerResponseNumber: 2,
        sequence: 2,
        text: "It would give me time to check the final numbers.",
        createdAt: CREATED_AT,
      },
      {
        id: "40000000-0000-4000-8000-000000000002",
        role: "partner",
        phase: "initial_simulation",
        learnerResponseNumber: null,
        sequence: 3,
        text: "That sounds like a practical reason.",
        createdAt: CREATED_AT,
      },
    );
  }
  return messages;
}

function stateAt(count: 0 | 1 | 2): PracticeSessionState {
  return practiceSessionStateSchema.parse({
    schemaVersion: 3,
    practiceSessionId: PRACTICE_ID,
    anonymousSessionId: OWNER_ID,
    status: "active",
    phase: count === 0 ? "briefing" : "initial_simulation",
    setup,
    plan: buildDeterministicPracticePlan(setup),
    acceptedResponseCount: count,
    expectedLearnerSequence: count,
    messages: transcript(count),
    evidenceEvents: [],
    helpEvents: [],
    challengeState: {
      introduced: false,
      resolved: false,
      evidenceMessageIds: [],
      conductWarningActive: false,
      conductWarningEvidenceMessageId: null,
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

function partialTakeaway(evidenceMessageId = FIRST_LEARNER_ID) {
  return {
    kind: "partial",
    whatYouPracticed:
      "You practiced making a clear request and supporting it with a reason.",
    whatChanged: {
      initialObservation:
        "You named the change you wanted and later added a practical reason.",
      retryObservation: null,
      evidenceMessageIds: [evidenceMessageId],
    },
    strongestMoment: null,
    keepUsingTechnique: {
      title: "Request + reason",
      reminder: "State what you need, then add one useful reason.",
      personalizedExample:
        "Could we move it to Friday so I can check the final numbers?",
    },
    englishPolish: [],
    tryItInRealLife:
      "Use the same structure for one small request at work this week.",
    optionalRetell: null,
  };
}

function continuousPartialTakeaway(
  evidenceMessageId = SECOND_LEARNER_ID,
) {
  return {
    flow: "continuous",
    kind: "partial",
    whatYouPracticed:
      "You practiced making a clear request and supporting it with a reason.",
    whatWorked: {
      title: "A practical reason",
      observation: "You explained why the extra time would help.",
      evidenceMessageIds: [evidenceMessageId],
    },
    oneImprovement: {
      title: "Connect the ideas sooner",
      observation: "Put the request and reason in the same response.",
      evidenceMessageIds: [evidenceMessageId],
    },
    naturalExample: {
      originalMeaning: "Move the deadline so I can check the numbers.",
      naturalExample:
        "Could we move it to Friday so I can check the final numbers?",
    },
    englishPolish: [],
    tryItInRealLife:
      "Use the same structure for one small request this week.",
    optionalRetell: null,
  };
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

function modelReturning(
  result: unknown,
): Pick<PracticeModel, "generateTakeaway"> {
  return {
    generateTakeaway: vi.fn(async () => result),
  };
}

describe("ending a practice session", () => {
  it("does not expose a practice owned by another anonymous session", async () => {
    const state = stateAt(1);
    const repository = await repositoryWith(state);

    await expect(
      endPracticeSession({
        anonymousSessionId: OTHER_OWNER_ID,
        practiceSessionId: PRACTICE_ID,
        expectedUpdatedAt: state.updatedAt,
        repository,
        model: modelReturning(partialTakeaway()),
        now: new Date("2026-07-27T12:01:00.000Z"),
      }),
    ).rejects.toMatchObject({
      status: 404,
      apiError: { code: "not_found" },
    });
  });

  it("ends without feedback when fewer than two responses were accepted", async () => {
    const state = stateAt(1);
    const repository = await repositoryWith(state);
    const model = modelReturning(partialTakeaway());

    const result = await endPracticeSession({
      anonymousSessionId: OWNER_ID,
      practiceSessionId: PRACTICE_ID,
      expectedUpdatedAt: state.updatedAt,
      repository,
      model,
      now: new Date("2026-07-27T12:01:00.000Z"),
    });

    expect(result.session).toMatchObject({
      status: "ended",
      acceptedResponseCount: 1,
      takeaway: null,
    });
    expect(model.generateTakeaway).not.toHaveBeenCalled();
  });

  it("creates a grounded partial takeaway after two responses", async () => {
    const state = stateAt(2);
    const repository = await repositoryWith(state);
    const model = modelReturning(partialTakeaway());

    const result = await endPracticeSession({
      anonymousSessionId: OWNER_ID,
      practiceSessionId: PRACTICE_ID,
      expectedUpdatedAt: state.updatedAt,
      repository,
      model,
      now: new Date("2026-07-27T12:01:00.000Z"),
    });

    expect(result.session).toMatchObject({
      status: "completed",
      phase: "final_takeaway",
      acceptedResponseCount: 2,
      takeaway: {
        kind: "partial",
        whatChanged: { retryObservation: null },
      },
    });
    expect(model.generateTakeaway).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "partial", repairAttempt: false }),
    );
  });

  it("creates continuous final feedback when a current practice ends after two responses", async () => {
    const legacyState = stateAt(2);
    const state = practiceSessionStateSchema.parse({
      ...legacyState,
      schemaVersion: 4,
      responseLimit: 3,
    });
    const repository = await repositoryWith(state);
    const model = modelReturning(continuousPartialTakeaway());

    const result = await endPracticeSession({
      anonymousSessionId: OWNER_ID,
      practiceSessionId: PRACTICE_ID,
      expectedUpdatedAt: state.updatedAt,
      repository,
      model,
      now: new Date("2026-07-27T12:01:00.000Z"),
    });

    expect(result.session).toMatchObject({
      status: "completed",
      phase: "final_takeaway",
      acceptedResponseCount: 2,
      responseLimit: 3,
      takeaway: {
        flow: "continuous",
        kind: "partial",
      },
    });
  });

  it("repairs invalid evidence once before saving the takeaway", async () => {
    const state = stateAt(2);
    const repository = await repositoryWith(state);
    const generateTakeaway = vi
      .fn()
      .mockResolvedValueOnce(partialTakeaway("unknown-message"))
      .mockResolvedValueOnce(partialTakeaway());

    const result = await endPracticeSession({
      anonymousSessionId: OWNER_ID,
      practiceSessionId: PRACTICE_ID,
      expectedUpdatedAt: state.updatedAt,
      repository,
      model: { generateTakeaway },
      now: new Date("2026-07-27T12:01:00.000Z"),
    });

    expect(result.session.status).toBe("completed");
    expect(generateTakeaway).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ repairAttempt: true }),
    );
  });

  it("resumes an interrupted partial takeaway and remains idempotent", async () => {
    const state = stateAt(2);
    const repository = await repositoryWith(state);
    const invalidModel = modelReturning(
      partialTakeaway("unknown-message"),
    );

    await expect(
      endPracticeSession({
        anonymousSessionId: OWNER_ID,
        practiceSessionId: PRACTICE_ID,
        expectedUpdatedAt: state.updatedAt,
        repository,
        model: invalidModel,
        now: new Date("2026-07-27T12:01:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(EndPracticeSessionError);

    const validModel = modelReturning(partialTakeaway());
    const completed = await endPracticeSession({
      anonymousSessionId: OWNER_ID,
      practiceSessionId: PRACTICE_ID,
      expectedUpdatedAt: state.updatedAt,
      repository,
      model: validModel,
      now: new Date("2026-07-27T12:02:00.000Z"),
    });
    const repeated = await endPracticeSession({
      anonymousSessionId: OWNER_ID,
      practiceSessionId: PRACTICE_ID,
      expectedUpdatedAt: state.updatedAt,
      repository,
      model: validModel,
      now: new Date("2026-07-27T12:03:00.000Z"),
    });

    expect(completed.session.status).toBe("completed");
    expect(repeated).toEqual(completed);
    expect(validModel.generateTakeaway).toHaveBeenCalledTimes(1);
  });
});
