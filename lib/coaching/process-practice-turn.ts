import { randomUUID } from "node:crypto";

import {
  AudioValidationError,
  validateRecording,
} from "@/lib/audio/recording";
import {
  COACHING_BETA_RULES,
  type EvidenceDimension,
} from "@/lib/coaching/product-rules";
import type {
  PracticeModel,
  PracticeTranscriptionProvider,
} from "@/lib/coaching/provider-contracts";
import {
  coachingBreakSchema,
  finalSessionTakeawaySchema,
  partnerTurnOutputSchema,
  practiceMessageSchema,
  practiceSessionStateSchema,
  type CoachingBreak,
  type FinalSessionTakeaway,
  type PartnerTurnOutput,
  type PracticeMessage,
  type PracticeSessionState,
  type RetryOutcome,
} from "@/lib/coaching/schemas";
import { completeTakeaway } from "@/lib/coaching/transitions";
import {
  practiceTurnResponseSchema,
  toPublicPracticeSession,
  type PracticeTurnResponse,
} from "@/lib/coaching/public-contracts";
import type {
  PracticeRepository,
  PracticeTurnReceipt,
  ReleasePracticeTurnInput,
} from "@/lib/persistence/practice-repository";
import { databaseIdSchema } from "@/lib/validation/persistence";

const MODEL_OUTPUT_ATTEMPTS = 2;

type PracticeTurnErrorCode =
  | "not_found"
  | "expired"
  | "stale_state"
  | "operation_in_progress"
  | "allowance_exhausted"
  | "invalid_audio"
  | "unclear_audio"
  | "non_english"
  | "provider_unavailable"
  | "invalid_generated_output"
  | "practice_not_active"
  | "phase_not_available";

export class PracticeTurnProcessingError extends Error {
  constructor(
    readonly status: number,
    readonly apiError: {
      code: PracticeTurnErrorCode;
      message: string;
      retryable: boolean;
    },
  ) {
    super(apiError.message);
    this.name = "PracticeTurnProcessingError";
  }
}

function publicResponse(receipt: PracticeTurnReceipt): PracticeTurnResponse {
  const session = toPublicPracticeSession(receipt.state);
  const acceptedIds = new Set(
    receipt.acceptedMessages.map((message) => message.id),
  );
  const acceptedMessages = session.messages.filter((message) =>
    acceptedIds.has(message.id),
  );
  const partnerMessage = [...acceptedMessages]
    .reverse()
    .find((message) => message.role === "partner");

  return practiceTurnResponseSchema.parse({
    session,
    acceptedMessages,
    autoplaySpeechUrl: partnerMessage?.speechUrl ?? null,
  });
}

function rejectedTurnError(reason: string): PracticeTurnProcessingError {
  switch (reason) {
    case "not_found":
      return new PracticeTurnProcessingError(404, {
        code: "not_found",
        message:
          "This practice may have expired or belongs to another session.",
        retryable: false,
      });
    case "expired":
      return new PracticeTurnProcessingError(404, {
        code: "expired",
        message: "This practice has expired. Create a new one to continue.",
        retryable: false,
      });
    case "stale_sequence":
    case "reservation_lost":
      return new PracticeTurnProcessingError(409, {
        code: "stale_state",
        message:
          "This practice changed in another request. Refresh it to continue.",
        retryable: true,
      });
    case "allowance_exhausted":
      return new PracticeTurnProcessingError(409, {
        code: "allowance_exhausted",
        message: "This practice has reached its response limit.",
        retryable: false,
      });
    case "phase_not_accepting_audio":
      return new PracticeTurnProcessingError(409, {
        code: "phase_not_available",
        message: "Audio is not available at this stage of the practice.",
        retryable: false,
      });
    default:
      return new PracticeTurnProcessingError(409, {
        code: "practice_not_active",
        message: "This practice is no longer accepting responses.",
        retryable: false,
      });
  }
}

function releaseReasonForAudio(
  error: AudioValidationError,
): ReleasePracticeTurnInput["reason"] {
  return ["empty", "unreadable", "too_short"].includes(error.code)
    ? "unclear_audio"
    : "invalid_audio";
}

