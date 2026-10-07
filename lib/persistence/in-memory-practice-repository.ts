import { randomUUID } from "node:crypto";

import {
  COACHING_BETA_RULES,
} from "@/lib/coaching/product-rules";
import {
  practiceMessageSchema,
  practiceSessionStateSchema,
  type PracticeMessage,
  type PracticeSessionState,
} from "@/lib/coaching/schemas";
import { canAcceptLearnerResponse } from "@/lib/coaching/transitions";
import type { AnonymousSessionRecord } from "@/lib/persistence/conversation-repository";
import { validatePracticeProgressTransition } from "@/lib/persistence/practice-progress";
import type {
  BeginPracticeTurnInput,
  BeginPracticeTurnResult,
  CommitPracticeTurnInput,
  CommitPracticeTurnResult,
  CreatePracticeSessionInput,
  PracticeRepository,
  PracticeSessionLookupResult,
  PracticeSnapshot,
  PracticeTurnReceipt,
  ReleasePracticeTurnInput,
  SavePracticeProgressInput,
  SavePracticeProgressResult,
} from "@/lib/persistence/practice-repository";
import {
  anonymousSessionRecordSchema,
  databaseIdSchema,
  idempotencyKeySchema,
} from "@/lib/validation/persistence";
import { practiceTurnReceiptSchema } from "@/lib/validation/practice-persistence";

const DEFAULT_LEASE_MILLISECONDS = 30_000;

type StoredRequest = {
  id: string;
  practiceSessionId: string;
  idempotencyKey: string;
  expectedLearnerSequence: number;
  status: "processing" | "committed" | "retryable_failure";
  leaseExpiresAt: string | null;
  receipt: PracticeTurnReceipt | null;
  failureReason: ReleasePracticeTurnInput["reason"] | null;
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function iso(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new PracticeRepositoryInvariantError(
      "Persistence requires a valid ISO timestamp.",
    );
  }
  return parsed.toISOString();
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function requestKey(
  practiceSessionId: string,
  idempotencyKey: string,
): string {
  return `${practiceSessionId}:${idempotencyKey}`;
}

function assertStateIdentity(input: {
  anonymousSessionId: string;
  practiceSessionId: string;
  state: PracticeSessionState;
}): void {
  databaseIdSchema.parse(input.anonymousSessionId);
  databaseIdSchema.parse(input.practiceSessionId);
  if (
    input.state.anonymousSessionId !== input.anonymousSessionId ||
    input.state.practiceSessionId !== input.practiceSessionId
  ) {
    throw new PracticeRepositoryInvariantError(
      "Practice state identity must match its owning anonymous session.",
    );
  }
}

function validateAcceptedMessages(input: {
  currentState: PracticeSessionState;
  acceptedMessages: PracticeMessage[];
  nextState: PracticeSessionState;
}): PracticeMessage[] {
  if (
    input.acceptedMessages.length < 1 ||
    input.acceptedMessages.length > 2
  ) {
    throw new PracticeRepositoryInvariantError(
      "A committed response requires one learner message and at most one partner message.",
    );
  }

  const messages = input.acceptedMessages.map((message) => {
    databaseIdSchema.parse(message.id);
    return practiceMessageSchema.parse(message);
  });
  const learnerMessages = messages.filter(
    (message) => message.role === "learner",
  );
  if (learnerMessages.length !== 1 || messages[0].role !== "learner") {
    throw new PracticeRepositoryInvariantError(
      "The committed message group must begin with exactly one learner response.",
    );
  }

  const expectedResponseNumber =
    input.currentState.acceptedResponseCount + 1;
  if (
    learnerMessages[0].learnerResponseNumber !== expectedResponseNumber
  ) {
    throw new PracticeRepositoryInvariantError(
      "The learner response number must be the next contiguous number.",
    );
  }

  const currentLastSequence =
    input.currentState.messages.at(-1)?.sequence ?? -1;
  messages.forEach((message, index) => {
    if (message.sequence !== currentLastSequence + index + 1) {
      throw new PracticeRepositoryInvariantError(
        "Committed transcript messages must append in monotonic order.",
      );
    }
  });

  if (
    input.nextState.acceptedResponseCount !== expectedResponseNumber ||
    input.nextState.expectedLearnerSequence !==
      input.currentState.expectedLearnerSequence + 1 ||
    !sameJson(input.nextState.messages, [
      ...input.currentState.messages,
      ...messages,
    ])
  ) {
    throw new PracticeRepositoryInvariantError(
      "The committed state must append the accepted messages and advance one learner response.",
    );
  }

  return messages;
}

export class PracticeRepositoryInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PracticeRepositoryInvariantError";
  }
}

