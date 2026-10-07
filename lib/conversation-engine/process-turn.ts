import { randomUUID } from "node:crypto";

import {
  AudioValidationError,
  validateRecording,
} from "@/lib/audio/recording";
import {
  isNormalStageTransitionAllowed,
  reduceTrust,
  responseWindowAfterAcceptance,
  type TrustEvidence,
} from "@/lib/conversation-engine/transitions";
import type {
  ConversationRepository,
  ReleaseTurnInput,
  TurnReceipt,
} from "@/lib/persistence/conversation-repository";
import type {
  ConversationModel,
  TranscriptionProvider,
} from "@/lib/providers/contracts";
import { V1_RULES } from "@/lib/product-rules";
import {
  conversationStateSchema,
  nextTurnOutputSchema,
  transcriptMessageSchema,
  type ConversationState,
  type NextTurnOutput,
  type TranscriptMessage,
} from "@/lib/validation/conversation";
import type { ApiError } from "@/lib/validation/api-error";
import { turnResponseSchema, type TurnResponse } from "@/lib/validation/turn";

const MODEL_OUTPUT_ATTEMPTS = 2;

export class TurnProcessingError extends Error {
  constructor(
    readonly status: number,
    readonly apiError: Omit<ApiError, "requestId">,
  ) {
    super(apiError.message);
    this.name = "TurnProcessingError";
  }
}

function publicResponse(receipt: TurnReceipt): TurnResponse {
  const state = receipt.state;
  return turnResponseSchema.parse({
    conversationId: receipt.conversationId,
    learner: {
      messageId: receipt.learnerMessage.id,
      sequence: receipt.learnerMessage.sequence,
      text: receipt.learnerMessage.text,
    },
    sofia: {
      messageId: receipt.sofiaMessage.id,
      sequence: receipt.sofiaMessage.sequence,
      text: receipt.sofiaMessage.text,
    },
    episode: {
      status: state.status,
      acceptedResponseCount: state.acceptedResponseCount,
      maxAcceptedResponses: V1_RULES.maxAcceptedResponses,
      expectedSequence: state.expectedSequence,
      ended: state.status !== "active",
    },
    speechUrl: `/api/conversations/${receipt.conversationId}/messages/${receipt.sofiaMessage.id}/speech`,
  });
}

function releaseReasonForAudio(
  error: AudioValidationError,
): ReleaseTurnInput["reason"] {
  return ["empty", "unreadable", "too_short"].includes(error.code)
    ? "unclear_audio"
    : "invalid_audio";
}

function audioError(error: AudioValidationError): TurnProcessingError {
  const unclear = releaseReasonForAudio(error) === "unclear_audio";
  return new TurnProcessingError(422, {
    code: unclear ? "UNCLEAR_AUDIO" : "INVALID_AUDIO",
    message: unclear
      ? "We could not hear a clear response. Please record it again."
      : error.code === "too_long"
        ? `Keep each response under ${V1_RULES.maxRecordingSeconds} seconds.`
        : "That recording format or size is not supported. Please record it again.",
    retryable: true,
  });
}

