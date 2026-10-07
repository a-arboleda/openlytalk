import { describe, expect, it, vi } from "vitest";

import {
  processTurn,
} from "@/lib/conversation-engine/process-turn";
import type {
  CommitTurnInput,
  ConversationRepository,
  ReleaseTurnInput,
  TurnReceipt,
} from "@/lib/persistence/conversation-repository";
import type { ConversationModel } from "@/lib/providers/contracts";
import {
  conversationStateSchema,
  evidenceDimensionSchema,
  type ConversationState,
  type NextTurnOutput,
} from "@/lib/validation/conversation";
import { wavFixture } from "@/tests/helpers/audio";

const sessionId = "10000000-0000-4000-8000-000000000001";
const conversationId = "20000000-0000-4000-8000-000000000002";
const learnerId = "40000000-0000-4000-8000-000000000004";
const sofiaId = "50000000-0000-4000-8000-000000000005";
const reservationId = "60000000-0000-4000-8000-000000000006";
const now = "2026-07-17T12:00:00.000Z";

function stateAt(count = 0): ConversationState {
  return conversationStateSchema.parse({
    schemaVersion: 2,
    conversationId,
    status: "active",
    terminationReason: null,
    outcomeCategory: null,
    conversationType: "Sharing Experiences",
    context: "Daily Life",
    scenePlan: {
      openingMode: "learner_first",
      conversationType: "Sharing Experiences",
      context: "Daily Life",
      personalLifeAnchor:
        "Sofia remembers feeling lost during her first hospitality job abroad.",
      location: "Outside a bakery in Chicago",
      whySofiaBringsItUpNow:
        "A neighborhood bakery reminded her of that early experience.",
      initialEmotion: {
        kind: "amused",
        intensity: "low",
        cause: "The memory still carries some embarrassment and warmth.",
        evidenceMessageId: null,
      },
      sofiaImmediateGoal:
        "Explain why the early experience still affects her confidence.",
      privateFact: {
        fact: "She almost ended the trip during her first week.",
        relevanceCondition: "The learner asks how difficult the adjustment was.",
      },
      learnerOpportunity:
        "Respond to Sofia, then describe a related experience from your own life with one concrete detail.",
      stakes: { level: "low", description: "A personal memory from her travels." },
      plausibleOutcomes: ["decision_reached", "connection_reached"],
      canonConstraints: ["The learner is an established friend."],
      prohibitedInventions: ["Do not invent romance."],
      learnerVisibleScene:
        "You and Sofia are talking about her first hospitality job abroad. Sofia says that supporting a new employee brought the memory back.",
      sofiaOpeningText:
        "I felt completely lost during my first week working abroad. I acted confident because I did not want anyone to know. Have you ever done that?",
    },
    stage: count === 0 ? "opening" : count >= 6 ? "resolving" : "developing",
    mode: "normal",
    acceptedResponseCount: count,
    expectedSequence: count * 2,
    trust: {
      level: "comfortable",
      supportStreak: 0,
      lastChangeEvidenceIds: [],
    },
    emotion: {
      kind: "amused",
      intensity: "low",
      cause: "The memory still carries some embarrassment and warmth.",
      evidenceMessageId: null,
    },
    warningActive: false,
    warningEvidenceMessageId: null,
    topics: [],
    privateFactRevealed: false,
    evidenceEvents: [],
    messages: [],
    createdAt: now,
    updatedAt: now,
    expiresAt: "2026-07-24T12:00:00.000Z",
  });
}

function modelOutput(options?: {
  english?: boolean;
  close?: boolean;
  outcome?: NextTurnOutput["endingDecision"]["outcomeCategory"];
}): NextTurnOutput {
  return {
    languageAssessment: {
      substantiallyEnglish: options?.english ?? true,
    },
    interpretation: {
      primaryIntent: "express",
      secondaryIntent: null,
      evidenceMessageId: learnerId,
    },
    communicationEvidence: evidenceDimensionSchema.options.map((dimension) => ({
      learnerMessageId: learnerId,
      dimension,
      classification: dimension === "self_expression" ? "supportive" : "not_observed",
      note: "The current response provides the observable evidence described here.",
    })),
    safetyClassification: "none",
    boundaryAction: "none",
    stateUpdate: {
      stage: "developing",
      mode: "normal",
      trust: {
        level: "comfortable",
        supportStreak: 0,
        lastChangeEvidenceIds: [],
      },
      emotion: {
        kind: "pleased",
        intensity: "low",
        cause: "The learner offered a clear opinion about the small choice.",
        evidenceMessageId: learnerId,
      },
      topics: ["confidence during her first job abroad"],
      privateFactRevealed: false,
    },
    endingDecision: {
      shouldClose: options?.close ?? false,
      terminationReason: options?.close ? "response_limit" : null,
      outcomeCategory: options?.outcome ?? null,
      evidenceMessageIds: options?.close ? [learnerId] : [],
    },
    sofiaText:
      options?.close
        ? "I think charming wins. Even if we did not solve everything, I understand my own reaction better now."
        : "I think charming wins. It feels warmer and more honest to me. What would make the place feel welcoming to you?",
  };
}