export class InMemoryPracticeRepository implements PracticeRepository {
  private readonly sessions = new Map<string, AnonymousSessionRecord>();
  private readonly practices = new Map<string, PracticeSessionState>();
  private readonly requests = new Map<string, StoredRequest>();

  constructor(
    private readonly leaseMilliseconds = DEFAULT_LEASE_MILLISECONDS,
  ) {
    if (!Number.isInteger(leaseMilliseconds) || leaseMilliseconds < 1) {
      throw new PracticeRepositoryInvariantError(
        "The reservation lease must be a positive number of milliseconds.",
      );
    }
  }

  async createSession(record: AnonymousSessionRecord): Promise<void> {
    const validated = anonymousSessionRecordSchema.parse(record);
    if (this.sessions.has(validated.id)) {
      throw new PracticeRepositoryInvariantError(
        "The anonymous session already exists.",
      );
    }
    this.sessions.set(validated.id, clone(validated));
  }

  async getSession(
    sessionId: string,
    now: string,
  ): Promise<AnonymousSessionRecord | null> {
    databaseIdSchema.parse(sessionId);
    const timestamp = iso(now);
    const session = this.sessions.get(sessionId);
    if (!session || Date.parse(session.expiresAt) <= Date.parse(timestamp)) {
      return null;
    }
    return clone(session);
  }

  async renewSession(input: {
    sessionId: string;
    now: string;
    expiresAt: string;
  }): Promise<AnonymousSessionRecord | null> {
    databaseIdSchema.parse(input.sessionId);
    const now = iso(input.now);
    const expiresAt = iso(input.expiresAt);
    if (Date.parse(expiresAt) <= Date.parse(now)) {
      throw new PracticeRepositoryInvariantError(
        "Renewed session expiration must occur after the renewal time.",
      );
    }

    const session = this.sessions.get(input.sessionId);
    if (!session || Date.parse(session.expiresAt) <= Date.parse(now)) {
      return null;
    }

    const renewed = anonymousSessionRecordSchema.parse({
      ...session,
      expiresAt,
    });
    this.sessions.set(input.sessionId, clone(renewed));
    return clone(renewed);
  }

  async createPracticeSession(
    input: CreatePracticeSessionInput,
  ): Promise<PracticeSnapshot> {
    const state = practiceSessionStateSchema.parse(input.state);
    assertStateIdentity({
      anonymousSessionId: input.anonymousSessionId,
      practiceSessionId: state.practiceSessionId,
      state,
    });

    const owner = this.sessions.get(input.anonymousSessionId);
    if (
      !owner ||
      Date.parse(owner.expiresAt) <= Date.parse(state.createdAt)
    ) {
      throw new PracticeRepositoryInvariantError(
        "A practice session requires an active anonymous owner.",
      );
    }
    if (this.practices.has(state.practiceSessionId)) {
      throw new PracticeRepositoryInvariantError(
        "The practice session already exists.",
      );
    }

    this.practices.set(state.practiceSessionId, clone(state));
    return { state: clone(state) };
  }

  async listRecentPracticeSituations(input: {
    anonymousSessionId: string;
    setup: PracticeSessionState["setup"];
    now: string;
    limit: number;
  }): Promise<string[]> {
    databaseIdSchema.parse(input.anonymousSessionId);
    const now = iso(input.now);
    if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 10) {
      throw new PracticeRepositoryInvariantError(
        "Recent practice lookup requires a limit between one and ten.",
      );
    }

