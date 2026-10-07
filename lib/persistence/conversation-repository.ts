import type { Debrief } from "@/lib/validation/debrief";
import type {
  ConversationState,
  TranscriptMessage,
} from "@/lib/validation/conversation";

export interface AnonymousSessionRecord {
  id: string;
  createdAt: string;
  expiresAt: string;
}

export interface ConversationSnapshot {
  sessionId: string;
  state: ConversationState;
  debrief: Debrief | null;
}

export interface CreateConversationInput {
  sessionId: string;
  state: ConversationState;
}

export interface TurnReceipt {
  idempotencyKey: string;
  conversationId: string;
  learnerMessage: TranscriptMessage;
  sofiaMessage: TranscriptMessage;
  state: ConversationState;
}

export type BeginTurnResult =
  | {
      kind: "ready";
      reservationId: string;
      leaseExpiresAt: string;
      snapshot: ConversationSnapshot;
    }
  | { kind: "committed"; receipt: TurnReceipt }
  | { kind: "in_progress"; retryAfterSeconds: number }
  | {
      kind: "rejected";
      reason:
        | "not_found"
        | "expired"
        | "conversation_not_active"
        | "stale_sequence"
        | "allowance_exhausted";
    };

export interface BeginTurnInput {
  sessionId: string;
  conversationId: string;
  idempotencyKey: string;
  expectedSequence: number;
  now: string;
}

export interface CommitTurnInput {
  sessionId: string;
  conversationId: string;
  reservationId: string;
  idempotencyKey: string;
  expectedSequence: number;
  learnerMessage: TranscriptMessage;
  sofiaMessage: TranscriptMessage;
  nextState: ConversationState;
}

export type CommitTurnResult =
  | { kind: "committed"; receipt: TurnReceipt }
  | { kind: "duplicate"; receipt: TurnReceipt }
  | {
      kind: "rejected";
      reason:
        | "reservation_lost"
        | "conversation_not_active"
        | "stale_sequence"
        | "allowance_exhausted";
    };

export interface ReleaseTurnInput {
  conversationId: string;
  reservationId: string;
  idempotencyKey: string;
  reason:
    | "invalid_audio"
    | "unclear_audio"
    | "non_english"
    | "provider_failure"
    | "invalid_model_output";
}

export type SaveDebriefResult =
  | { kind: "saved"; debrief: Debrief }
  | { kind: "existing"; debrief: Debrief }
  | { kind: "rejected"; reason: "not_found" | "not_pending" };

export interface EndConversationInput {
  sessionId: string;
  conversationId: string;
  now: string;
}

export type EndConversationResult =
  | { kind: "ended"; state: ConversationState }
  | { kind: "already_ended"; state: ConversationState }
  | {
      kind: "rejected";
      reason: "not_found" | "conversation_not_active";
    };

/**
 * Storage implementations must validate state and debrief JSON on every read
 * and write. beginTurn reserves duplicate work without consuming allowance;
 * commitTurn performs the entire accepted-turn mutation in one transaction.
 */
export interface ConversationRepository {
  createSession(record: AnonymousSessionRecord): Promise<void>;
  getSession(sessionId: string, now: string): Promise<AnonymousSessionRecord | null>;
  renewSession(input: {
    sessionId: string;
    now: string;
    expiresAt: string;
  }): Promise<AnonymousSessionRecord | null>;

  createConversation(input: CreateConversationInput): Promise<ConversationSnapshot>;
  getConversation(input: {
    sessionId: string;
    conversationId: string;
    now: string;
  }): Promise<ConversationSnapshot | null>;

  beginTurn(input: BeginTurnInput): Promise<BeginTurnResult>;
  commitTurn(input: CommitTurnInput): Promise<CommitTurnResult>;
  releaseTurn(input: ReleaseTurnInput): Promise<void>;

  endConversation(input: EndConversationInput): Promise<EndConversationResult>;

  saveDebrief(input: {
    sessionId: string;
    conversationId: string;
    debrief: Debrief;
  }): Promise<SaveDebriefResult>;

  deleteConversation(input: {
    sessionId: string;
    conversationId: string;
  }): Promise<boolean>;
  deleteExpired(now: string, limit: number): Promise<number>;
}
