import { V1_RULES } from "@/lib/product-rules";
import type {
  ConversationStage,
  TrustLevel,
} from "@/lib/validation/conversation";

const TRUST_LEVELS: readonly TrustLevel[] = [
  "guarded",
  "cautious",
  "comfortable",
  "open",
];

const NORMAL_STAGE_TRANSITIONS: Record<
  ConversationStage,
  readonly ConversationStage[]
> = {
  opening: ["developing"],
  developing: ["developing", "resolving"],
  resolving: ["resolving", "closing"],
  closing: [],
};

export type ResponseWindow =
  | "develop"
  | "outcome_eligible"
  | "closure_pressure"
  | "must_close";

export function canAcceptResponse(acceptedResponseCount: number): boolean {
  return acceptedResponseCount < V1_RULES.maxAcceptedResponses;
}

export function responseWindowAfterAcceptance(
  acceptedResponseCount: number,
): ResponseWindow {
  if (acceptedResponseCount >= V1_RULES.maxAcceptedResponses) {
    return "must_close";
  }
  if (acceptedResponseCount === 7) {
    return "closure_pressure";
  }
  if (acceptedResponseCount >= 4) {
    return "outcome_eligible";
  }
  return "develop";
}

export function isNormalStageTransitionAllowed(
  from: ConversationStage,
  to: ConversationStage,
): boolean {
  return NORMAL_STAGE_TRANSITIONS[from].includes(to);
}

function adjacentTrustLevel(
  current: TrustLevel,
  direction: "up" | "down",
): TrustLevel {
  const index = TRUST_LEVELS.indexOf(current);
  const nextIndex = direction === "up" ? index + 1 : index - 1;
  return TRUST_LEVELS[Math.max(0, Math.min(TRUST_LEVELS.length - 1, nextIndex))];
}

export type TrustEvidence =
  | "none"
  | "supportive"
  | "clear_concern"
  | "meaningful_repair"
  | "severe";

export interface TrustTransitionInput {
  currentLevel: TrustLevel;
  supportStreak: 0 | 1;
  evidence: TrustEvidence;
}

export interface TrustTransitionResult {
  level: TrustLevel;
  supportStreak: 0 | 1;
}

export function reduceTrust({
  currentLevel,
  supportStreak,
  evidence,
}: TrustTransitionInput): TrustTransitionResult {
  if (evidence === "severe") {
    return { level: "guarded", supportStreak: 0 };
  }

  if (evidence === "clear_concern") {
    return {
      level: adjacentTrustLevel(currentLevel, "down"),
      supportStreak: 0,
    };
  }

  if (evidence === "meaningful_repair") {
    return {
      level: adjacentTrustLevel(currentLevel, "up"),
      supportStreak: 0,
    };
  }

  if (evidence === "supportive") {
    if (supportStreak === 1) {
      return {
        level: adjacentTrustLevel(currentLevel, "up"),
        supportStreak: 0,
      };
    }
    return { level: currentLevel, supportStreak: 1 };
  }

  return { level: currentLevel, supportStreak };
}
