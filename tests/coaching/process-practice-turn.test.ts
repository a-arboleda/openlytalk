import { describe, expect, it, vi } from "vitest";

import { buildDeterministicPracticePlan } from "@/lib/coaching/plan-builder";
import type { PracticeModel } from "@/lib/coaching/provider-contracts";
import {
  practiceSessionStateSchema,
  type PracticeMessage,
  type PracticeSessionState,
} from "@/lib/coaching/schemas";
import {
  processPracticeTurn,
} from "@/lib/coaching/process-practice-turn";
import { InMemoryPracticeRepository } from "@/lib/persistence/in-memory-practice-repository";
import { wavFixture } from "@/tests/helpers/audio";

const OWNER_ID = "10000000-0000-4000-8000-000000000001";
const PRACTICE_ID = "20000000-0000-4000-8000-000000000001";
const LEARNER_ID = "30000000-0000-4000-8000-000000000001";
const PARTNER_ID = "40000000-0000-4000-8000-000000000001";
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

function message(input: {
  id: string;
  role: "learner" | "partner";
  responseNumber: number | null;
  sequence: number;
  text: string;
}): PracticeMessage {
  return {
    id: input.id,
    role: input.role,
    phase: "initial_simulation",
    learnerResponseNumber: input.responseNumber,
    sequence: input.sequence,
    text: input.text,
    createdAt: CREATED_AT,
  };
}