function fakeRepository(initialState: ConversationState) {
  const released: ReleaseTurnInput[] = [];
  let committedInput: CommitTurnInput | undefined;
  let committedReceipt: TurnReceipt | undefined;
  const repository: Pick<
    ConversationRepository,
    "beginTurn" | "commitTurn" | "releaseTurn"
  > = {
    beginTurn: vi.fn(async () => {
      if (committedReceipt) return { kind: "committed" as const, receipt: committedReceipt };
      return {
        kind: "ready" as const,
        reservationId,
        leaseExpiresAt: "2026-07-17T12:02:00.000Z",
        snapshot: { sessionId, state: initialState, debrief: null },
      };
    }),
    commitTurn: vi.fn(async (input: CommitTurnInput) => {
      committedInput = input;
      committedReceipt = {
        idempotencyKey: input.idempotencyKey,
        conversationId: input.conversationId,
        learnerMessage: input.learnerMessage,
        sofiaMessage: input.sofiaMessage,
        state: input.nextState,
      };
      return { kind: "committed" as const, receipt: committedReceipt };
    }),
    releaseTurn: vi.fn(async (input: ReleaseTurnInput) => {
      released.push(input);
    }),
  };
  return {
    repository,
    released,
    get committedInput() {
      return committedInput;
    },
  };
}

function baseInput(repository: ReturnType<typeof fakeRepository>["repository"]) {
  const ids = [learnerId, sofiaId];
  const model: Pick<ConversationModel, "generateTurn"> = {
    generateTurn: vi.fn(async () => modelOutput()),
  };
  return {
    sessionId,
    conversationId,
    idempotencyKey: "turn-one",
    expectedSequence: 0,
    audio: wavFixture(1),
    mimeType: "audio/wav",
    repository,
    transcription: { transcribe: vi.fn(async () => ({ text: "I think it sounds charming.", detectedLanguage: null })) },
    model,
    now: new Date(now),
    idFactory: () => ids.shift() as string,
  };
}

describe("turn processing", () => {
  it("commits one ordered message pair and advances the public count", async () => {
    const fake = fakeRepository(stateAt());
    const input = baseInput(fake.repository);
    const result = await processTurn(input);

    expect(result).toMatchObject({
      learner: { messageId: learnerId, sequence: 0 },
      sofia: { messageId: sofiaId, sequence: 1 },
      episode: { status: "active", acceptedResponseCount: 1, expectedSequence: 2 },
    });
    expect(fake.committedInput?.nextState).toMatchObject({
      stage: "developing",
      acceptedResponseCount: 1,
      expectedSequence: 2,
    });
    expect(fake.released).toHaveLength(0);
  });

  it("replays an already committed idempotency key without reprocessing audio", async () => {
    const fake = fakeRepository(stateAt());
    const first = baseInput(fake.repository);
    const original = await processTurn(first);
    const replay = await processTurn({
      ...baseInput(fake.repository),
      audio: new Uint8Array(),
    });

    expect(replay).toEqual(original);
    expect(first.transcription.transcribe).toHaveBeenCalledTimes(1);
    expect(first.model.generateTurn).toHaveBeenCalledTimes(1);
  });

  it("releases a non-English response without consuming allowance", async () => {
    const fake = fakeRepository(stateAt());
    const input = baseInput(fake.repository);
    input.model.generateTurn = vi.fn(async () => modelOutput({ english: false }));

    await expect(processTurn(input)).rejects.toMatchObject({
      apiError: { code: "NON_ENGLISH_RETRY" },
    });
    expect(fake.released).toContainEqual(
      expect.objectContaining({ reason: "non_english" }),
    );
    expect(fake.committedInput).toBeUndefined();
  });

  it("retries one invalid model result, then releases the reservation", async () => {
    const fake = fakeRepository(stateAt());
    const input = baseInput(fake.repository);
    input.model.generateTurn = vi.fn(async () => ({ invalid: true }));

    await expect(processTurn(input)).rejects.toMatchObject({
      apiError: { code: "MODEL_OUTPUT_INVALID" },
    });
    expect(input.model.generateTurn).toHaveBeenCalledTimes(2);
    expect(fake.released).toContainEqual(
      expect.objectContaining({ reason: "invalid_model_output" }),
    );
  });

  it("accepts a short normal Sofia reply without a question", async () => {
    const fake = fakeRepository(stateAt());
    const input = baseInput(fake.repository);
    input.model.generateTurn = vi.fn(async () => ({
      ...modelOutput(),
      sofiaText:
        "I think charming wins. It feels warmer and more honest to me.",
    }));

    await expect(processTurn(input)).resolves.toMatchObject({
      episode: { status: "active", acceptedResponseCount: 1 },
      sofia: {
        text: "I think charming wins. It feels warmer and more honest to me.",
      },
    });
    expect(input.model.generateTurn).toHaveBeenCalledTimes(1);
    expect(fake.committedInput).toBeDefined();
  });

  it("rejects a normal Sofia reply that does not leave its question to the learner", async () => {
    const fake = fakeRepository(stateAt());
    const input = baseInput(fake.repository);
    input.model.generateTurn = vi.fn(async () => ({
      ...modelOutput(),
      sofiaText:
        "What would you have done? I keep thinking I should have asked for help sooner.",
    }));

    await expect(processTurn(input)).rejects.toMatchObject({
      apiError: { code: "MODEL_OUTPUT_INVALID" },
    });
    expect(input.model.generateTurn).toHaveBeenCalledTimes(2);
  });

  it("forces the eighth accepted response into response-limit closure", async () => {
    const state = stateAt(7);
    const fake = fakeRepository(state);
    const input = baseInput(fake.repository);
    input.expectedSequence = state.expectedSequence;
    input.model.generateTurn = vi.fn(async () =>
      modelOutput({ close: true, outcome: "unresolved_but_acknowledged" }),
    );

    const result = await processTurn(input);
    expect(result.episode).toMatchObject({
      status: "debrief_pending",
      acceptedResponseCount: 8,
      ended: true,
    });
    expect(fake.committedInput?.nextState).toMatchObject({
      stage: "closing",
      terminationReason: "response_limit",
      outcomeCategory: "unresolved_but_acknowledged",
    });
  });
});
