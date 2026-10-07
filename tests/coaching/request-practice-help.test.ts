import { describe, expect, it, vi } from "vitest";

import { buildDeterministicPracticePlan } from "@/lib/coaching/plan-builder";
import {
  PRACTICE_HELP_VALUES,
  type PracticeHelpType,
} from "@/lib/coaching/product-rules";
import type { PracticeModel } from "@/lib/coaching/provider-contracts";
import {
  requestPracticeHelp,
} from "@/lib/coaching/request-practice-help";
import {
  practiceSessionStateSchema,
  type PracticeSessionState,
} from "@/lib/coaching/schemas";
import { InMemoryPracticeRepository } from "@/lib/persistence/in-memory-practice-repository";

const OWNER_ID = "10000000-0000-4000-8000-000000000001";
const PRACTICE_ID = "20000000-0000-4000-8000-000000000001";
const LEARNER_ID = "30000000-0000-4000-8000-000000000001";
const PARTNER_ID = "40000000-0000-4000-8000-000000000001";
const HELP_ID = "50000000-0000-4000-8000-000000000001";
const CREATED_AT = "2026-07-27T12:00:00.000Z";
const EXPIRES_AT = "2026-08-03T12:00:00.000Z";

const setup = {
  primarySkill: "explaining_clearly",
  supportingSkill: null,
  context: "work",
  targetBehavior: "describe_problem_and_causes",
  targetBehaviors: ["describe_problem_and_causes"],
  desiredImpression: "calm_confident",
  situationMode: "choose_for_me",
  situationDetail: null,
} as const;

function activeState(): PracticeSessionState {
  return practiceSessionStateSchema.parse({
    schemaVersion: 3,
    practiceSessionId: PRACTICE_ID,
    anonymousSessionId: OWNER_ID,
    status: "active",
    phase: "initial_simulation",
    setup,
    plan: buildDeterministicPracticePlan(setup),
    acceptedResponseCount: 1,
    expectedLearnerSequence: 1,
    messages: [
      {
        id: LEARNER_ID,
        role: "learner",
        phase: "initial_simulation",
        learnerResponseNumber: 1,
        sequence: 0,
        text: "The delivery is late because the address was incomplete.",
        createdAt: CREATED_AT,
      },
      {
        id: PARTNER_ID,
        role: "partner",
        phase: "initial_simulation",
        learnerResponseNumber: null,
        sequence: 1,
        text: "Which part of the address was missing?",
        createdAt: CREATED_AT,
      },
    ],
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

function helpText(type: PracticeHelpType): string {
  switch (type) {
    case "repeat_rephrase":
      return "The partner is asking exactly what information was missing from the address.";
    case "starting_phrase":
      return "You could start with: “The missing part was…” Then continue in your own words.";
    case "organize":
      return "Use three points: what was missing, how that caused the delay, and what should happen next.";
    case "forgot_word":
      return "Describe it by saying what kind of information it is, where it appears in an address, or give an example.";
  }
}

function validOutput(type: PracticeHelpType) {
  return {
    type,
    coachText: helpText(type),
    resumesPhase: "initial_simulation",
    relatedPartnerMessageId: PARTNER_ID,
  };
}

describe("practice help", () => {
  it.each(PRACTICE_HELP_VALUES)(
    "returns bounded %s help without consuming a response",
    async (type) => {
      const state = activeState();
      const repository = await repositoryWith(state);
      const generateHelp = vi.fn(async () => validOutput(type));

      const result = await requestPracticeHelp({
        anonymousSessionId: OWNER_ID,
        practiceSessionId: PRACTICE_ID,
        type,
        currentPartnerMessageId: PARTNER_ID,
        expectedLearnerSequence: 1,
        expectedUpdatedAt: CREATED_AT,
        repository,
        model: { generateHelp },
        now: new Date("2026-07-27T12:00:01.000Z"),
        idFactory: () => HELP_ID,
      });
      const saved = (
        await repository.getPracticeSession({
          anonymousSessionId: OWNER_ID,
          practiceSessionId: PRACTICE_ID,
          now: "2026-07-27T12:00:02.000Z",
        })
      )?.state;

      expect(result).toMatchObject({
        help: {
          type,
          coachLabel: "Your coach",
          coachText: helpText(type),
        },
        session: {
          phase: "initial_simulation",
          acceptedResponseCount: 1,
          expectedLearnerSequence: 1,
        },
      });
      expect(saved?.messages).toEqual(state.messages);
      expect(saved?.helpEvents).toEqual([
        {
          id: HELP_ID,
          type,
          phase: "initial_simulation",
          relatedPartnerMessageId: PARTNER_ID,
          createdAt: "2026-07-27T12:00:01.000Z",
        },
      ]);
      expect(JSON.stringify(saved)).not.toContain(helpText(type));
    },
  );

  it("repairs one invalid generated hint before persisting", async () => {
    const state = activeState();
    const repository = await repositoryWith(state);
    const generateHelp = vi
      .fn<PracticeModel["generateHelp"]>()
      .mockResolvedValueOnce({
        ...validOutput("starting_phrase"),
        type: "organize",
      })
      .mockResolvedValueOnce(validOutput("starting_phrase"));

    await requestPracticeHelp({
      anonymousSessionId: OWNER_ID,
      practiceSessionId: PRACTICE_ID,
      type: "starting_phrase",
      currentPartnerMessageId: PARTNER_ID,
      expectedLearnerSequence: 1,
      expectedUpdatedAt: CREATED_AT,
      repository,
      model: { generateHelp },
      now: new Date("2026-07-27T12:00:01.000Z"),
      idFactory: () => HELP_ID,
    });

    expect(generateHelp).toHaveBeenCalledTimes(2);
    expect(generateHelp.mock.calls[1][0].repairAttempt).toBe(true);
  });

  it("rejects stale help before model work", async () => {
    const state = activeState();
    const repository = await repositoryWith(state);
    const generateHelp = vi.fn(async () =>
      validOutput("repeat_rephrase"),
    );

    await expect(
      requestPracticeHelp({
        anonymousSessionId: OWNER_ID,
        practiceSessionId: PRACTICE_ID,
        type: "repeat_rephrase",
        currentPartnerMessageId: PARTNER_ID,
        expectedLearnerSequence: 0,
        expectedUpdatedAt: CREATED_AT,
        repository,
        model: { generateHelp },
        now: new Date("2026-07-27T12:00:01.000Z"),
      }),
    ).rejects.toMatchObject({
      apiError: { code: "stale_state" },
    });
    expect(generateHelp).not.toHaveBeenCalled();
  });

  it("does not allow help to attach to an older partner message", async () => {
    const state = activeState();
    const repository = await repositoryWith(state);
    const generateHelp = vi.fn(async () =>
      validOutput("repeat_rephrase"),
    );

    await expect(
      requestPracticeHelp({
        anonymousSessionId: OWNER_ID,
        practiceSessionId: PRACTICE_ID,
        type: "repeat_rephrase",
        currentPartnerMessageId:
          "60000000-0000-4000-8000-000000000001",
        expectedLearnerSequence: 1,
        expectedUpdatedAt: CREATED_AT,
        repository,
        model: { generateHelp },
        now: new Date("2026-07-27T12:00:01.000Z"),
      }),
    ).rejects.toMatchObject({
      apiError: { code: "invalid_request" },
    });
    expect(generateHelp).not.toHaveBeenCalled();
  });
});
