import type {
  PracticeMessage,
  PracticeSessionState,
} from "@/lib/coaching/schemas";

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validPartnerOpening(
  current: PracticeSessionState,
  next: PracticeSessionState,
  appendedMessages: PracticeMessage[],
): boolean {
  if (
    current.phase !== "briefing" ||
    next.phase !== "initial_simulation" ||
    current.plan.opening.speaker !== "partner" ||
    current.plan.opening.partnerOpeningText === null ||
    appendedMessages.length !== 1
  ) {
    return false;
  }

  const [message] = appendedMessages;
  return (
    message.role === "partner" &&
    message.phase === "initial_simulation" &&
    message.learnerResponseNumber === null &&
    message.sequence === current.messages.length &&
    message.text === current.plan.opening.partnerOpeningText &&
    message.createdAt === next.updatedAt
  );
}

function stableUserExitFieldsMatch(
  current: PracticeSessionState,
  next: PracticeSessionState,
): boolean {
  return sameJson(
    {
      ...current,
      status: next.status,
      phase: next.phase,
      takeaway: next.takeaway,
      terminationReason: next.terminationReason,
      updatedAt: next.updatedAt,
    },
    next,
  );
}

function validUserExitTransition(
  current: PracticeSessionState,
  next: PracticeSessionState,
): boolean {
  if (
    current.status !== "active" ||
    next.terminationReason !== "user_exit" ||
    !stableUserExitFieldsMatch(current, next)
  ) {
    return false;
  }

  if (
    current.phase === "finalizing" &&
    current.terminationReason === "user_exit"
  ) {
    return (
      next.status === "completed" &&
      next.phase === "final_takeaway" &&
      next.takeaway?.kind === "partial"
    );
  }

  if (current.acceptedResponseCount >= 2) {
    return (
      next.status === "active" &&
      next.phase === "finalizing" &&
      next.takeaway === current.takeaway
    );
  }

  return (
    next.status === "ended" &&
    next.phase === current.phase &&
    next.takeaway === current.takeaway
  );
}

function validSituationReplacement(
  current: PracticeSessionState,
  next: PracticeSessionState,
): boolean {
  if (
    current.status !== "active" ||
    current.phase !== "briefing" ||
    next.status !== "active" ||
    next.phase !== "briefing" ||
    current.setup.situationMode !== "choose_for_me" ||
    current.situationReplacementCount >= 2 ||
    next.situationReplacementCount !==
      current.situationReplacementCount + 1 ||
    next.lastSituationReplacementKey === null ||
    next.lastSituationReplacementKey === current.lastSituationReplacementKey ||
    sameJson(next.plan, current.plan)
  ) {
    return false;
  }

  return sameJson(
    {
      ...current,
      plan: next.plan,
      situationReplacementCount: next.situationReplacementCount,
      lastSituationReplacementKey: next.lastSituationReplacementKey,
      updatedAt: next.updatedAt,
    },
    next,
  );
}

/**
 * Progress saves never accept learner turns. The only transcript append outside
 * the turn-commit workflow is the validated partner opening at simulation
 * start.
 */
export function validatePracticeProgressTransition(
  current: PracticeSessionState,
  next: PracticeSessionState,
): { appendedMessages: PracticeMessage[] } | null {
  if (
    next.acceptedResponseCount !== current.acceptedResponseCount ||
    next.expectedLearnerSequence !== current.expectedLearnerSequence ||
    next.createdAt !== current.createdAt ||
    next.expiresAt !== current.expiresAt ||
    Date.parse(next.updatedAt) <= Date.parse(current.updatedAt)
  ) {
    return null;
  }

  if (validUserExitTransition(current, next)) {
    return { appendedMessages: [] };
  }

  if (validSituationReplacement(current, next)) {
    return { appendedMessages: [] };
  }

  if (
    !sameJson(next.plan, current.plan) ||
    next.situationReplacementCount !== current.situationReplacementCount ||
    next.lastSituationReplacementKey !== current.lastSituationReplacementKey
  ) {
    return null;
  }

  const allowedPhaseChanges = new Set([
    `${current.phase}:${current.phase}`,
    "briefing:initial_simulation",
    "coaching_break:targeted_retry",
    "finalizing:final_takeaway",
  ]);
  if (
    !allowedPhaseChanges.has(`${current.phase}:${next.phase}`) ||
    next.status !== current.status ||
    next.terminationReason !== current.terminationReason
  ) {
    return null;
  }

  const appendedMessages = next.messages.slice(current.messages.length);
  if (
    !sameJson(
      next.messages.slice(0, current.messages.length),
      current.messages,
    )
  ) {
    return null;
  }
  if (appendedMessages.length === 0) {
    return { appendedMessages };
  }
  return validPartnerOpening(current, next, appendedMessages)
    ? { appendedMessages }
    : null;
}
