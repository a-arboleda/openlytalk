import { generatePracticePlan } from "@/lib/coaching/create-practice-session";
import type { PracticeModel } from "@/lib/coaching/provider-contracts";
import {
  practiceSessionStateSchema,
  type PracticeSessionState,
} from "@/lib/coaching/schemas";
import type { PracticeRepository } from "@/lib/persistence/practice-repository";
import {
  databaseIdSchema,
  idempotencyKeySchema,
} from "@/lib/validation/persistence";

export class ReplacePracticeSituationError extends Error {
  constructor(
    public readonly reason:
      | "not_found"
      | "stale_state"
      | "phase_not_available"
      | "replacement_limit"
      | "invalid_generated_output"
      | "persistence_unavailable",
  ) {
    super(`The practice situation could not be replaced: ${reason}.`);
    this.name = "ReplacePracticeSituationError";
  }
}

function nextTimestamp(currentUpdatedAt: string, requestedNow: Date): string {
  return new Date(
    Math.max(requestedNow.getTime(), Date.parse(currentUpdatedAt) + 1),
  ).toISOString();
}

function uniqueSituations(situations: readonly string[]): string[] {
  return [...new Set(situations.map((value) => value.trim()).filter(Boolean))]
    .slice(0, 10);
}

export async function replacePracticeSituation(input: {
  anonymousSessionId: string;
  practiceSessionId: string;
  idempotencyKey: string;
  expectedUpdatedAt: string;
  model: Pick<PracticeModel, "generatePlan">;
  repository: Pick<
    PracticeRepository,
    | "getPracticeSession"
    | "lookupPracticeSession"
    | "listRecentPracticeSituations"
    | "savePracticeProgress"
  >;
  now?: Date;
}): Promise<PracticeSessionState> {
  const anonymousSessionId = databaseIdSchema.parse(
    input.anonymousSessionId,
  );
  const practiceSessionId = databaseIdSchema.parse(input.practiceSessionId);
  const idempotencyKey = idempotencyKeySchema.parse(input.idempotencyKey);
  const now = input.now ?? new Date();
  if (Number.isNaN(now.getTime())) {
    throw new Error("Replacing a situation requires a valid current time.");
  }

  let snapshot;
  try {
    snapshot = await input.repository.getPracticeSession({
      anonymousSessionId,
      practiceSessionId,
      now: now.toISOString(),
    });
  } catch {
    throw new ReplacePracticeSituationError("persistence_unavailable");
  }
  if (!snapshot) {
    throw new ReplacePracticeSituationError("not_found");
  }

  const current = snapshot.state;
  if (current.lastSituationReplacementKey === idempotencyKey) {
    return current;
  }
  if (
    current.status !== "active" ||
    current.phase !== "briefing" ||
    current.setup.situationMode !== "choose_for_me"
  ) {
    throw new ReplacePracticeSituationError("phase_not_available");
  }
  if (current.situationReplacementCount >= 2) {
    throw new ReplacePracticeSituationError("replacement_limit");
  }
  if (current.updatedAt !== input.expectedUpdatedAt) {
    throw new ReplacePracticeSituationError("stale_state");
  }

  let recentSituations: string[];
  try {
    recentSituations = await input.repository.listRecentPracticeSituations({
      anonymousSessionId,
      setup: current.setup,
      now: now.toISOString(),
      limit: 8,
    });
  } catch {
    throw new ReplacePracticeSituationError("persistence_unavailable");
  }

  let plan;
  try {
    ({ plan } = await generatePracticePlan({
      setup: current.setup,
      model: input.model,
      variationSeed: `${practiceSessionId}:replacement:${
        current.situationReplacementCount + 1
      }`,
      recentlyUsedSituations: uniqueSituations([
        current.plan.situation,
        ...recentSituations,
      ]),
      practiceFormat:
        current.schemaVersion === 6 ? "single_prompt" : undefined,
    }));
  } catch {
    throw new ReplacePracticeSituationError("invalid_generated_output");
  }

  const updatedAt = nextTimestamp(current.updatedAt, now);
  const nextState = practiceSessionStateSchema.parse({
    ...current,
    plan,
    situationReplacementCount: current.situationReplacementCount + 1,
    lastSituationReplacementKey: idempotencyKey,
    updatedAt,
  });

  let result;
  try {
    result = await input.repository.savePracticeProgress({
      anonymousSessionId,
      practiceSessionId,
      expectedPhase: "briefing",
      expectedUpdatedAt: current.updatedAt,
      now: updatedAt,
      nextState,
    });
  } catch {
    throw new ReplacePracticeSituationError("persistence_unavailable");
  }

  if (result.kind === "saved" || result.kind === "unchanged") {
    return result.snapshot.state;
  }
  if (result.reason === "not_found" || result.reason === "expired") {
    throw new ReplacePracticeSituationError("not_found");
  }
  if (result.reason === "stale_state") {
    try {
      const latest = await input.repository.lookupPracticeSession({
        anonymousSessionId,
        practiceSessionId,
        now: updatedAt,
      });
      if (
        latest.kind === "found" &&
        latest.snapshot.state.lastSituationReplacementKey === idempotencyKey
      ) {
        return latest.snapshot.state;
      }
    } catch {
      throw new ReplacePracticeSituationError("persistence_unavailable");
    }
    throw new ReplacePracticeSituationError("stale_state");
  }
  throw new ReplacePracticeSituationError("persistence_unavailable");
}