    return [...this.practices.values()]
      .filter(
        (state) =>
          state.anonymousSessionId === input.anonymousSessionId &&
          Date.parse(state.expiresAt) > Date.parse(now) &&
          sameJson(state.setup, input.setup),
      )
      .sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt),
      )
      .slice(0, input.limit)
      .map((state) => state.plan.situation);
  }

  async getPracticeSession(input: {
    anonymousSessionId: string;
    practiceSessionId: string;
    now: string;
  }): Promise<PracticeSnapshot | null> {
    const result = await this.lookupPracticeSession(input);
    return result.kind === "found" ? result.snapshot : null;
  }

  async lookupPracticeSession(input: {
    anonymousSessionId: string;
    practiceSessionId: string;
    now: string;
  }): Promise<PracticeSessionLookupResult> {
    databaseIdSchema.parse(input.anonymousSessionId);
    databaseIdSchema.parse(input.practiceSessionId);
    const now = iso(input.now);
    const state = this.practices.get(input.practiceSessionId);
    if (
      !state ||
      state.anonymousSessionId !== input.anonymousSessionId
    ) {
      return { kind: "not_found" };
    }
    if (Date.parse(state.expiresAt) <= Date.parse(now)) {
      return { kind: "expired" };
    }
    return {
      kind: "found",
      snapshot: {
        state: clone(practiceSessionStateSchema.parse(state)),
      },
    };
  }

  async beginPracticeTurn(
    input: BeginPracticeTurnInput,
  ): Promise<BeginPracticeTurnResult> {
    databaseIdSchema.parse(input.anonymousSessionId);
    databaseIdSchema.parse(input.practiceSessionId);
    idempotencyKeySchema.parse(input.idempotencyKey);
    const now = iso(input.now);
    const state = this.practices.get(input.practiceSessionId);
    if (
      !state ||
      state.anonymousSessionId !== input.anonymousSessionId
    ) {
      return { kind: "rejected", reason: "not_found" };
    }

    const key = requestKey(
      input.practiceSessionId,
      input.idempotencyKey,
    );
    const existing = this.requests.get(key);
    if (existing?.status === "committed" && existing.receipt) {
      return { kind: "committed", receipt: clone(existing.receipt) };
    }
    if (
      existing?.status === "processing" &&
      existing.leaseExpiresAt &&
      Date.parse(existing.leaseExpiresAt) > Date.parse(now)
    ) {
      return {
        kind: "in_progress",
        retryAfterSeconds: Math.max(
          1,
          Math.ceil(
            (Date.parse(existing.leaseExpiresAt) - Date.parse(now)) /
              1_000,
          ),
        ),
      };
    }

    if (Date.parse(state.expiresAt) <= Date.parse(now)) {
      return { kind: "rejected", reason: "expired" };
    }
    if (state.status !== "active") {
      return { kind: "rejected", reason: "practice_not_active" };
    }
    if (
      state.acceptedResponseCount >=
      COACHING_BETA_RULES.maxAcceptedResponses
    ) {
      return { kind: "rejected", reason: "allowance_exhausted" };
    }
    if (!canAcceptLearnerResponse(state)) {
      return {
        kind: "rejected",
        reason: "phase_not_accepting_audio",
      };
    }
    if (
      state.expectedLearnerSequence !== input.expectedLearnerSequence
    ) {
      return { kind: "rejected", reason: "stale_sequence" };
    }

    const competing = [...this.requests.values()].find(
      (request) =>
        request.practiceSessionId === input.practiceSessionId &&
        request.expectedLearnerSequence ===
          input.expectedLearnerSequence &&
        request.status === "processing" &&
        request.id !== existing?.id,
    );
    if (
      competing?.leaseExpiresAt &&
      Date.parse(competing.leaseExpiresAt) > Date.parse(now)
    ) {
      return {
        kind: "in_progress",
        retryAfterSeconds: Math.max(
          1,
          Math.ceil(
            (Date.parse(competing.leaseExpiresAt) - Date.parse(now)) /
              1_000,
          ),
        ),
      };
    }
    if (competing) {
      competing.status = "retryable_failure";
      competing.leaseExpiresAt = null;
      competing.failureReason = "provider_failure";
    }

    const reservationId = randomUUID();
    const leaseExpiresAt = new Date(
      Date.parse(now) + this.leaseMilliseconds,
    ).toISOString();
    this.requests.set(key, {
      id: reservationId,
      practiceSessionId: input.practiceSessionId,
      idempotencyKey: input.idempotencyKey,
      expectedLearnerSequence: input.expectedLearnerSequence,
      status: "processing",
      leaseExpiresAt,
      receipt: null,
      failureReason: null,
    });

    return {
      kind: "ready",
      reservationId,
      leaseExpiresAt,
      snapshot: { state: clone(state) },
    };
  }

  async commitPracticeTurn(
    input: CommitPracticeTurnInput,
  ): Promise<CommitPracticeTurnResult> {
    databaseIdSchema.parse(input.anonymousSessionId);
    databaseIdSchema.parse(input.practiceSessionId);
    databaseIdSchema.parse(input.reservationId);
    idempotencyKeySchema.parse(input.idempotencyKey);
    const nextState = practiceSessionStateSchema.parse(input.nextState);
    assertStateIdentity({
      anonymousSessionId: input.anonymousSessionId,
      practiceSessionId: input.practiceSessionId,
      state: nextState,
    });

    const state = this.practices.get(input.practiceSessionId);
    const request = this.requests.get(
      requestKey(input.practiceSessionId, input.idempotencyKey),
    );
    if (
      !state ||
      state.anonymousSessionId !== input.anonymousSessionId
    ) {
      return { kind: "rejected", reason: "practice_not_active" };
    }
    if (request?.status === "committed" && request.receipt) {
      return { kind: "duplicate", receipt: clone(request.receipt) };
    }
    if (!request || request.id !== input.reservationId) {
      return { kind: "rejected", reason: "reservation_lost" };
    }
    if (state.status !== "active") {
      return { kind: "rejected", reason: "practice_not_active" };
    }
    if (
      state.acceptedResponseCount >=
      COACHING_BETA_RULES.maxAcceptedResponses
    ) {
      return { kind: "rejected", reason: "allowance_exhausted" };
    }
    if (!canAcceptLearnerResponse(state)) {
      return {
        kind: "rejected",
        reason: "phase_not_accepting_audio",
      };
    }
    if (
      state.expectedLearnerSequence !==
        input.expectedLearnerSequence ||
      request.expectedLearnerSequence !==
        input.expectedLearnerSequence
    ) {
      return { kind: "rejected", reason: "stale_sequence" };
    }

    const acceptedMessages = validateAcceptedMessages({
      currentState: state,
      acceptedMessages: input.acceptedMessages,
      nextState,
    });
    if (
      nextState.createdAt !== state.createdAt ||
      nextState.expiresAt !== state.expiresAt ||
      Date.parse(nextState.updatedAt) < Date.parse(state.updatedAt)
    ) {
      throw new PracticeRepositoryInvariantError(
        "A committed response cannot rewrite session creation, expiry, or time order.",
      );
    }

    const receipt = practiceTurnReceiptSchema.parse({
      idempotencyKey: input.idempotencyKey,
      practiceSessionId: input.practiceSessionId,
      acceptedMessages,
      state: nextState,
    });
    this.practices.set(input.practiceSessionId, clone(nextState));
    this.requests.set(
      requestKey(input.practiceSessionId, input.idempotencyKey),
      {
        ...request,
        status: "committed",
        leaseExpiresAt: null,
        receipt: clone(receipt),
        failureReason: null,
      },
    );
    return { kind: "committed", receipt: clone(receipt) };
  }

  async releasePracticeTurn(
    input: ReleasePracticeTurnInput,
  ): Promise<void> {
    databaseIdSchema.parse(input.practiceSessionId);
    databaseIdSchema.parse(input.reservationId);
    idempotencyKeySchema.parse(input.idempotencyKey);
    const key = requestKey(
      input.practiceSessionId,
      input.idempotencyKey,
    );
    const request = this.requests.get(key);
    if (
      request?.id === input.reservationId &&
      request.status === "processing"
    ) {
      this.requests.set(key, {
        ...request,
        status: "retryable_failure",
        leaseExpiresAt: null,
        failureReason: input.reason,
      });
    }
  }

  async savePracticeProgress(
    input: SavePracticeProgressInput,
  ): Promise<SavePracticeProgressResult> {
    databaseIdSchema.parse(input.anonymousSessionId);
    databaseIdSchema.parse(input.practiceSessionId);
    const expectedUpdatedAt = iso(input.expectedUpdatedAt);
    const now = iso(input.now);
    const nextState = practiceSessionStateSchema.parse(input.nextState);
    assertStateIdentity({
      anonymousSessionId: input.anonymousSessionId,
      practiceSessionId: input.practiceSessionId,
      state: nextState,
    });

    const current = this.practices.get(input.practiceSessionId);
    if (
      !current ||
      current.anonymousSessionId !== input.anonymousSessionId
    ) {
      return { kind: "rejected", reason: "not_found" };
    }
    if (Date.parse(current.expiresAt) <= Date.parse(now)) {
      return { kind: "rejected", reason: "expired" };
    }
    if (
      current.phase !== input.expectedPhase ||
      current.updatedAt !== expectedUpdatedAt
    ) {
      return { kind: "rejected", reason: "stale_state" };
    }
    if (sameJson(current, nextState)) {
      return {
        kind: "unchanged",
        snapshot: { state: clone(current) },
      };
    }

    if (!validatePracticeProgressTransition(current, nextState)) {
      return { kind: "rejected", reason: "invalid_transition" };
    }

    this.practices.set(input.practiceSessionId, clone(nextState));
    return {
      kind: "saved",
      snapshot: { state: clone(nextState) },
    };
  }

  async deletePracticeSession(input: {
    anonymousSessionId: string;
    practiceSessionId: string;
  }): Promise<boolean> {
    databaseIdSchema.parse(input.anonymousSessionId);
    databaseIdSchema.parse(input.practiceSessionId);
    const current = this.practices.get(input.practiceSessionId);
    if (
      !current ||
      current.anonymousSessionId !== input.anonymousSessionId
    ) {
      return false;
    }
    this.practices.delete(input.practiceSessionId);
    for (const [key, request] of this.requests) {
      if (request.practiceSessionId === input.practiceSessionId) {
        this.requests.delete(key);
      }
    }
    return true;
  }

  async deleteExpiredPracticeSessions(
    now: string,
    limit: number,
  ): Promise<number> {
    const timestamp = iso(now);
    if (!Number.isInteger(limit) || limit < 1 || limit > 1_000) {
      throw new PracticeRepositoryInvariantError(
        "Expiration cleanup limit must be an integer from 1 through 1000.",
      );
    }

    const candidates = [...this.practices.values()]
      .filter(
        (state) =>
          Date.parse(state.expiresAt) <= Date.parse(timestamp),
      )
      .sort(
        (left, right) =>
          Date.parse(left.expiresAt) - Date.parse(right.expiresAt),
      )
      .slice(0, limit);
    for (const state of candidates) {
      await this.deletePracticeSession({
        anonymousSessionId: state.anonymousSessionId,
        practiceSessionId: state.practiceSessionId,
      });
    }

    const ownedSessionIds = new Set(
      [...this.practices.values()].map(
        (state) => state.anonymousSessionId,
      ),
    );
    for (const [sessionId, session] of this.sessions) {
      if (
        Date.parse(session.expiresAt) <= Date.parse(timestamp) &&
        !ownedSessionIds.has(sessionId)
      ) {
        this.sessions.delete(sessionId);
      }
    }
    return candidates.length;
  }
}