function audioError(
  error: AudioValidationError,
): PracticeTurnProcessingError {
  const unclear = releaseReasonForAudio(error) === "unclear_audio";
  return new PracticeTurnProcessingError(422, {
    code: unclear ? "unclear_audio" : "invalid_audio",
    message: unclear
      ? "We could not hear a clear response. Please record it again."
      : error.code === "too_long"
        ? `Keep each response under ${COACHING_BETA_RULES.maxRecordingSeconds} seconds.`
        : "That recording format or size is not supported. Please record it again.",
    retryable: true,
  });
}

function normalizeTranscript(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function nextTimestamp(currentUpdatedAt: string, requestedNow: Date): string {
  return new Date(
    Math.max(requestedNow.getTime(), Date.parse(currentUpdatedAt) + 1),
  ).toISOString();
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function allowedEvidenceDimensions(
  state: PracticeSessionState,
): Set<EvidenceDimension> {
  return new Set([
    ...state.plan.evidenceRubric.primaryDimensions,
    ...(state.plan.evidenceRubric.supportingDimension === null
      ? []
      : [state.plan.evidenceRubric.supportingDimension]),
  ]);
}

function validPartnerText(output: PartnerTurnOutput): boolean {
  const words = wordCount(output.partnerText);
  const sentences =
    output.partnerText.match(/[.!?]+(?=\s|$)/g)?.length ?? 1;
  const questions = output.partnerText.match(/\?/g)?.length ?? 0;
  const boundary = output.safetyClassification !== "none";

  return (
    words >= (boundary ? 3 : 4) &&
    words <= 75 &&
    sentences <= 3 &&
    questions <= 1
  );
}

function alignedPartnerOutput(input: {
  candidate: unknown;
  state: PracticeSessionState;
  learnerMessage: PracticeMessage;
}): PartnerTurnOutput | null {
  const parsed = partnerTurnOutputSchema.safeParse(input.candidate);
  if (!parsed.success) return null;
  const output = parsed.data;
  const allowedDimensions = allowedEvidenceDimensions(input.state);

  if (
    !validPartnerText(output) ||
    output.evidenceEvents.some(
      (event) =>
        event.learnerMessageIds.length !== 1 ||
        event.learnerMessageIds[0] !== input.learnerMessage.id ||
        !allowedDimensions.has(event.dimension),
    )
  ) {
    return null;
  }

  const safetyPairIsValid =
    (output.safetyClassification === "none" &&
      output.boundaryAction === "none") ||
    (output.safetyClassification === "boundary_violation" &&
      output.boundaryAction === "warn") ||
    (output.safetyClassification === "safety_override" &&
      output.boundaryAction === "safety_stop");
  if (!safetyPairIsValid) return null;

  const ordinaryTurn = output.safetyClassification === "none";
  if (
    (input.state.phase === "initial_simulation" &&
      output.retryAssessment !== null) ||
    (input.state.phase === "targeted_retry" &&
      ordinaryTurn &&
      output.retryAssessment === null) ||
    (!ordinaryTurn && output.retryAssessment !== null)
  ) {
    return null;
  }
  const isContinuousFlow =
    input.state.responseLimit < COACHING_BETA_RULES.maxAcceptedResponses;
  const isFinalContinuousResponse =
    isContinuousFlow &&
    input.state.acceptedResponseCount + 1 === input.state.responseLimit;
  const isFirstCurrentResponse =
    input.state.schemaVersion === 5 &&
    input.state.acceptedResponseCount === 0;
  if (
    isFirstCurrentResponse &&
    ordinaryTurn &&
    !output.partnerText.includes("?")
  ) {
    return null;
  }
  if (
    isFinalContinuousResponse &&
    ordinaryTurn &&
    output.partnerText.includes("?")
  ) {
    return null;
  }
  if (
    input.state.phase === "targeted_retry" &&
    input.state.acceptedResponseCount === 3 &&
    ordinaryTurn &&
    (output.retryAssessment?.fifthResponseUseful !== true ||
      output.retryAssessment.followUpPrompt === null ||
      !output.retryAssessment.followUpPrompt.endsWith("?") ||
      !output.partnerText.endsWith(
        output.retryAssessment.followUpPrompt,
      ))
  ) {
    return null;
  }
  if (
    input.state.phase === "targeted_retry" &&
    input.state.acceptedResponseCount === 4 &&
    ordinaryTurn &&
    (output.retryAssessment?.fifthResponseUseful !== false ||
      output.partnerText.includes("?"))
  ) {
    return null;
  }

  if (
    output.challengeUpdate === "introduced" &&
    (input.state.challengeState.introduced ||
      input.state.challengeState.resolved)
  ) {
    return null;
  }
  if (
    output.challengeUpdate === "resolved" &&
    (!input.state.challengeState.introduced ||
      input.state.challengeState.resolved)
  ) {
    return null;
  }

  return output;
}

async function generatePartnerOutput(input: {
  state: PracticeSessionState;
  learnerMessage: PracticeMessage;
  model: Pick<PracticeModel, "generatePartnerTurn">;
}): Promise<PartnerTurnOutput> {
  for (let attempt = 0; attempt < MODEL_OUTPUT_ATTEMPTS; attempt += 1) {
    let candidate: unknown;
    try {
      candidate = await input.model.generatePartnerTurn({
        state: input.state,
        learnerMessage: input.learnerMessage,
        repairAttempt: attempt === 1,
      });
    } catch {
      throw new PracticeTurnProcessingError(503, {
        code: "provider_unavailable",
        message:
          "The practice partner could not respond just now. Please try again.",
        retryable: true,
      });
    }
    const output = alignedPartnerOutput({
      candidate,
      state: input.state,
      learnerMessage: input.learnerMessage,
    });
    if (output) return output;
  }

  throw new PracticeTurnProcessingError(502, {
    code: "invalid_generated_output",
    message:
      "The partner response was not coherent enough to continue. Please try again.",
    retryable: true,
  });
}

function alignedCoachingBreak(input: {
  candidate: unknown;
  learnerMessageIds: Set<string>;
}): CoachingBreak | null {
  const parsed = coachingBreakSchema.safeParse(input.candidate);
  if (!parsed.success) return null;
  const coaching = parsed.data;
  const referencedIds = [
    ...(coaching.whatWorked?.evidenceMessageIds ?? []),
    ...coaching.oneImprovement.evidenceMessageIds,
    ...coaching.retryTargetMessageIds,
  ];
  return referencedIds.every((id) => input.learnerMessageIds.has(id))
    ? coaching
    : null;
}

async function generateCoachingBreak(input: {
  state: PracticeSessionState;
  learnerMessage: PracticeMessage;
  partnerMessage: PracticeMessage;
  output: PartnerTurnOutput;
  model: Pick<PracticeModel, "generateCoachingBreak">;
}): Promise<CoachingBreak> {
  const learnerMessageIds = new Set([
    ...input.state.messages
      .filter((message) => message.role === "learner")
      .map((message) => message.id),
    input.learnerMessage.id,
  ]);

  for (let attempt = 0; attempt < MODEL_OUTPUT_ATTEMPTS; attempt += 1) {
    let candidate: unknown;
    try {
      candidate = await input.model.generateCoachingBreak({
        state: input.state,
        acceptedLearnerMessage: input.learnerMessage,
        partnerMessage: input.partnerMessage,
        evidenceEvents: input.output.evidenceEvents,
        repairAttempt: attempt === 1,
      });
    } catch {
      throw new PracticeTurnProcessingError(503, {
        code: "provider_unavailable",
        message: "Your coaching could not be prepared. Please try again.",
        retryable: true,
      });
    }
    const coaching = alignedCoachingBreak({
      candidate,
      learnerMessageIds,
    });
    if (coaching) return coaching;
  }

  throw new PracticeTurnProcessingError(502, {
    code: "invalid_generated_output",
    message:
      "Your coaching could not be prepared clearly enough. Please try again.",
    retryable: true,
  });
}

const RETELL_SUPPORTING_SKILLS = new Set([
  "explaining_clearly",
  "expressing_yourself",
]);

function alignedTakeaway(input: {
  candidate: unknown;
  state: PracticeSessionState;
  currentMessageId: string;
}): FinalSessionTakeaway | null {
  const parsed = finalSessionTakeawaySchema.safeParse(input.candidate);
  if (!parsed.success || parsed.data.kind !== "full") return null;
  const takeaway = parsed.data;
  const learnerMessageIds = new Set(
    input.state.messages
      .filter((message) => message.role === "learner")
      .map((message) => message.id),
  );
  if (
    input.state.responseLimit < COACHING_BETA_RULES.maxAcceptedResponses
  ) {
    if (takeaway.flow !== "continuous") return null;
    const referencedIds = [
      ...(takeaway.whatWorked?.evidenceMessageIds ?? []),
      ...takeaway.oneImprovement.evidenceMessageIds,
      ...takeaway.englishPolish.map((item) => item.learnerMessageId),
    ];
    return referencedIds.some((id) => !learnerMessageIds.has(id)) ||
      (input.state.schemaVersion === 6 &&
        takeaway.optionalRetell !== null) ||
      (takeaway.optionalRetell !== null &&
        !RETELL_SUPPORTING_SKILLS.has(input.state.setup.primarySkill))
      ? null
      : takeaway;
  }
  if (takeaway.flow !== "retry") return null;
  const targetIds = input.state.retryTarget?.learnerMessageIds ?? [];
  const comparisonIds = takeaway.whatChanged.evidenceMessageIds;
  const allReferences = [
    ...comparisonIds,
    ...(takeaway.strongestMoment?.evidenceMessageIds ?? []),
    ...takeaway.englishPolish.map((item) => item.learnerMessageId),
  ];
  if (
    !comparisonIds.includes(input.currentMessageId) ||
    !targetIds.some((id) => comparisonIds.includes(id)) ||
    allReferences.some((id) => !learnerMessageIds.has(id)) ||
    (takeaway.optionalRetell !== null &&
      !RETELL_SUPPORTING_SKILLS.has(input.state.setup.primarySkill))
  ) {
    return null;
  }
  return takeaway;
}

async function generateTakeaway(input: {
  state: PracticeSessionState;
  currentMessageId: string;
  model: Pick<PracticeModel, "generateTakeaway">;
}): Promise<FinalSessionTakeaway> {
  for (let attempt = 0; attempt < MODEL_OUTPUT_ATTEMPTS; attempt += 1) {
    let candidate: unknown;
    try {
      candidate = await input.model.generateTakeaway({
        state: input.state,
        kind: "full",
        repairAttempt: attempt === 1,
      });
    } catch {
      throw new PracticeTurnProcessingError(503, {
        code: "provider_unavailable",
        message:
          "Your final takeaway could not be prepared. Please try again.",
        retryable: true,
      });
    }
    const takeaway = alignedTakeaway({
      candidate,
      state: input.state,
      currentMessageId: input.currentMessageId,
    });
    if (takeaway) return takeaway;
  }
  throw new PracticeTurnProcessingError(502, {
    code: "invalid_generated_output",
    message:
      "Your final takeaway could not be grounded clearly enough. Please try again.",
    retryable: true,
  });
}

function deriveNextState(input: {
  state: PracticeSessionState;
  learnerMessage: PracticeMessage;
  partnerMessage: PracticeMessage;
  output: PartnerTurnOutput;
  coachingBreak: CoachingBreak | null;
  retryOutcome: RetryOutcome | null;
  now: string;
}): PracticeSessionState {
  const {
    state,
    learnerMessage,
    partnerMessage,
    output,
    coachingBreak,
    retryOutcome,
    now,
  } = input;
  const nextCount = state.acceptedResponseCount + 1;
  const safetyStop = output.safetyClassification === "safety_override";
  const boundaryViolation =
    output.safetyClassification === "boundary_violation";
  const repeatedBoundary =
    boundaryViolation && state.challengeState.conductWarningActive;
  const firstBoundary = boundaryViolation && !repeatedBoundary;
  const terminal = safetyStop || repeatedBoundary;

  const challengeEvidenceMessageIds =
    output.challengeUpdate === "no_change"
      ? state.challengeState.evidenceMessageIds
      : Array.from(
          new Set([
            ...state.challengeState.evidenceMessageIds,
            learnerMessage.id,
          ]),
        ).slice(-4);
  const challengeState = {
    introduced:
      state.challengeState.introduced ||
      output.challengeUpdate === "introduced",
    resolved:
      state.challengeState.resolved ||
      output.challengeUpdate === "resolved",
    evidenceMessageIds: challengeEvidenceMessageIds,
    conductWarningActive:
      firstBoundary ||
      (state.challengeState.conductWarningActive && !terminal),
    conductWarningEvidenceMessageId: firstBoundary
      ? learnerMessage.id
      : terminal
        ? null
        : state.challengeState.conductWarningEvidenceMessageId,
  };

  let phase = state.phase;
  let status = state.status;
  let terminationReason = state.terminationReason;
  let retryTarget = state.retryTarget;
  if (safetyStop) {
    status = "ended";
    terminationReason = "safety_override";
  } else if (repeatedBoundary) {
    status = "ended";
    terminationReason = "boundary_repeat";
  } else if (
    state.responseLimit < COACHING_BETA_RULES.maxAcceptedResponses &&
    state.phase === "initial_simulation" &&
    nextCount === state.responseLimit
  ) {
    phase = "finalizing";
  } else if (
    state.phase === "initial_simulation" &&
    nextCount === 3 &&
    coachingBreak !== null
  ) {
    phase = "coaching_break";
    retryTarget = {
      learnerMessageIds: coachingBreak.retryTargetMessageIds,
      partnerMessageId: partnerMessage.id,
      prompt: coachingBreak.retryPrompt,
      goal: coachingBreak.retryGoal,
    };
  } else if (state.phase === "targeted_retry") {
    if (nextCount === state.responseLimit) {
      phase = "finalizing";
      if (output.safetyClassification === "boundary_violation") {
        status = "ended";
        terminationReason = "response_limit";
      }
    } else if (output.retryAssessment?.followUpPrompt) {
      retryTarget = {
        ...(state.retryTarget as NonNullable<
          PracticeSessionState["retryTarget"]
        >),
        partnerMessageId: partnerMessage.id,
        prompt: output.retryAssessment.followUpPrompt,
      };
    }
  }

  return practiceSessionStateSchema.parse({
    ...state,
    status,
    phase,
    acceptedResponseCount: nextCount,
    expectedLearnerSequence: state.expectedLearnerSequence + 1,
    messages: [
      ...state.messages,
      learnerMessage,
      partnerMessage,
    ],
    evidenceEvents: [
      ...state.evidenceEvents,
      ...output.evidenceEvents,
    ],
    challengeState,
    coachingBreak: coachingBreak ?? state.coachingBreak,
    retryTarget,
    retryOutcome: retryOutcome ?? state.retryOutcome,
    terminationReason,
    updatedAt: now,
  });
}

export async function processPracticeTurn(input: {
  anonymousSessionId: string;
  practiceSessionId: string;
  idempotencyKey: string;
  expectedLearnerSequence: number;
  audio: Uint8Array;
  mimeType: string;
  previewTranscript?: string;
  repository: Pick<
    PracticeRepository,
    "beginPracticeTurn" | "commitPracticeTurn" | "releasePracticeTurn"
  >;
  transcription: PracticeTranscriptionProvider;
  model: Pick<
    PracticeModel,
    "generatePartnerTurn" | "generateCoachingBreak" | "generateTakeaway"
  >;
  now?: Date;
  idFactory?: () => string;
}): Promise<PracticeTurnResponse> {
  const requestedNow = input.now ?? new Date();
  const begin = await input.repository.beginPracticeTurn({
    anonymousSessionId: input.anonymousSessionId,
    practiceSessionId: input.practiceSessionId,
    idempotencyKey: input.idempotencyKey,
    expectedLearnerSequence: input.expectedLearnerSequence,
    now: requestedNow.toISOString(),
  });

  if (begin.kind === "committed") return publicResponse(begin.receipt);
  if (begin.kind === "in_progress") {
    throw new PracticeTurnProcessingError(409, {
      code: "operation_in_progress",
      message:
        "This response is still being processed. Please try again in a moment.",
      retryable: true,
    });
  }
  if (begin.kind === "rejected") throw rejectedTurnError(begin.reason);

  const release = async (
    reason: ReleasePracticeTurnInput["reason"],
  ): Promise<void> => {
    try {
      await input.repository.releasePracticeTurn({
        practiceSessionId: input.practiceSessionId,
        reservationId: begin.reservationId,
        idempotencyKey: input.idempotencyKey,
        reason,
      });
    } catch {
      // Preserve the learner-facing retry error if releasing the lease fails.
    }
  };

  const state = begin.snapshot.state;
  const acceptsInitialResponse =
    state.phase === "initial_simulation" &&
    state.acceptedResponseCount <
      Math.min(3, state.responseLimit);
  const acceptsRetryResponse =
    state.phase === "targeted_retry" &&
    [3, 4].includes(state.acceptedResponseCount);
  if (!acceptsInitialResponse && !acceptsRetryResponse) {
    await release("provider_failure");
    throw new PracticeTurnProcessingError(409, {
      code: "phase_not_available",
      message: "This voice step is not available at the current stage yet.",
      retryable: false,
    });
  }

  let recording: Awaited<ReturnType<typeof validateRecording>>;
  try {
    recording = await validateRecording({
      audio: input.audio,
      mimeType: input.mimeType,
    });
  } catch (error) {
    if (error instanceof AudioValidationError) {
      await release(releaseReasonForAudio(error));
      throw audioError(error);
    }
    await release("invalid_audio");
    throw new PracticeTurnProcessingError(422, {
      code: "invalid_audio",
      message: "That recording could not be read. Please record it again.",
      retryable: true,
    });
  }

  let transcript = input.previewTranscript
    ? normalizeTranscript(input.previewTranscript)
    : "";
  if (!transcript) {
    try {
      const result = await input.transcription.transcribe({
        audio: input.audio,
        mimeType: input.mimeType,
        language: "en",
        filename: recording.filename,
      });
      transcript = normalizeTranscript(result.text);
    } catch {
      await release("provider_failure");
      throw new PracticeTurnProcessingError(503, {
        code: "provider_unavailable",
        message: "We could not transcribe your response. Please try again.",
        retryable: true,
      });
    }
  }
  if (!transcript) {
    await release("unclear_audio");
    throw new PracticeTurnProcessingError(422, {
      code: "unclear_audio",
      message: "We could not hear a clear response. Please record it again.",
      retryable: true,
    });
  }

  const idFactory = input.idFactory ?? randomUUID;
  const now = nextTimestamp(state.updatedAt, requestedNow);
  const nextSequence = state.messages.at(-1)?.sequence ?? -1;
  const learnerMessage = practiceMessageSchema.parse({
    id: databaseIdSchema.parse(idFactory()),
    role: "learner",
    phase: state.phase,
    learnerResponseNumber: state.acceptedResponseCount + 1,
    sequence: nextSequence + 1,
    text: transcript,
    createdAt: now,
  });

  if (state.schemaVersion === 6) {
    let nextState = practiceSessionStateSchema.parse({
      ...state,
      phase: "finalizing",
      acceptedResponseCount: 1,
      expectedLearnerSequence: state.expectedLearnerSequence + 1,
      messages: [...state.messages, learnerMessage],
      updatedAt: now,
    });

    let takeaway: FinalSessionTakeaway;
    try {
      takeaway = await generateTakeaway({
        state: nextState,
        currentMessageId: learnerMessage.id,
        model: input.model,
      });
    } catch (error) {
      await release(
        error instanceof PracticeTurnProcessingError &&
          error.apiError.code === "invalid_generated_output"
          ? "invalid_model_output"
          : "provider_failure",
      );
      throw error;
    }

    const transition = completeTakeaway({
      state: nextState,
      terminationReason: "response_limit",
    });
    nextState = practiceSessionStateSchema.parse({
      ...nextState,
      ...transition,
      takeaway,
    });

    const committed = await input.repository.commitPracticeTurn({
      anonymousSessionId: input.anonymousSessionId,
      practiceSessionId: input.practiceSessionId,
      reservationId: begin.reservationId,
      idempotencyKey: input.idempotencyKey,
      expectedLearnerSequence: input.expectedLearnerSequence,
      acceptedMessages: [learnerMessage],
      nextState,
    });
    if (
      committed.kind === "committed" ||
      committed.kind === "duplicate"
    ) {
      return publicResponse(committed.receipt);
    }
    throw rejectedTurnError(committed.reason);
  }

  let output: PartnerTurnOutput;
  try {
    output = await generatePartnerOutput({
      state,
      learnerMessage,
      model: input.model,
    });
  } catch (error) {
    await release(
      error instanceof PracticeTurnProcessingError &&
        error.apiError.code === "invalid_generated_output"
        ? "invalid_model_output"
        : "provider_failure",
    );
    throw error;
  }
  if (!output.languageAssessment.substantiallyEnglish) {
    await release("non_english");
    throw new PracticeTurnProcessingError(422, {
      code: "non_english",
      message:
        "OpenlyTalk is English-only for now. Please try that response in English.",
      retryable: true,
    });
  }

  const repeatedBoundary =
    output.safetyClassification === "boundary_violation" &&
    state.challengeState.conductWarningActive;
  const partnerText = repeatedBoundary
    ? "I’m ending this practice here because that boundary was crossed again."
    : output.partnerText;
  const partnerMessage = practiceMessageSchema.parse({
    id: databaseIdSchema.parse(idFactory()),
    role: "partner",
    phase: state.phase,
    learnerResponseNumber: null,
    sequence: nextSequence + 2,
    text: partnerText,
    createdAt: now,
  });

  let coachingBreak: CoachingBreak | null = null;
  if (
    state.responseLimit === COACHING_BETA_RULES.maxAcceptedResponses &&
    state.acceptedResponseCount + 1 === 3 &&
    output.safetyClassification !== "safety_override" &&
    !repeatedBoundary
  ) {
    try {
      coachingBreak = await generateCoachingBreak({
        state,
        learnerMessage,
        partnerMessage,
        output,
        model: input.model,
      });
    } catch (error) {
      await release(
        error instanceof PracticeTurnProcessingError &&
          error.apiError.code === "invalid_generated_output"
          ? "invalid_model_output"
          : "provider_failure",
      );
      throw error;
    }
  }

  const retryOutcome: RetryOutcome | null =
    state.phase === "targeted_retry" && output.retryAssessment !== null
      ? {
          learnerMessageId: learnerMessage.id,
          application: output.retryAssessment.application,
          observation: output.retryAssessment.observation,
        }
      : null;
  let nextState = deriveNextState({
    state,
    learnerMessage,
    partnerMessage,
    output,
    coachingBreak,
    retryOutcome,
    now,
  });

  if (
    nextState.status === "active" &&
    nextState.phase === "finalizing"
  ) {
    let takeaway: FinalSessionTakeaway;
    try {
      takeaway = await generateTakeaway({
        state: nextState,
        currentMessageId: learnerMessage.id,
        model: input.model,
      });
    } catch (error) {
      await release(
        error instanceof PracticeTurnProcessingError &&
          error.apiError.code === "invalid_generated_output"
          ? "invalid_model_output"
          : "provider_failure",
      );
      throw error;
    }
    const transition = completeTakeaway({
      state: nextState,
      terminationReason:
        nextState.acceptedResponseCount === nextState.responseLimit
          ? "response_limit"
          : "practice_completed",
    });
    nextState = practiceSessionStateSchema.parse({
      ...nextState,
      ...transition,
      takeaway,
    });
  }
  const committed = await input.repository.commitPracticeTurn({
    anonymousSessionId: input.anonymousSessionId,
    practiceSessionId: input.practiceSessionId,
    reservationId: begin.reservationId,
    idempotencyKey: input.idempotencyKey,
    expectedLearnerSequence: input.expectedLearnerSequence,
    acceptedMessages: [learnerMessage, partnerMessage],
    nextState,
  });
  if (
    committed.kind === "committed" ||
    committed.kind === "duplicate"
  ) {
    return publicResponse(committed.receipt);
  }
  throw rejectedTurnError(committed.reason);
}