function normalizeTranscript(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function validSofiaReply(output: NextTurnOutput): boolean {
  const words = wordCount(output.sofiaText);
  const sentences =
    output.sofiaText.match(/[.!?]+(?=\s|$)/g)?.length ?? 1;
  const questions = output.sofiaText.match(/\?/g)?.length ?? 0;
  const endsWithQuestion = output.sofiaText.trim().endsWith("?");
  const firmBoundary = ["warn", "end", "safety_stop"].includes(
    output.boundaryAction,
  );
  return (
    words <= 70 &&
    words >= (firmBoundary ? 3 : 8) &&
    sentences <= 4 &&
    questions <= 1 &&
    (questions === 0 || endsWithQuestion)
  );
}

function alignedTurnOutput(
  candidate: unknown,
  state: ConversationState,
  learnerMessage: TranscriptMessage,
): NextTurnOutput | null {
  const parsed = nextTurnOutputSchema.safeParse(candidate);
  if (!parsed.success) return null;
  const output = parsed.data;
  if (output.interpretation.evidenceMessageId !== learnerMessage.id) return null;
  if (
    output.communicationEvidence.some(
      (event) => event.learnerMessageId !== learnerMessage.id,
    )
  ) {
    return null;
  }
  const nextCount = state.acceptedResponseCount + 1;
  const boundaryViolation =
    output.safetyClassification === "boundary_violation";
  if (boundaryViolation) {
    const requiredAction = state.warningActive ? "end" : "warn";
    if (output.boundaryAction !== requiredAction) return null;
  } else if (["warn", "end"].includes(output.boundaryAction)) {
    return null;
  }
  if (
    output.safetyClassification === "safety_override" &&
    output.boundaryAction !== "safety_stop"
  ) {
    return null;
  }
  if (
    output.boundaryAction === "safety_stop" &&
    output.safetyClassification !== "safety_override"
  ) {
    return null;
  }
  const normalTurn = !boundaryViolation && output.boundaryAction !== "safety_stop";
  if (normalTurn && nextCount < 4 && output.endingDecision.shouldClose) {
    return null;
  }
  if (
    normalTurn &&
    nextCount === V1_RULES.maxAcceptedResponses &&
    (!output.endingDecision.shouldClose ||
      output.endingDecision.outcomeCategory === null)
  ) {
    return null;
  }
  return validSofiaReply(output) ? output : null;
}

async function generateValidatedTurn(input: {
  state: ConversationState;
  learnerMessage: TranscriptMessage;
  model: Pick<ConversationModel, "generateTurn">;
}): Promise<NextTurnOutput> {
  for (let attempt = 0; attempt < MODEL_OUTPUT_ATTEMPTS; attempt += 1) {
    let candidate: unknown;
    try {
      candidate = await input.model.generateTurn({
        state: input.state,
        learnerMessage: input.learnerMessage,
        repairAttempt: attempt === 1,
      });
    } catch {
      throw new TurnProcessingError(503, {
        code: "PROVIDER_UNAVAILABLE",
        message: "Sofia could not respond just now. Please try again.",
        retryable: true,
      });
    }
    const output = alignedTurnOutput(
      candidate,
      input.state,
      input.learnerMessage,
    );
    if (output) return output;
  }
  throw new TurnProcessingError(502, {
    code: "MODEL_OUTPUT_INVALID",
    message: "Sofia's response was not coherent enough to continue. Please try again.",
    retryable: true,
  });
}

function deriveTrustEvidence(output: NextTurnOutput): TrustEvidence {
  if (
    output.safetyClassification === "safety_override" ||
    output.boundaryAction === "safety_stop"
  ) {
    return "severe";
  }
  if (
    output.safetyClassification === "boundary_violation" ||
    output.communicationEvidence.some(
      (event) => event.classification === "concerning",
    )
  ) {
    return "clear_concern";
  }
  const repair = output.communicationEvidence.find(
    (event) => event.dimension === "repair_behavior",
  );
  if (
    output.interpretation.primaryIntent === "repair" &&
    repair?.classification === "supportive"
  ) {
    return "meaningful_repair";
  }
  const supportive = output.communicationEvidence.filter(
    (event) => event.classification === "supportive",
  ).length;
  return supportive >= 2 ? "supportive" : "none";
}

function deriveNextState(input: {
  state: ConversationState;
  learnerMessage: TranscriptMessage;
  sofiaMessage: TranscriptMessage;
  output: NextTurnOutput;
  now: string;
}): ConversationState {
  const { state, learnerMessage, sofiaMessage, output, now } = input;
  const acceptedResponseCount = state.acceptedResponseCount + 1;
  const window = responseWindowAfterAcceptance(acceptedResponseCount);
  const safetyStop =
    output.safetyClassification === "safety_override" ||
    output.boundaryAction === "safety_stop";
  const boundaryViolation =
    output.safetyClassification === "boundary_violation" ||
    output.boundaryAction === "warn" ||
    output.boundaryAction === "end";
  const boundaryEnd = boundaryViolation && state.warningActive;
  const firstWarning = boundaryViolation && !state.warningActive && !safetyStop;
  const normalClose =
    window === "must_close" ||
    (window === "outcome_eligible" &&
      output.endingDecision.shouldClose &&
      output.endingDecision.outcomeCategory !== null) ||
    (window === "closure_pressure" &&
      output.endingDecision.shouldClose &&
      output.endingDecision.outcomeCategory !== null);
  const terminal = safetyStop || boundaryEnd || normalClose;

  const trustTransition = reduceTrust({
    currentLevel: state.trust.level,
    supportStreak: state.trust.supportStreak as 0 | 1,
    evidence: deriveTrustEvidence(output),
  });
  const trustChanged = trustTransition.level !== state.trust.level;

  let stage = state.stage;
  if (terminal) {
    stage = "closing";
  } else if (state.stage === "opening") {
    stage = "developing";
  } else if (window === "closure_pressure") {
    stage = "resolving";
  } else if (
    output.stateUpdate.stage !== "closing" &&
    isNormalStageTransitionAllowed(state.stage, output.stateUpdate.stage)
  ) {
    stage = output.stateUpdate.stage;
  }

  const knownMessageIds = new Set([
    ...state.messages.map((message) => message.id),
    learnerMessage.id,
  ]);
  const proposedEvidenceId = output.stateUpdate.emotion.evidenceMessageId;
  const emotion = {
    ...output.stateUpdate.emotion,
    evidenceMessageId:
      proposedEvidenceId && knownMessageIds.has(proposedEvidenceId)
        ? proposedEvidenceId
        : learnerMessage.id,
  };
  const topics = Array.from(
    new Set([...state.topics, ...output.stateUpdate.topics]),
  ).slice(0, 12);

  let status: ConversationState["status"] = "active";
  let terminationReason: ConversationState["terminationReason"] = null;
  let outcomeCategory: ConversationState["outcomeCategory"] = null;
  if (safetyStop) {
    status = "ended";
    terminationReason = "safety_override";
    outcomeCategory = "safety_ended";
  } else if (boundaryEnd) {
    status = "ended";
    terminationReason = "boundary_repeat";
  } else if (normalClose) {
    status = "debrief_pending";
    terminationReason =
      window === "must_close" ? "response_limit" : "meaningful_outcome";
    outcomeCategory =
      output.endingDecision.outcomeCategory ?? "unresolved_but_acknowledged";
  }

  return conversationStateSchema.parse({
    ...state,
    status,
    terminationReason,
    outcomeCategory,
    stage,
    mode: firstWarning ? "repair" : output.stateUpdate.mode,
    acceptedResponseCount,
    expectedSequence: state.expectedSequence + 2,
    trust: {
      level: trustTransition.level,
      supportStreak: trustTransition.supportStreak,
      lastChangeEvidenceIds: trustChanged
        ? [learnerMessage.id]
        : state.trust.lastChangeEvidenceIds,
    },
    emotion,
    warningActive: firstWarning,
    warningEvidenceMessageId: firstWarning ? learnerMessage.id : null,
    topics,
    privateFactRevealed:
      state.privateFactRevealed || output.stateUpdate.privateFactRevealed,
    evidenceEvents: [...state.evidenceEvents, ...output.communicationEvidence],
    messages: [...state.messages, learnerMessage, sofiaMessage],
    updatedAt: now,
  });
}

function rejectedBeginError(reason: string): TurnProcessingError {
  if (reason === "not_found") {
    return new TurnProcessingError(404, {
      code: "UNAUTHORIZED_CONVERSATION",
      message: "This conversation is not available in your session.",
      retryable: false,
    });
  }
  if (reason === "stale_sequence") {
    return new TurnProcessingError(409, {
      code: "STALE_SEQUENCE",
      message: "The conversation advanced in another request. Refresh to continue.",
      retryable: false,
    });
  }
  if (reason === "allowance_exhausted") {
    return new TurnProcessingError(409, {
      code: "ALLOWANCE_EXHAUSTED",
      message: "This free episode has reached its eight-response limit.",
      retryable: false,
    });
  }
  return new TurnProcessingError(409, {
    code: "CONVERSATION_NOT_ACTIVE",
    message: "This conversation is no longer accepting responses.",
    retryable: false,
  });
}

export async function processTurn(input: {
  sessionId: string;
  conversationId: string;
  idempotencyKey: string;
  expectedSequence: number;
  audio: Uint8Array;
  mimeType: string;
  repository: Pick<
    ConversationRepository,
    "beginTurn" | "commitTurn" | "releaseTurn"
  >;
  transcription: TranscriptionProvider;
  model: Pick<ConversationModel, "generateTurn">;
  now?: Date;
  idFactory?: () => string;
}): Promise<TurnResponse> {
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const begin = await input.repository.beginTurn({
    sessionId: input.sessionId,
    conversationId: input.conversationId,
    idempotencyKey: input.idempotencyKey,
    expectedSequence: input.expectedSequence,
    now: nowIso,
  });

  if (begin.kind === "committed") return publicResponse(begin.receipt);
  if (begin.kind === "in_progress") {
    throw new TurnProcessingError(409, {
      code: "TURN_IN_PROGRESS",
      message: "This response is still being processed. Please try again in a moment.",
      retryable: true,
    });
  }
  if (begin.kind === "rejected") throw rejectedBeginError(begin.reason);

  const release = async (reason: ReleaseTurnInput["reason"]) => {
    await input.repository.releaseTurn({
      conversationId: input.conversationId,
      reservationId: begin.reservationId,
      idempotencyKey: input.idempotencyKey,
      reason,
    });
  };

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
    throw new TurnProcessingError(422, {
      code: "INVALID_AUDIO",
      message: "That recording could not be read. Please record it again.",
      retryable: true,
    });
  }

  let transcript: string;
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
    throw new TurnProcessingError(503, {
      code: "PROVIDER_UNAVAILABLE",
      message: "We could not transcribe your response. Please try again.",
      retryable: true,
    });
  }

  if (!transcript) {
    await release("unclear_audio");
    throw new TurnProcessingError(422, {
      code: "UNCLEAR_AUDIO",
      message: "We could not hear a clear response. Please record it again.",
      retryable: true,
    });
  }

  const idFactory = input.idFactory ?? randomUUID;
  const learnerMessage = transcriptMessageSchema.parse({
    id: idFactory(),
    role: "learner",
    sequence: input.expectedSequence,
    text: transcript,
    createdAt: nowIso,
  });

  let output: NextTurnOutput;
  try {
    output = await generateValidatedTurn({
      state: begin.snapshot.state,
      learnerMessage,
      model: input.model,
    });
  } catch (error) {
    await release(
      error instanceof TurnProcessingError &&
        error.apiError.code === "MODEL_OUTPUT_INVALID"
        ? "invalid_model_output"
        : "provider_failure",
    );
    throw error;
  }

  if (!output.languageAssessment.substantiallyEnglish) {
    await release("non_english");
    throw new TurnProcessingError(422, {
      code: "NON_ENGLISH_RETRY",
      message: "OpenlyTalk is English-only for now. Please try that response in English.",
      retryable: true,
    });
  }

  const sofiaMessage = transcriptMessageSchema.parse({
    id: idFactory(),
    role: "sofia",
    sequence: input.expectedSequence + 1,
    text: output.sofiaText,
    createdAt: nowIso,
  });
  const nextState = deriveNextState({
    state: begin.snapshot.state,
    learnerMessage,
    sofiaMessage,
    output,
    now: nowIso,
  });

  const committed = await input.repository.commitTurn({
    sessionId: input.sessionId,
    conversationId: input.conversationId,
    reservationId: begin.reservationId,
    idempotencyKey: input.idempotencyKey,
    expectedSequence: input.expectedSequence,
    learnerMessage,
    sofiaMessage,
    nextState,
  });
  if (committed.kind === "committed" || committed.kind === "duplicate") {
    return publicResponse(committed.receipt);
  }
  throw rejectedBeginError(committed.reason);
}
