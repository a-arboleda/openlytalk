import { randomUUID } from "node:crypto";

import {
  practiceHelpResponseSchema,
  toPublicPracticeSession,
  type PracticeHelpResponse,
} from "@/lib/coaching/public-contracts";
import type { PracticeModel } from "@/lib/coaching/provider-contracts";
import {
  helpResponseSchema,
  practiceSessionStateSchema,
  type HelpResponse,
  type HelpType,
  type PracticeSessionState,
} from "@/lib/coaching/schemas";
import { canRequestHelp } from "@/lib/coaching/transitions";
import type { PracticeRepository } from "@/lib/persistence/practice-repository";
import { databaseIdSchema } from "@/lib/validation/persistence";

const MODEL_OUTPUT_ATTEMPTS = 2;

type PracticeHelpErrorCode =
  | "not_found"
  | "expired"
  | "stale_state"
  | "provider_unavailable"
  | "persistence_unavailable"
  | "invalid_generated_output"
  | "practice_not_active"
  | "phase_not_available"
  | "invalid_request";

export class PracticeHelpError extends Error {
  constructor(
    readonly status: number,
    readonly apiError: {
      code: PracticeHelpErrorCode;
      message: string;
      retryable: boolean;
    },
  ) {
    super(apiError.message);
    this.name = "PracticeHelpError";
  }
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function nextTimestamp(currentUpdatedAt: string, requestedNow: Date): string {
  return new Date(
    Math.max(requestedNow.getTime(), Date.parse(currentUpdatedAt) + 1),
  ).toISOString();
}

function latestPartnerMessageId(
  state: PracticeSessionState,
): string | null {
  return (
    [...state.messages]
      .reverse()
      .find((message) => message.role === "partner")?.id ?? null
  );
}

function alignedHelpResponse(input: {
  candidate: unknown;
  type: HelpType;
  state: PracticeSessionState;
  relatedPartnerMessageId: string | null;
}): HelpResponse | null {
  const parsed = helpResponseSchema.safeParse(input.candidate);
  if (!parsed.success) return null;
  const response = {
    ...parsed.data,
    coachText: normalizeText(parsed.data.coachText),
  };
  const maxWordsByType: Record<HelpType, number> = {
    repeat_rephrase: 55,
    starting_phrase: 35,
    organize: 65,
    forgot_word: 60,
  };

  if (
    response.type !== input.type ||
    response.resumesPhase !== input.state.phase ||
    response.relatedPartnerMessageId !==
      input.relatedPartnerMessageId ||
    wordCount(response.coachText) > maxWordsByType[input.type]
  ) {
    return null;
  }
  return response;
}

async function generateHelp(input: {
  state: PracticeSessionState;
  type: HelpType;
  currentPartnerMessageId: string | null;
  model: Pick<PracticeModel, "generateHelp">;
}): Promise<HelpResponse> {
  for (let attempt = 0; attempt < MODEL_OUTPUT_ATTEMPTS; attempt += 1) {
    let candidate: unknown;
    try {
      candidate = await input.model.generateHelp({
        state: input.state,
        type: input.type,
        currentPartnerMessageId: input.currentPartnerMessageId,
        repairAttempt: attempt === 1,
      });
    } catch {
      throw new PracticeHelpError(503, {
        code: "provider_unavailable",
        message: "Your coach could not prepare that help. Please try again.",
        retryable: true,
      });
    }
    const response = alignedHelpResponse({
      candidate,
      type: input.type,
      state: input.state,
      relatedPartnerMessageId: input.currentPartnerMessageId,
    });
    if (response) return response;
  }

  throw new PracticeHelpError(502, {
    code: "invalid_generated_output",
    message:
      "Your coach could not prepare a small enough hint. Please try again.",
    retryable: true,
  });
}

export async function requestPracticeHelp(input: {
  anonymousSessionId: string;
  practiceSessionId: string;
  type: HelpType;
  currentPartnerMessageId: string | null;
  expectedLearnerSequence: number;
  expectedUpdatedAt: string;
  repository: Pick<
    PracticeRepository,
    "getPracticeSession" | "savePracticeProgress"
  >;
  model: Pick<PracticeModel, "generateHelp">;
  now?: Date;
  idFactory?: () => string;
}): Promise<PracticeHelpResponse> {
  const requestedNow = input.now ?? new Date();
  const snapshot = await input.repository.getPracticeSession({
    anonymousSessionId: databaseIdSchema.parse(
      input.anonymousSessionId,
    ),
    practiceSessionId: databaseIdSchema.parse(
      input.practiceSessionId,
    ),
    now: requestedNow.toISOString(),
  });
  if (!snapshot) {
    throw new PracticeHelpError(404, {
      code: "not_found",
      message:
        "This practice may have expired or belongs to another session.",
      retryable: false,
    });
  }

  const state = snapshot.state;
  if (state.status !== "active") {
    throw new PracticeHelpError(409, {
      code: "practice_not_active",
      message: "This practice is no longer accepting help requests.",
      retryable: false,
    });
  }
  if (!canRequestHelp(state)) {
    throw new PracticeHelpError(409, {
      code: "phase_not_available",
      message: "Help is available while you are preparing a response.",
      retryable: false,
    });
  }
  if (
    state.expectedLearnerSequence !== input.expectedLearnerSequence ||
    state.updatedAt !== input.expectedUpdatedAt
  ) {
    throw new PracticeHelpError(409, {
      code: "stale_state",
      message: "This practice changed. Refresh it and ask for help again.",
      retryable: true,
    });
  }

  const latestPartnerId = latestPartnerMessageId(state);
  if (
    input.currentPartnerMessageId !== null &&
    input.currentPartnerMessageId !== latestPartnerId
  ) {
    throw new PracticeHelpError(400, {
      code: "invalid_request",
      message: "Choose help for the current speaking moment.",
      retryable: false,
    });
  }
  const currentPartnerMessageId =
    input.currentPartnerMessageId ?? latestPartnerId;
  const help = await generateHelp({
    state,
    type: input.type,
    currentPartnerMessageId,
    model: input.model,
  });
  const updatedAt = nextTimestamp(state.updatedAt, requestedNow);
  const nextState = practiceSessionStateSchema.parse({
    ...state,
    helpEvents: [
      ...state.helpEvents,
      {
        id: databaseIdSchema.parse(
          (input.idFactory ?? randomUUID)(),
        ),
        type: input.type,
        phase: state.phase,
        relatedPartnerMessageId: currentPartnerMessageId,
        createdAt: updatedAt,
      },
    ],
    updatedAt,
  });
  const saved = await input.repository.savePracticeProgress({
    anonymousSessionId: state.anonymousSessionId,
    practiceSessionId: state.practiceSessionId,
    expectedPhase: state.phase,
    expectedUpdatedAt: state.updatedAt,
    now: updatedAt,
    nextState,
  });
  if (saved.kind === "rejected") {
    if (
      saved.reason === "not_found" ||
      saved.reason === "expired"
    ) {
      throw new PracticeHelpError(404, {
        code: saved.reason,
        message:
          saved.reason === "expired"
            ? "This practice has expired. Create a new one to continue."
            : "This practice is no longer available.",
        retryable: false,
      });
    }
    if (saved.reason === "stale_state") {
      throw new PracticeHelpError(409, {
        code: "stale_state",
        message: "This practice changed. Ask for help again.",
        retryable: true,
      });
    }
    throw new PracticeHelpError(503, {
      code: "persistence_unavailable",
      message: "We could not save this help request. Please try again.",
      retryable: true,
    });
  }

  return practiceHelpResponseSchema.parse({
    session: toPublicPracticeSession(saved.snapshot.state),
    help: {
      type: help.type,
      coachLabel: "Your coach",
      coachText: help.coachText,
    },
  });
}
