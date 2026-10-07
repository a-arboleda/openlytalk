import {
  practiceSessionStateSchema,
  type PracticeSessionState,
} from "@/lib/coaching/schemas";
import { beginTargetedRetry } from "@/lib/coaching/transitions";
import type { PracticeRepository } from "@/lib/persistence/practice-repository";
import { databaseIdSchema } from "@/lib/validation/persistence";

export class BeginTargetedRetryError extends Error {
  constructor(
    public readonly reason:
      | "not_found"
      | "practice_not_active"
      | "stale_state"
      | "invalid_transition",
  ) {
    super(`The targeted retry could not begin: ${reason}.`);
    this.name = "BeginTargetedRetryError";
  }
}

function nextTimestamp(currentUpdatedAt: string, requestedNow: Date): string {
  return new Date(
    Math.max(requestedNow.getTime(), Date.parse(currentUpdatedAt) + 1),
  ).toISOString();
}

export async function beginPracticeTargetedRetry(input: {
  anonymousSessionId: string;
  practiceSessionId: string;
  expectedUpdatedAt: string;
  repository: Pick<
    PracticeRepository,
    "getPracticeSession" | "savePracticeProgress"
  >;
  now?: Date;
}): Promise<PracticeSessionState> {
  const anonymousSessionId = databaseIdSchema.parse(
    input.anonymousSessionId,
  );
  const practiceSessionId = databaseIdSchema.parse(
    input.practiceSessionId,
  );
  const now = input.now ?? new Date();
  const snapshot = await input.repository.getPracticeSession({
    anonymousSessionId,
    practiceSessionId,
    now: now.toISOString(),
  });
  if (!snapshot) throw new BeginTargetedRetryError("not_found");

  const current = snapshot.state;
  if (
    current.status === "active" &&
    current.phase === "targeted_retry"
  ) {
    return current;
  }
  if (
    current.status !== "active" ||
    current.phase !== "coaching_break"
  ) {
    throw new BeginTargetedRetryError("practice_not_active");
  }
  if (current.updatedAt !== input.expectedUpdatedAt) {
    throw new BeginTargetedRetryError("stale_state");
  }

  const transition = beginTargetedRetry(current);
  const updatedAt = nextTimestamp(current.updatedAt, now);
  const nextState = practiceSessionStateSchema.parse({
    ...current,
    ...transition,
    updatedAt,
  });
  const saved = await input.repository.savePracticeProgress({
    anonymousSessionId,
    practiceSessionId,
    expectedPhase: "coaching_break",
    expectedUpdatedAt: current.updatedAt,
    now: updatedAt,
    nextState,
  });
  if (saved.kind === "saved" || saved.kind === "unchanged") {
    return saved.snapshot.state;
  }
  if (saved.reason === "not_found" || saved.reason === "expired") {
    throw new BeginTargetedRetryError("not_found");
  }
  if (saved.reason === "stale_state") {
    throw new BeginTargetedRetryError("stale_state");
  }
  throw new BeginTargetedRetryError("invalid_transition");
}