function stateAt(
  acceptedResponseCount = 0,
  overrides: Partial<PracticeSessionState> = {},
): PracticeSessionState {
  const messages =
    acceptedResponseCount === 0
      ? []
      : [
          message({
            id: "50000000-0000-4000-8000-000000000001",
            role: "learner",
            responseNumber: 1,
            sequence: 0,
            text: "Could we move the deadline to Friday?",
          }),
          message({
            id: "60000000-0000-4000-8000-000000000001",
            role: "partner",
            responseNumber: null,
            sequence: 1,
            text: "What makes Friday a better deadline?",
          }),
          ...(acceptedResponseCount < 2
            ? []
            : [
                message({
                  id: "70000000-0000-4000-8000-000000000001",
                  role: "learner",
                  responseNumber: 2,
                  sequence: 2,
                  text: "It would give me time to check the final numbers.",
                }),
                message({
                  id: "80000000-0000-4000-8000-000000000001",
                  role: "partner",
                  responseNumber: null,
                  sequence: 3,
                  text: "That sounds reasonable. What can you finish today?",
                }),
              ]),
        ];

  return practiceSessionStateSchema.parse({
    schemaVersion: 3,
    practiceSessionId: PRACTICE_ID,
    anonymousSessionId: OWNER_ID,
    status: "active",
    phase: "initial_simulation",
    setup,
    plan: buildDeterministicPracticePlan(setup),
    acceptedResponseCount,
    expectedLearnerSequence: acceptedResponseCount,
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

function partnerOutput(input: {
  state: PracticeSessionState;
  learnerMessageId?: string;
  substantiallyEnglish?: boolean;
  safetyClassification?: "none" | "boundary_violation";
}) {
  const safetyClassification =
    input.safetyClassification ?? "none";
  return {
    partnerText:
      safetyClassification === "none"
        ? "I can work with that. What would you complete before Friday?"
        : "I need you to keep this conversation respectful before we continue.",
    evidenceEvents: [
      {
        id: `evidence-${input.learnerMessageId ?? LEARNER_ID}`,
        learnerMessageIds: [
          input.learnerMessageId ?? LEARNER_ID,
        ],
        dimension: input.state.plan.evidenceRubric.primaryDimensions[0],
        classification: "strength",
        observation: "The learner made a direct request.",
        setupRelevance: "The session focuses on making a clear request.",
      },
    ],
    challengeUpdate: "no_change",
    languageAssessment: {
      substantiallyEnglish: input.substantiallyEnglish ?? true,
    },
    retryAssessment: null,
    safetyClassification,
    boundaryAction:
      safetyClassification === "none" ? "none" : "warn",
  };
}

function targetedState(
  acceptedResponseCount: 3 | 4 = 3,
): PracticeSessionState {
  const initial = stateAt(2);
  const thirdLearnerId =
    "90000000-0000-4000-8000-000000000010";
  const thirdPartnerId =
    "90000000-0000-4000-8000-000000000011";
  const messages = [
    ...initial.messages,
    message({
      id: thirdLearnerId,
      role: "learner",
      responseNumber: 3,
      sequence: 4,
      text: "Could we move it to Friday so I can check the numbers?",
    }),
    message({
      id: thirdPartnerId,
      role: "partner",
      responseNumber: null,
      sequence: 5,
      text: "Yes, Friday works if you send me a short update today.",
    }),
  ];
  const fourthLearnerId =
    "90000000-0000-4000-8000-000000000012";
  const fourthPartnerId =
    "90000000-0000-4000-8000-000000000013";
  if (acceptedResponseCount === 4) {
    messages.push(
      {
        ...message({
          id: fourthLearnerId,
          role: "learner",
          responseNumber: 4,
          sequence: 6,
          text: "I can send the update by three this afternoon.",
        }),
        phase: "targeted_retry",
      },
      {
        ...message({
          id: fourthPartnerId,
          role: "partner",
          responseNumber: null,
          sequence: 7,
          text: "That helps. What will the update include?",
        }),
        phase: "targeted_retry",
      },
    );
  }

  return practiceSessionStateSchema.parse({
    ...initial,
    phase: "targeted_retry",
    acceptedResponseCount,
    expectedLearnerSequence: acceptedResponseCount,
    messages,
    coachingBreak: {
      whatWorked: {
        title: "A specific request",
        observation: "You named the deadline you needed.",
        evidenceMessageIds: [thirdLearnerId],
      },
      oneImprovement: {
        title: "Connect the reason",
        observation: "Give the request and reason together.",
        evidenceMessageIds: [thirdLearnerId],
      },
      tryItThisWay: {
        originalMeaning: "Move the deadline to Friday.",
        naturalExample:
          "Could we move it to Friday so I can check the final numbers?",
      },
      retryGoal: "State the request and reason together.",
      retryPrompt: "Ask for the deadline change again with your reason.",
      retryTargetMessageIds: [thirdLearnerId],
    },
    retryTarget: {
      learnerMessageIds: [thirdLearnerId],
      partnerMessageId: thirdPartnerId,
      prompt: "Ask for the deadline change again with your reason.",
      goal: "State the request and reason together.",
    },
    retryOutcome:
      acceptedResponseCount === 4
        ? {
            learnerMessageId: fourthLearnerId,
            application: "partly_applied",
            observation:
              "The learner made a clear commitment but needs one detail.",
          }
        : null,
  });
}

function fullTakeaway(input: {
  initialMessageId: string;
  retryMessageId: string;
}) {
  return {
    kind: "full",
    whatYouPracticed:
      "You practiced making a clear request and supporting it with a reason.",
    whatChanged: {
      initialObservation:
        "Your first request named the change you wanted.",
      retryObservation:
        "In the retry, you connected the request with a practical reason.",
      evidenceMessageIds: [
        input.initialMessageId,
        input.retryMessageId,
      ],
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

function baseInput(input: {
  state: PracticeSessionState;
  repository: InMemoryPracticeRepository;
  idempotencyKey?: string;
  ids?: string[];
}) {
  const ids = input.ids ?? [LEARNER_ID, PARTNER_ID];
  const model: Pick<
    PracticeModel,
    "generatePartnerTurn" | "generateCoachingBreak" | "generateTakeaway"
  > = {
    generatePartnerTurn: vi.fn(async () =>
      partnerOutput({ state: input.state }),
    ),
    generateCoachingBreak: vi.fn(),
    generateTakeaway: vi.fn(),
  };
  return {
    anonymousSessionId: OWNER_ID,
    practiceSessionId: PRACTICE_ID,
    idempotencyKey: input.idempotencyKey ?? "turn-one",
    expectedLearnerSequence: input.state.expectedLearnerSequence,
    audio: wavFixture(1),
    mimeType: "audio/wav",
    previewTranscript: undefined as string | undefined,
    repository: input.repository,
    transcription: {
      transcribe: vi.fn(async () => ({
        text: "Could we move the deadline to Friday?",
        detectedLanguage: null,
      })),
    },
    model,
    now: new Date("2026-07-27T12:00:01.000Z"),
    idFactory: () => ids.shift() as string,
  };
}

describe("practice turn processing", () => {
  it("commits one ordered learner-partner pair and returns autoplay audio", async () => {
    const state = stateAt();
    const repository = await repositoryWith(state);
    const input = baseInput({ state, repository });

    const result = await processPracticeTurn(input);

    expect(result).toMatchObject({
      session: {
        acceptedResponseCount: 1,
        expectedLearnerSequence: 1,
        phase: "initial_simulation",
      },
      acceptedMessages: [
        { id: LEARNER_ID, role: "learner", sequence: 0 },
        { id: PARTNER_ID, role: "partner", sequence: 1 },
      ],
      autoplaySpeechUrl: `/api/practice-sessions/${PRACTICE_ID}/messages/${PARTNER_ID}/speech`,
    });
    expect(
      (
        await repository.getPracticeSession({
          anonymousSessionId: OWNER_ID,
          practiceSessionId: PRACTICE_ID,
          now: "2026-07-27T12:00:02.000Z",
        })
      )?.state.messages,
    ).toHaveLength(2);
  });

  it("replays a committed idempotency key without touching the audio provider", async () => {
    const state = stateAt();
    const repository = await repositoryWith(state);
    const firstInput = baseInput({ state, repository });
    const first = await processPracticeTurn(firstInput);
    const replayInput = baseInput({
      state,
      repository,
      ids: [
        "90000000-0000-4000-8000-000000000001",
        "90000000-0000-4000-8000-000000000002",
      ],
    });
    replayInput.audio = new Uint8Array();

    await expect(processPracticeTurn(replayInput)).resolves.toEqual(first);
    expect(replayInput.transcription.transcribe).not.toHaveBeenCalled();
    expect(replayInput.model.generatePartnerTurn).not.toHaveBeenCalled();
  });

  it("releases a non-English response without consuming an opportunity", async () => {
    const state = stateAt();
    const repository = await repositoryWith(state);
    const input = baseInput({ state, repository });
    input.model.generatePartnerTurn = vi.fn(async () =>
      partnerOutput({
        state,
        substantiallyEnglish: false,
      }),
    );

    await expect(processPracticeTurn(input)).rejects.toMatchObject({
      apiError: { code: "non_english" },
    });
    expect(
      (
        await repository.getPracticeSession({
          anonymousSessionId: OWNER_ID,
          practiceSessionId: PRACTICE_ID,
          now: "2026-07-27T12:00:02.000Z",
        })
      )?.state.acceptedResponseCount,
    ).toBe(0);
  });

  it("atomically enters the coaching break after the third response", async () => {
    const state = stateAt(2);
    const repository = await repositoryWith(state);
    const currentLearnerId =
      "90000000-0000-4000-8000-000000000003";
    const currentPartnerId =
      "90000000-0000-4000-8000-000000000004";
    const input = baseInput({
      state,
      repository,
      idempotencyKey: "turn-three",
      ids: [currentLearnerId, currentPartnerId],
    });
    input.model.generatePartnerTurn = vi.fn(async () =>
      partnerOutput({
        state,
        learnerMessageId: currentLearnerId,
      }),
    );
    input.model.generateCoachingBreak = vi.fn(async () => ({
      whatWorked: {
        title: "A clear request",
        observation: "You asked directly for a specific change.",
        evidenceMessageIds: [currentLearnerId],
      },
      oneImprovement: {
        title: "Add the reason sooner",
        observation:
          "Connect the request and reason in the same response.",
        evidenceMessageIds: [currentLearnerId],
      },
      tryItThisWay: {
        originalMeaning: "Move the deadline to Friday.",
        naturalExample:
          "Could we move it to Friday so I can check the final numbers?",
      },
      retryGoal: "State the request and reason together.",
      retryPrompt:
        "Ask for the deadline change again and include your reason.",
      retryTargetMessageIds: [currentLearnerId],
    }));

    const result = await processPracticeTurn(input);

    expect(result.session).toMatchObject({
      acceptedResponseCount: 3,
      phase: "coaching_break",
      actions: { canRecord: false },
    });
    expect(result.session.coachingBreak).not.toBeNull();
    expect(result.session.retryTarget).toMatchObject({
      goal: "State the request and reason together.",
    });
  });

  it("closes a current practice after response two and generates only final feedback", async () => {
    const legacyState = stateAt(1);
    const state = practiceSessionStateSchema.parse({
      ...legacyState,
      schemaVersion: 5,
      responseLimit: 2,
    });
    const repository = await repositoryWith(state);
    const currentLearnerId =
      "90000000-0000-4000-8000-000000000060";
    const currentPartnerId =
      "90000000-0000-4000-8000-000000000061";
    const input = baseInput({
      state,
      repository,
      idempotencyKey: "continuous-second-response",
      ids: [currentLearnerId, currentPartnerId],
    });
    input.model.generatePartnerTurn = vi.fn(async () => ({
      ...partnerOutput({ state, learnerMessageId: currentLearnerId }),
      partnerText: "Thanks, that gives me a clear next step.",
    }));
    input.model.generateTakeaway = vi.fn(async () => ({
      flow: "continuous",
      kind: "full",
      whatYouPracticed:
        "You practiced making a clear request and supporting it with a reason.",
      whatWorked: {
        title: "A specific request",
        observation: "You named the deadline you needed.",
        evidenceMessageIds: [currentLearnerId],
      },
      oneImprovement: {
        title: "Add the reason sooner",
        observation: "Connect the request and reason in the same response.",
        evidenceMessageIds: [currentLearnerId],
      },
      naturalExample: {
        originalMeaning: "Move the deadline to Friday.",
        naturalExample:
          "Could we move it to Friday so I can check the final numbers?",
      },
      englishPolish: [],
      tryItInRealLife:
        "Use the same structure for one small request this week.",
      optionalRetell: null,
    }));

    const result = await processPracticeTurn(input);

    expect(result.session).toMatchObject({
      status: "completed",
      phase: "final_takeaway",
      acceptedResponseCount: 2,
      responseLimit: 2,
      remainingResponseCount: 0,
      coachingBreak: null,
      retryTarget: null,
      takeaway: { flow: "continuous" },
    });
    expect(input.model.generateCoachingBreak).not.toHaveBeenCalled();
    expect(result.acceptedMessages[1].text).not.toContain("?");
  });

  it("creates feedback directly after one reviewed spoken response", async () => {
    const legacyState = stateAt(0);
    const state = practiceSessionStateSchema.parse({
      ...legacyState,
      schemaVersion: 6,
      responseLimit: 1,
      plan: buildDeterministicPracticePlan(setup, {
        singlePrompt: true,
      }),
    });
    const repository = await repositoryWith(state);
    const input = baseInput({
      state,
      repository,
      idempotencyKey: "single-prompt-response",
      ids: [LEARNER_ID],
    });
    input.previewTranscript =
      "I would explain the change first, then ask what they think.";
    input.model.generateTakeaway = vi.fn(async () => ({
      flow: "continuous",
      kind: "full",
      whatYouPracticed: "You practiced explaining your response clearly.",
      whatWorked: {
        title: "A clear sequence",
        observation: "You used first and then to organize your idea.",
        evidenceMessageIds: [LEARNER_ID],
      },
      oneImprovement: {
        title: "Add one concrete detail",
        observation: "Name the change so the listener can picture it.",
        evidenceMessageIds: [LEARNER_ID],
      },
      naturalExample: {
        originalMeaning: "Explain the change and ask for their view.",
        naturalExample:
          "First, I’d explain what changed. Then I’d ask what they think.",
      },
      englishPolish: [],
      tryItInRealLife: "Use first and then in one explanation today.",
      optionalRetell: null,
    }));

    const result = await processPracticeTurn(input);

    expect(result.session).toMatchObject({
      experienceMode: "single_prompt",
      status: "completed",
      phase: "final_takeaway",
      responseLimit: 1,
      acceptedResponseCount: 1,
    });
    expect(result.acceptedMessages).toHaveLength(1);
    expect(result.autoplaySpeechUrl).toBeNull();
    expect(input.transcription.transcribe).not.toHaveBeenCalled();
    expect(input.model.generatePartnerTurn).not.toHaveBeenCalled();
    expect(input.model.generateTakeaway).toHaveBeenCalledOnce();
  });

  it("requires a relevant follow-up question after the first current response", async () => {
    const legacyState = stateAt(0);
    const state = practiceSessionStateSchema.parse({
      ...legacyState,
      schemaVersion: 5,
      responseLimit: 2,
    });
    const repository = await repositoryWith(state);
    const input = baseInput({
      state,
      repository,
      idempotencyKey: "current-first-response-without-follow-up",
    });
    input.model.generatePartnerTurn = vi.fn(async () => ({
      ...partnerOutput({ state }),
      partnerText: "I understand what you mean.",
    }));

    await expect(processPracticeTurn(input)).rejects.toMatchObject({
      apiError: { code: "invalid_generated_output" },
    });
    expect(input.model.generatePartnerTurn).toHaveBeenCalledTimes(2);
  });

  it("rejects a question after the second response in a current practice", async () => {
    const legacyState = stateAt(1);
    const state = practiceSessionStateSchema.parse({
      ...legacyState,
      schemaVersion: 5,
      responseLimit: 2,
    });
    const repository = await repositoryWith(state);
    const input = baseInput({
      state,
      repository,
      idempotencyKey: "current-terminal-question",
    });

    await expect(processPracticeTurn(input)).rejects.toMatchObject({
      apiError: { code: "invalid_generated_output" },
    });
    expect(input.model.generatePartnerTurn).toHaveBeenCalledTimes(2);
    expect(input.model.generateTakeaway).not.toHaveBeenCalled();
  });

  it("warns once and ends when a clear boundary is crossed again", async () => {
    const state = stateAt(1, {
      challengeState: {
        introduced: false,
        resolved: false,
        evidenceMessageIds: [],
        conductWarningActive: true,
        conductWarningEvidenceMessageId:
          "50000000-0000-4000-8000-000000000001",
      },
    });
    const repository = await repositoryWith(state);
    const input = baseInput({
      state,
      repository,
      idempotencyKey: "boundary-repeat",
    });
    input.model.generatePartnerTurn = vi.fn(async () =>
      partnerOutput({
        state,
        safetyClassification: "boundary_violation",
      }),
    );

    const result = await processPracticeTurn(input);

    expect(result.session).toMatchObject({
      status: "ended",
      acceptedResponseCount: 2,
      actions: { canRecord: false },
    });
    expect(result.acceptedMessages[1].text).toContain(
      "ending this practice",
    );
  });

  it("continues to a focused fifth response after a successful retry", async () => {
    const state = targetedState();
    const repository = await repositoryWith(state);
    const retryLearnerId =
      "90000000-0000-4000-8000-000000000020";
    const retryPartnerId =
      "90000000-0000-4000-8000-000000000021";
    const input = baseInput({
      state,
      repository,
      idempotencyKey: "targeted-retry",
      ids: [retryLearnerId, retryPartnerId],
    });
    input.model.generatePartnerTurn = vi.fn(async () => ({
      ...partnerOutput({
        state,
        learnerMessageId: retryLearnerId,
      }),
      partnerText:
        "That is clear. What update can you send today, and when will you send it?",
      retryAssessment: {
        application: "applied",
        observation:
          "The retry stated the request and connected it to a practical reason.",
        fifthResponseUseful: true,
        fifthResponseReason:
          "The final follow-up lets the learner make the next step specific.",
        followUpPrompt:
          "What update can you send today, and when will you send it?",
      },
    }));

    const result = await processPracticeTurn(input);

    expect(result.session).toMatchObject({
      status: "active",
      phase: "targeted_retry",
      acceptedResponseCount: 4,
      retryOutcome: {
        application: "applied",
      },
      retryTarget: {
        prompt:
          "What update can you send today, and when will you send it?",
      },
      actions: {
        canRecord: true,
      },
    });
    expect(input.model.generateTakeaway).not.toHaveBeenCalled();
  });

  it("rejects a fourth-response output that skips the final follow-up", async () => {
    const state = targetedState();
    const repository = await repositoryWith(state);
    const retryLearnerId =
      "90000000-0000-4000-8000-000000000030";
    const retryPartnerId =
      "90000000-0000-4000-8000-000000000031";
    const input = baseInput({
      state,
      repository,
      idempotencyKey: "missing-final-follow-up",
      ids: [retryLearnerId, retryPartnerId],
    });
    input.model.generatePartnerTurn = vi.fn(async () => ({
      ...partnerOutput({
        state,
        learnerMessageId: retryLearnerId,
      }),
      partnerText: "Thanks, that gives me a clear next step.",
      retryAssessment: {
        application: "applied",
        observation: "The learner made the request clearly.",
        fifthResponseUseful: false,
        fifthResponseReason: null,
        followUpPrompt: null,
      },
    }));

    await expect(processPracticeTurn(input)).rejects.toMatchObject({
      apiError: { code: "invalid_generated_output" },
    });
    expect(input.model.generatePartnerTurn).toHaveBeenCalledTimes(2);
    expect(input.model.generateTakeaway).not.toHaveBeenCalled();
    expect(
      (
        await repository.getPracticeSession({
          anonymousSessionId: OWNER_ID,
          practiceSessionId: PRACTICE_ID,
          now: "2026-07-27T12:00:02.000Z",
        })
      )?.state.acceptedResponseCount,
    ).toBe(3);
  });

  it("always finalizes after the fifth accepted response", async () => {
    const state = targetedState(4);
    const repository = await repositoryWith(state);
    const retryLearnerId =
      "90000000-0000-4000-8000-000000000040";
    const retryPartnerId =
      "90000000-0000-4000-8000-000000000041";
    const targetId = state.retryTarget?.learnerMessageIds[0] as string;
    const input = baseInput({
      state,
      repository,
      idempotencyKey: "fifth-response",
      ids: [retryLearnerId, retryPartnerId],
    });
    input.model.generatePartnerTurn = vi.fn(async () => ({
      ...partnerOutput({
        state,
        learnerMessageId: retryLearnerId,
      }),
      partnerText: "Thanks, that gives me a clear next step.",
      retryAssessment: {
        application: "applied",
        observation:
          "The learner added a specific update and delivery time.",
        fifthResponseUseful: false,
        fifthResponseReason: null,
        followUpPrompt: null,
      },
    }));
    input.model.generateTakeaway = vi.fn(async () =>
      fullTakeaway({
        initialMessageId: targetId,
        retryMessageId: retryLearnerId,
      }),
    );

    const result = await processPracticeTurn(input);

    expect(result.session).toMatchObject({
      status: "completed",
      phase: "final_takeaway",
      acceptedResponseCount: 5,
      remainingResponseCount: 0,
    });
  });

  it("rejects a fifth-response partner message that asks an unanswered question", async () => {
    const state = targetedState(4);
    const repository = await repositoryWith(state);
    const retryLearnerId =
      "90000000-0000-4000-8000-000000000045";
    const retryPartnerId =
      "90000000-0000-4000-8000-000000000046";
    const input = baseInput({
      state,
      repository,
      idempotencyKey: "terminal-question",
      ids: [retryLearnerId, retryPartnerId],
    });
    input.model.generatePartnerTurn = vi.fn(async () => ({
      ...partnerOutput({
        state,
        learnerMessageId: retryLearnerId,
      }),
      partnerText: "That sounds clear. What will you do next?",
      retryAssessment: {
        application: "applied",
        observation: "The learner added a concrete next step.",
        fifthResponseUseful: false,
        fifthResponseReason: null,
        followUpPrompt: null,
      },
    }));

    await expect(processPracticeTurn(input)).rejects.toMatchObject({
      apiError: { code: "invalid_generated_output" },
    });
    expect(input.model.generatePartnerTurn).toHaveBeenCalledTimes(2);
    expect(input.model.generateTakeaway).not.toHaveBeenCalled();
  });

  it("rejects a takeaway that does not compare the retry with its selected initial evidence", async () => {
    const state = targetedState(4);
    const repository = await repositoryWith(state);
    const retryLearnerId =
      "90000000-0000-4000-8000-000000000050";
    const retryPartnerId =
      "90000000-0000-4000-8000-000000000051";
    const input = baseInput({
      state,
      repository,
      idempotencyKey: "ungrounded-takeaway",
      ids: [retryLearnerId, retryPartnerId],
    });
    input.model.generatePartnerTurn = vi.fn(async () => ({
      ...partnerOutput({
        state,
        learnerMessageId: retryLearnerId,
      }),
      partnerText: "Thanks, that gives me a clear next step.",
      retryAssessment: {
        application: "applied",
        observation: "The learner connected the request and reason.",
        fifthResponseUseful: false,
        fifthResponseReason: null,
        followUpPrompt: null,
      },
    }));
    input.model.generateTakeaway = vi.fn(async () => ({
      ...fullTakeaway({
        initialMessageId: retryLearnerId,
        retryMessageId: retryLearnerId,
      }),
      whatChanged: {
        initialObservation: "Unsupported initial comparison.",
        retryObservation: "The retry was clearer.",
        evidenceMessageIds: [retryLearnerId],
      },
    }));

    await expect(processPracticeTurn(input)).rejects.toMatchObject({
      apiError: { code: "invalid_generated_output" },
    });
    expect(input.model.generateTakeaway).toHaveBeenCalledTimes(2);
    expect(
      (
        await repository.getPracticeSession({
          anonymousSessionId: OWNER_ID,
          practiceSessionId: PRACTICE_ID,
          now: "2026-07-27T12:00:02.000Z",
        })
      )?.state.acceptedResponseCount,
    ).toBe(4);
  });
});
