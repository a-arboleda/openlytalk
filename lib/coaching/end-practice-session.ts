import {
  finalSessionTakeawaySchema,
  practiceSessionStateSchema,
  type FinalSessionTakeaway,
  type PracticeSessionState,
} from "@/lib/coaching/schemas";
import {
  completeTakeaway,
  endPractice,
} from "@/lib/coaching/transitions";
import { COACHING_BETA_RULES } from "@/lib/coaching/product-rules";
import {
  endPracticeResponseSchema,
  toPublicPracticeSession,
} from "@/lib/coaching/public-contracts";
import type { PracticeModel } from "@/lib/coaching/provider-contracts";
import type { PracticeRepository } from "@/lib/persistence/practice-repository";

const MODEL_OUTPUT_ATTEMPTS = 2;
const RETELL_SUPPORTING_SKILLS = new Set([
  "explaining_clearly",
  "expressing_yourself",
]);

type EndPracticeErrorCode =
  | "not_found"
  | "stale_state"
  | "practice_not_active"
  | "provider_unavailable"
  | "invalid_generated_output";

export class EndPracticeSessionError extends Error {
  constructor(
    readonly status: number,
    readonly apiError: {
      code: EndPracticeErrorCode;
      message: string;
      retryable: boolean;
    },
  ) {
    super(apiError.message);
    this.name = "EndPracticeSessionError";
  }
}

function nextTimestamp(currentUpdatedAt: string, requestedNow: Date): string {
  return new Date(
    Math.max(requestedNow.getTime(), Date.parse(currentUpdatedAt) + 1),
  ).toISOString();
}

function publicResponse(state: PracticeSessionState) {
  return endPracticeResponseSchema.parse({
    session: toPublicPracticeSession(state),
  });
}

function alignedPartialTakeaway(input: {
  candidate: unknown;
  state: PracticeSessionState;
}): FinalSessionTakeaway | null {
  const parsed = finalSessionTakeawaySchema.safeParse(input.candidate);
  if (!parsed.success || parsed.data.kind !== "partial") return null;

  const takeaway = parsed.data;
  const learnerMessageIds = new Set(
    input.state.messages
      .filter((message) => message.role === "learner")
      .map((message) => message.id),
  );
  const referencedIds =
    takeaway.flow === "continuous"
      ? [
          ...(takeaway.whatWorked?.evidenceMessageIds ?? []),
          ...takeaway.oneImprovement.evidenceMessageIds,
          ...takeaway.englishPolish.map((item) => item.learnerMessageId),
        ]
      : [
          ...takeaway.whatChanged.evidenceMessageIds,
          ...(takeaway.strongestMoment?.evidenceMessageIds ?? []),
          ...takeaway.englishPolish.map((item) => item.learnerMessageId),
        ];

  if (
    takeaway.flow !==
      (input.state.responseLimit < COACHING_BETA_RULES.maxAcceptedResponses
        ? "continuous"
        : "retry") ||
    referencedIds.some((id) => !learnerMessageIds.has(id)) ||
    (takeaway.optionalRetell !== null &&
      !RETELL_SUPPORTING_SKILLS.has(input.state.setup.primarySkill))
  ) {
    return null;
  }

  return takeaway;
}

async function generatePartialTakeaway(input: {
  state: PracticeSessionState;
  model: Pick<PracticeModel, "generateTakeaway">;
}): Promise<FinalSessionTakeaway> {
  for (let attempt = 0; attempt < MODEL_OUTPUT_ATTEMPTS; attempt += 1) {
    let candidate: unknown;
    try {
      candidate = await input.model.generateTakeaway({
        state: input.state,
        kind: "partial",
        repairAttempt: attempt === 1,
      });
    } catch {
      throw new EndPracticeSessionError(503, {
        code: "provider_unavailable",
        message:
          "Your partial takeaway could not be prepared. Please try again.",
        retryable: true,
      });
    }

    const takeaway = alignedPartialTakeaway({
      candidate,
      state: input.state,
    });
    if (takeaway) return takeaway;
  }

  throw new EndPracticeSessionError(502, {
    code: "invalid_generated_output",
    message:
      "Your partial takeaway could not be grounded clearly enough. Please try again.",
    retryable: true,
  });
}

async function latestUserExitState(input: {
  repository: Pick<PracticeRepository, "getPracticeSession">;
  anonymousSessionId: string;
  practiceSessionId: string;
  now: string;
}): Promise<PracticeSessionState | null> {
  const latest = await input.repository.getPracticeSession(input);
  const state = latest?.state ?? null;
  return state?.terminationReason === "user_exit" ? state : null;
}

