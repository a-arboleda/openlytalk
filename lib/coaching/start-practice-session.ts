import { randomUUID } from "node:crypto";

import {
  practiceSessionStateSchema,
  type PracticeMessage,
  type PracticeSessionState,
} from "@/lib/coaching/schemas";
import { startSimulation } from "@/lib/coaching/transitions";
import type { PracticeRepository } from "@/lib/persistence/practice-repository";
import { databaseIdSchema } from "@/lib/validation/persistence";

export class StartPracticeError extends Error {
  constructor(
    public readonly reason:
      | "not_found"
      | "practice_not_active"
      | "stale_state"
      | "invalid_transition",
  ) {
    super(`The practice could not start: ${reason}.`);
    this.name = "StartPracticeError";
  }
}

function nextTimestamp(currentUpdatedAt: string, requestedNow: Date): string {
  const currentTime = Date.parse(currentUpdatedAt);
  const requestedTime = requestedNow.getTime();
  return new Date(Math.max(requestedTime, currentTime + 1)).toISOString();
}

function openingMessage(input: {
  state: PracticeSessionState;
  createdAt: string;
  idFactory: () => string;
}): PracticeMessage | null {
  const opening = input.state.plan.opening;
  if (opening.speaker !== "partner" || opening.partnerOpeningText === null) {
    return null;
  }

  return {
    id: databaseIdSchema.parse(input.idFactory()),
    role: "partner",
    phase: "initial_simulation",
    learnerResponseNumber: null,
    sequence: input.state.messages.length,
    text: opening.partnerOpeningText,
    createdAt: input.createdAt,
  };
}

export async function startPracticeSession(input: {
  anonymousSessionId: string;
  practiceSessionId: string;
  expectedUpdatedAt: string;
  repository: Pick<
    PracticeRepository,
    "getPracticeSession" | "savePracticeProgress"
  >;
  now?: Date;
  idFactory?: () => string;
}): Promise<PracticeSessionState> {
  const anonymousSessionId = databaseIdSchema.parse(
    input.anonymousSessionId,
  );
  const practiceSessionId = databaseIdSchema.parse(
    input.practiceSessionId,
  );
  const now = input.now ?? new Date();
  if (Number.isNaN(now.getTime())) {
    throw new Error("Starting practice requires a valid current time.");
  }

  const snapshot = await input.repository.getPracticeSession({
    anonymousSessionId,
    practiceSessionId,
    now: now.toISOString(),
  });
  if (!snapshot) throw new StartPracticeError("not_found");

  const current = snapshot.state;
  if (
    current.status === "active" &&
    current.phase === "initial_simulation"
  ) {
    return current;
  }
  if (current.status !== "active" || current.phase !== "briefing") {
    throw new StartPracticeError("practice_not_active");
  }
  if (current.updatedAt !== input.expectedUpdatedAt) {
    throw new StartPracticeError("stale_state");
  }

  const transition = startSimulation(current);
  const updatedAt = nextTimestamp(current.updatedAt, now);
  const partnerOpening = openingMessage({
    state: current,
    createdAt: updatedAt,
    idFactory: input.idFactory ?? randomUUID,
  });
  const nextState = practiceSessionStateSchema.parse({
    ...current,
    ...transition,
    messages:
      partnerOpening === null
        ? current.messages
        : [...current.messages, partnerOpening],
    updatedAt,
  });
  const result = await input.repository.savePracticeProgress({
    anonymousSessionId,
    practiceSessionId,
    expectedPhase: "briefing",
    expectedUpdatedAt: current.updatedAt,
    now: updatedAt,
    nextState,
  });

  if (result.kind === "saved" || result.kind === "unchanged") {
    return result.snapshot.state;
  }
  if (result.reason === "not_found" || result.reason === "expired") {
    throw new StartPracticeError("not_found");
  }
  if (result.reason === "stale_state") {
    throw new StartPracticeError("stale_state");
  }
  throw new StartPracticeError("invalid_transition");
}
