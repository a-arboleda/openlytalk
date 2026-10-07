import type {
  PracticeMessage,
  PracticeSessionState,
  PracticeSetup,
  SessionPhase,
} from "@/lib/coaching/schemas";
import type { AnonymousSessionRecord } from "@/lib/persistence/conversation-repository";

export interface PracticeSnapshot {
  state: PracticeSessionState;
}

export type PracticeSessionLookupResult =
  | { kind: "found"; snapshot: PracticeSnapshot }
  | { kind: "expired" }
  | { kind: "not_found" };

export interface CreatePracticeSessionInput {
  anonymousSessionId: string;
  state: PracticeSessionState;
}

export interface PracticeTurnReceipt {
  idempotencyKey: string;
  practiceSessionId: string;
  acceptedMessages: PracticeMessage[];
  state: PracticeSessionState;
}

export type BeginPracticeTurnResult =
  | {
      kind: "ready";
      reservationId: string;
      leaseExpiresAt: string;
      snapshot: PracticeSnapshot;
    }
  | { kind: "committed"; receipt: PracticeTurnReceipt }
  | { kind: "in_progress"; retryAfterSeconds: number }
  | {
      kind: "rejected";
      reason:
        | "not_found"
        | "expired"
        | "practice_not_active"
        | "phase_not_accepting_audio"
        | "stale_sequence"
        | "allowance_exhausted";
    };

export interface BeginPracticeTurnInput {
  anonymousSessionId: string;
  practiceSessionId: string;
  idempotencyKey: string;
  expectedLearnerSequence: number;
  now: string;
}

export interface CommitPracticeTurnInput {
  anonymousSessionId: string;
  practiceSessionId: string;
  reservationId: string;
  idempotencyKey: string;
  expectedLearnerSequence: number;
  acceptedMessages: PracticeMessage[];
  nextState: PracticeSessionState;
}

export type CommitPracticeTurnResult =
  | { kind: "committed"; receipt: PracticeTurnReceipt }
  | { kind: "duplicate"; receipt: PracticeTurnReceipt }
  | {
      kind: "rejected";
      reason:
        | "reservation_lost"
        | "practice_not_active"
        | "phase_not_accepting_audio"
        | "stale_sequence"
        | "allowance_exhausted";
    };

export interface ReleasePracticeTurnInput {
  practiceSessionId: string;
  reservationId: string;
  idempotencyKey: string;
  reason:
    | "invalid_audio"
    | "unclear_audio"
    | "non_english"
    | "provider_failure"
    | "invalid_model_output";
}

export interface SavePracticeProgressInput {
  anonymousSessionId: string;
  practiceSessionId: string;
  expectedPhase: SessionPhase;
  expectedUpdatedAt: string;
  now: string;
  nextState: PracticeSessionState;
}

export type SavePracticeProgressResult =
  | { kind: "saved"; snapshot: PracticeSnapshot }
  | { kind: "unchanged"; snapshot: PracticeSnapshot }
  | {
      kind: "rejected";
      reason: "not_found" | "expired" | "stale_state" | "invalid_transition";
    };

/**
 * Implementations validate all structured state on read and write. Turn
 * reservation consumes no learner allowance; committing an accepted learner
 * response and its resulting state is one atomic operation.
 */
export interface PracticeRepository {
  createSession(record: AnonymousSessionRecord): Promise<void>;
  getSession(
    sessionId: string,
    now: string,
  ): Promise<AnonymousSessionRecord | null>;
  renewSession(input: {
    sessionId: string;
    now: string;
    expiresAt: string;
  }): Promise<AnonymousSessionRecord | null>;

  createPracticeSession(
    input: CreatePracticeSessionInput,
  ): Promise<PracticeSnapshot>;
  listRecentPracticeSituations(input: {
    anonymousSessionId: string;
    setup: PracticeSetup;
    now: string;
    limit: number;
  }): Promise<string[]>;
  getPracticeSession(input: {
    anonymousSessionId: string;
    practiceSessionId: string;
    now: string;
  }): Promise<PracticeSnapshot | null>;
  lookupPracticeSession(input: {
    anonymousSessionId: string;
    practiceSessionId: string;
    now: string;
  }): Promise<PracticeSessionLookupResult>;

  beginPracticeTurn(
    input: BeginPracticeTurnInput,
  ): Promise<BeginPracticeTurnResult>;
  commitPracticeTurn(
    input: CommitPracticeTurnInput,
  ): Promise<CommitPracticeTurnResult>;
  releasePracticeTurn(input: ReleasePracticeTurnInput): Promise<void>;

  savePracticeProgress(
    input: SavePracticeProgressInput,
  ): Promise<SavePracticeProgressResult>;

  deletePracticeSession(input: {
    anonymousSessionId: string;
    practiceSessionId: string;
  }): Promise<boolean>;
  deleteExpiredPracticeSessions(now: string, limit: number): Promise<number>;
}