export async function endPracticeSession(input: {
  anonymousSessionId: string;
  practiceSessionId: string;
  expectedUpdatedAt: string;
  repository: Pick<
    PracticeRepository,
    "getPracticeSession" | "savePracticeProgress"
  >;
  model: Pick<PracticeModel, "generateTakeaway">;
  now?: Date;
}) {
  const requestedNow = input.now ?? new Date();
  const now = requestedNow.toISOString();
  const snapshot = await input.repository.getPracticeSession({
    anonymousSessionId: input.anonymousSessionId,
    practiceSessionId: input.practiceSessionId,
    now,
  });
  if (!snapshot) {
    throw new EndPracticeSessionError(404, {
      code: "not_found",
      message: "This practice is no longer available.",
      retryable: false,
    });
  }

  let state = snapshot.state;
  if (
    state.terminationReason === "user_exit" &&
    (state.status === "ended" || state.status === "completed")
  ) {
    return publicResponse(state);
  }

  const alreadyPreparingPartial =
    state.status === "active" &&
    state.phase === "finalizing" &&
    state.terminationReason === "user_exit";

  if (!alreadyPreparingPartial) {
    if (state.status !== "active") {
      throw new EndPracticeSessionError(409, {
        code: "practice_not_active",
        message: "This practice has already finished.",
        retryable: false,
      });
    }
    if (state.updatedAt !== input.expectedUpdatedAt) {
      throw new EndPracticeSessionError(409, {
        code: "stale_state",
        message: "This practice changed. Refresh it and try again.",
        retryable: true,
      });
    }

    const transition = endPractice({
      state,
      substantiveResponseCount: state.acceptedResponseCount,
    });
    const nextState = practiceSessionStateSchema.parse({
      ...transition.state,
      updatedAt: nextTimestamp(state.updatedAt, requestedNow),
    });
    const saved = await input.repository.savePracticeProgress({
      anonymousSessionId: input.anonymousSessionId,
      practiceSessionId: input.practiceSessionId,
      expectedPhase: state.phase,
      expectedUpdatedAt: state.updatedAt,
      now,
      nextState,
    });

    if (saved.kind === "rejected") {
      if (saved.reason === "stale_state") {
        const latest = await latestUserExitState({
          repository: input.repository,
          anonymousSessionId: input.anonymousSessionId,
          practiceSessionId: input.practiceSessionId,
          now,
        });
        if (latest) state = latest;
        else {
          throw new EndPracticeSessionError(409, {
            code: "stale_state",
            message: "This practice changed. Refresh it and try again.",
            retryable: true,
          });
        }
      } else {
        throw new EndPracticeSessionError(
          saved.reason === "not_found" || saved.reason === "expired"
            ? 404
            : 409,
          {
            code:
              saved.reason === "not_found" || saved.reason === "expired"
                ? "not_found"
                : "practice_not_active",
            message:
              saved.reason === "not_found" || saved.reason === "expired"
                ? "This practice is no longer available."
                : "This practice cannot be ended from its current stage.",
            retryable: false,
          },
        );
      }
    } else {
      state = saved.snapshot.state;
    }

    if (!transition.shouldGeneratePartialTakeaway) {
      return publicResponse(state);
    }
  }

  if (state.status === "ended" || state.status === "completed") {
    return publicResponse(state);
  }
  if (
    state.phase !== "finalizing" ||
    state.terminationReason !== "user_exit"
  ) {
    throw new EndPracticeSessionError(409, {
      code: "practice_not_active",
      message: "This practice cannot prepare a partial takeaway.",
      retryable: false,
    });
  }

  const takeaway = await generatePartialTakeaway({
    state,
    model: input.model,
  });
  const completed = completeTakeaway({
    state,
    terminationReason: "user_exit",
  });
  const nextState = practiceSessionStateSchema.parse({
    ...completed,
    takeaway,
    updatedAt: nextTimestamp(state.updatedAt, requestedNow),
  });
  const saved = await input.repository.savePracticeProgress({
    anonymousSessionId: input.anonymousSessionId,
    practiceSessionId: input.practiceSessionId,
    expectedPhase: "finalizing",
    expectedUpdatedAt: state.updatedAt,
    now,
    nextState,
  });

  if (saved.kind === "saved" || saved.kind === "unchanged") {
    return publicResponse(saved.snapshot.state);
  }
  if (saved.reason === "stale_state") {
    const latest = await latestUserExitState({
      repository: input.repository,
      anonymousSessionId: input.anonymousSessionId,
      practiceSessionId: input.practiceSessionId,
      now,
    });
    if (
      latest?.status === "completed" ||
      latest?.status === "ended"
    ) {
      return publicResponse(latest);
    }
  }

  throw new EndPracticeSessionError(409, {
    code: "stale_state",
    message: "This practice changed. Refresh it and try again.",
    retryable: true,
  });
}
