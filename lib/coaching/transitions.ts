import { COACHING_BETA_RULES } from "@/lib/coaching/product-rules";
import type {
  SessionPhase,
  SessionStatus,
  TerminationReason,
} from "@/lib/coaching/schemas";

export type SessionTransitionState = {
  status: SessionStatus;
  phase: SessionPhase;
  acceptedResponseCount: number;
  responseLimit?: number;
  terminationReason: TerminationReason | null;
};

export type AcceptedResponseTransition = {
  nextPhase: SessionPhase;
  shouldGenerateCoachingBreak: boolean;
  shouldGenerateTakeaway: boolean;
  usesFinalFollowUp: boolean;
};

function assertResponseCount(count: number): void {
  if (
    !Number.isInteger(count) ||
    count < 0 ||
    count > COACHING_BETA_RULES.maxAcceptedResponses
  ) {
    throw new Error(
      `Accepted learner response count must be between 0 and ${COACHING_BETA_RULES.maxAcceptedResponses}.`,
    );
  }
}

export function remainingLearnerResponses(
  acceptedResponseCount: number,
  responseLimit: number = COACHING_BETA_RULES.maxAcceptedResponses,
): number {
  assertResponseCount(acceptedResponseCount);
  return Math.max(0, responseLimit - acceptedResponseCount);
}

export function canAcceptLearnerResponse(
  state: Pick<
    SessionTransitionState,
    "status" | "phase" | "acceptedResponseCount" | "responseLimit"
  >,
): boolean {
  return (
    state.status === "active" &&
    ["initial_simulation", "targeted_retry"].includes(state.phase) &&
    state.acceptedResponseCount <
      (state.responseLimit ?? COACHING_BETA_RULES.maxAcceptedResponses)
  );
}

export function canRequestHelp(
  state: Pick<SessionTransitionState, "status" | "phase">,
): boolean {
  return (
    state.status === "active" &&
    ["initial_simulation", "targeted_retry"].includes(state.phase)
  );
}

export function startSimulation(
  state: SessionTransitionState,
): SessionTransitionState {
  if (
    state.status !== "active" ||
    state.phase !== "briefing" ||
    state.acceptedResponseCount !== 0 ||
    state.terminationReason !== null
  ) {
    throw new Error(
      "Only a new active briefing can start the simulation.",
    );
  }

  return {
    ...state,
    phase: "initial_simulation",
  };
}

export function afterAcceptedLearnerResponse(input: {
  currentPhase: Extract<
    SessionPhase,
    "initial_simulation" | "targeted_retry"
  >;
  acceptedResponseCount: number;
  responseLimit?: number;
}): AcceptedResponseTransition {
  assertResponseCount(input.acceptedResponseCount);
  const responseLimit =
    input.responseLimit ?? COACHING_BETA_RULES.maxAcceptedResponses;

  if (input.currentPhase === "initial_simulation") {
    if (input.acceptedResponseCount < Math.min(3, responseLimit)) {
      return {
        nextPhase: "initial_simulation",
        shouldGenerateCoachingBreak: false,
        shouldGenerateTakeaway: false,
        usesFinalFollowUp: false,
      };
    }

    if (input.acceptedResponseCount === Math.min(3, responseLimit)) {
      if (responseLimit < COACHING_BETA_RULES.maxAcceptedResponses) {
        return {
          nextPhase: "finalizing",
          shouldGenerateCoachingBreak: false,
          shouldGenerateTakeaway: true,
          usesFinalFollowUp: false,
        };
      }
      return {
        nextPhase: "coaching_break",
        shouldGenerateCoachingBreak: true,
        shouldGenerateTakeaway: false,
        usesFinalFollowUp: false,
      };
    }

    throw new Error(
      `The initial simulation accepts learner responses one through ${Math.min(3, responseLimit)}.`,
    );
  }

  if (input.acceptedResponseCount === 4) {
    return {
      nextPhase: "targeted_retry",
      shouldGenerateCoachingBreak: false,
      shouldGenerateTakeaway: false,
      usesFinalFollowUp: true,
    };
  }

  if (input.acceptedResponseCount === 5) {
    return {
      nextPhase: "finalizing",
      shouldGenerateCoachingBreak: false,
      shouldGenerateTakeaway: true,
      usesFinalFollowUp: true,
    };
  }

  throw new Error(
    "The targeted retry accepts learner responses four and five.",
  );
}

export function beginTargetedRetry(
  state: SessionTransitionState,
): SessionTransitionState {
  if (
    state.status !== "active" ||
    state.phase !== "coaching_break" ||
    state.acceptedResponseCount !== 3 ||
    state.terminationReason !== null
  ) {
    throw new Error(
      "The targeted retry can begin only after the three-response coaching break.",
    );
  }

  return {
    ...state,
    phase: "targeted_retry",
  };
}

export function endPractice(input: {
  state: SessionTransitionState;
  substantiveResponseCount: number;
}): {
  state: SessionTransitionState;
  shouldGeneratePartialTakeaway: boolean;
} {
  if (!Number.isInteger(input.substantiveResponseCount)) {
    throw new Error("Substantive response count must be an integer.");
  }
  if (
    input.substantiveResponseCount < 0 ||
    input.substantiveResponseCount > input.state.acceptedResponseCount
  ) {
    throw new Error(
      "Substantive response count must fit within the accepted responses.",
    );
  }

  if (input.state.status !== "active") {
    return {
      state: input.state,
      shouldGeneratePartialTakeaway: false,
    };
  }

  if (input.substantiveResponseCount >= 2) {
    return {
      state: {
        ...input.state,
        phase: "finalizing",
        terminationReason: "user_exit",
      },
      shouldGeneratePartialTakeaway: true,
    };
  }

  return {
    state: {
      ...input.state,
      status: "ended",
      terminationReason: "user_exit",
    },
    shouldGeneratePartialTakeaway: false,
  };
}

export function completeTakeaway(input: {
  state: SessionTransitionState;
  terminationReason?: Extract<
    TerminationReason,
    "practice_completed" | "response_limit" | "user_exit"
  >;
}): SessionTransitionState {
  if (
    input.state.status !== "active" ||
    input.state.phase !== "finalizing"
  ) {
    throw new Error(
      "A takeaway can complete only while an active session is finalizing.",
    );
  }

  const terminationReason =
    input.terminationReason ??
    input.state.terminationReason ??
    (input.state.acceptedResponseCount ===
    (input.state.responseLimit ?? COACHING_BETA_RULES.maxAcceptedResponses)
      ? "response_limit"
      : "practice_completed");

  if (
    !["practice_completed", "response_limit", "user_exit"].includes(
      terminationReason,
    )
  ) {
    throw new Error(
      "A normal takeaway cannot complete a conduct or safety ending.",
    );
  }

  return {
    ...input.state,
    status: "completed",
    phase: "final_takeaway",
    terminationReason,
  };
}
