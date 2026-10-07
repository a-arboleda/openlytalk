import { sql } from "drizzle-orm";
import { removeExpiredOwners } from "@/lib/operations/retention";
import { randomUUID } from "node:crypto";

import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  lte,
} from "drizzle-orm";

import {
  COACHING_BETA_RULES,
} from "@/lib/coaching/product-rules";
import {
  practiceMessageSchema,
  practicePlanSchema,
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
import type { OpenlyTalkDatabase } from "@/lib/persistence/postgres/database";
import {
  anonymousSessions,
  practiceMessages,
  practiceRequests,
  practiceSessions,
} from "@/lib/persistence/postgres/schema";
import {
  anonymousSessionRecordSchema,
  databaseIdSchema,
  idempotencyKeySchema,
} from "@/lib/validation/persistence";
import { practiceTurnReceiptSchema } from "@/lib/validation/practice-persistence";

const PRACTICE_TURN_LEASE_MILLISECONDS = 30_000;

type PracticeSessionRow = typeof practiceSessions.$inferSelect;
type PracticeMessageRow = typeof practiceMessages.$inferSelect;

export class PracticePersistenceInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PracticePersistenceInvariantError";
  }
}

function toIso(value: string | Date): string {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new PracticePersistenceInvariantError(
      "Persistence returned an invalid timestamp.",
    );
  }
  return parsed.toISOString();
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function assertIdentity(input: {
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
    throw new PracticePersistenceInvariantError(
      "Practice state identity must match its database owner.",
    );
  }
}

function sessionValues(state: PracticeSessionState) {
  return {
    id: state.practiceSessionId,
    anonymousSessionId: state.anonymousSessionId,
    schemaVersion: state.schemaVersion,
    status: state.status,
    phase: state.phase,
    setupJson: state.setup,
    planJson: state.plan,
    situationReplacementCount: state.situationReplacementCount,
    lastSituationReplacementKey: state.lastSituationReplacementKey,
    acceptedResponseCount: state.acceptedResponseCount,
    expectedLearnerSequence: state.expectedLearnerSequence,
    evidenceEventsJson: state.evidenceEvents,
    helpEventsJson: state.helpEvents,
    challengeStateJson: state.challengeState,
    coachingBreakJson: state.coachingBreak,
    retryTargetJson: state.retryTarget,
    retryOutcomeJson: state.retryOutcome,
    takeawayJson: state.takeaway,
    terminationReason: state.terminationReason,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
    expiresAt: state.expiresAt,
  };
}

function stateFromRows(
  row: PracticeSessionRow,
  messageRows: PracticeMessageRow[],
): PracticeSessionState {
  return practiceSessionStateSchema.parse({
    schemaVersion: row.schemaVersion,
    practiceSessionId: row.id,
    anonymousSessionId: row.anonymousSessionId,
    status: row.status,
    phase: row.phase,
    setup: row.setupJson,
    plan: row.planJson,
    situationReplacementCount: row.situationReplacementCount,
    lastSituationReplacementKey: row.lastSituationReplacementKey,
    acceptedResponseCount: row.acceptedResponseCount,
    expectedLearnerSequence: row.expectedLearnerSequence,
    messages: messageRows.map((message) => ({
      id: message.id,
      role: message.role,
      phase: message.phase,
      learnerResponseNumber: message.learnerResponseNumber,
      sequence: message.sequence,
      text: message.text,
      createdAt: toIso(message.createdAt),
    })),
    evidenceEvents: row.evidenceEventsJson,
    helpEvents: row.helpEventsJson,
    challengeState: row.challengeStateJson,
    coachingBreak: row.coachingBreakJson,
    retryTarget: row.retryTargetJson,
    retryOutcome: row.retryOutcomeJson,
    takeaway: row.takeawayJson,
    terminationReason: row.terminationReason,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
    expiresAt: toIso(row.expiresAt),
  });
}

function validateCommittedMessages(input: {
  currentState: PracticeSessionState;
  acceptedMessages: PracticeMessage[];
  nextState: PracticeSessionState;
}): PracticeMessage[] {
  if (
    input.acceptedMessages.length < 1 ||
    input.acceptedMessages.length > 2
  ) {
    throw new PracticePersistenceInvariantError(
      "A turn must commit one learner message and at most one partner message.",
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
    throw new PracticePersistenceInvariantError(
      "The committed group must start with exactly one learner response.",
    );
  }

  const expectedResponseNumber =
    input.currentState.acceptedResponseCount + 1;
  const lastSequence =
    input.currentState.messages.at(-1)?.sequence ?? -1;
  if (
    learnerMessages[0].learnerResponseNumber !==
      expectedResponseNumber ||
    messages.some(
      (message, index) =>
        message.sequence !== lastSequence + index + 1,
    )
  ) {
    throw new PracticePersistenceInvariantError(
      "Committed messages must use contiguous response and transcript sequences.",
    );
  }
  if (
    input.nextState.acceptedResponseCount !==
      expectedResponseNumber ||
    input.nextState.expectedLearnerSequence !==
      input.currentState.expectedLearnerSequence + 1 ||
    !sameJson(input.nextState.messages, [
      ...input.currentState.messages,
      ...messages,
    ]) ||
    input.nextState.createdAt !== input.currentState.createdAt ||
    input.nextState.expiresAt !== input.currentState.expiresAt ||
    Date.parse(input.nextState.updatedAt) <
      Date.parse(input.currentState.updatedAt)
  ) {
    throw new PracticePersistenceInvariantError(
      "The next state must append the accepted response atomically.",
    );
  }

  return messages;
}

async function messageRowsFor(
  database: OpenlyTalkDatabase,
  practiceSessionId: string,
): Promise<PracticeMessageRow[]> {
  return database
    .select()
    .from(practiceMessages)
    .where(eq(practiceMessages.practiceSessionId, practiceSessionId))
    .orderBy(asc(practiceMessages.sequence));
}

export class DrizzlePracticeRepository implements PracticeRepository {
  constructor(private readonly database: OpenlyTalkDatabase) {}

  async createSession(record: AnonymousSessionRecord): Promise<void> {
    const validated = anonymousSessionRecordSchema.parse(record);
    await this.database.insert(anonymousSessions).values(validated);
  }

  async getSession(
    sessionId: string,
    now: string,
  ): Promise<AnonymousSessionRecord | null> {
    databaseIdSchema.parse(sessionId);
    const [row] = await this.database
      .select()
      .from(anonymousSessions)
      .where(
        and(
          eq(anonymousSessions.id, sessionId),
          gt(anonymousSessions.expiresAt, toIso(now)),
        ),
      )
      .limit(1);

    return row
      ? anonymousSessionRecordSchema.parse({
          id: row.id,
          createdAt: toIso(row.createdAt),
          expiresAt: toIso(row.expiresAt),
        })
      : null;
  }

  async renewSession(input: {
    sessionId: string;
    now: string;
    expiresAt: string;
  }): Promise<AnonymousSessionRecord | null> {
    databaseIdSchema.parse(input.sessionId);
    const now = toIso(input.now);
    const expiresAt = toIso(input.expiresAt);
    if (Date.parse(expiresAt) <= Date.parse(now)) {
      throw new PracticePersistenceInvariantError(
        "Renewed session expiration must occur after the renewal time.",
      );
    }

    const [row] = await this.database
      .update(anonymousSessions)
      .set({ expiresAt: sql`greatest(${anonymousSessions.expiresAt}, ${expiresAt}::timestamptz)` })
      .where(
        and(
          eq(anonymousSessions.id, input.sessionId),
          gt(anonymousSessions.expiresAt, now),
        ),
      )
      .returning();

    return row
      ? anonymousSessionRecordSchema.parse({
          id: row.id,
          createdAt: toIso(row.createdAt),
          expiresAt: toIso(row.expiresAt),
        })
      : null;
  }

  async createPracticeSession(
    input: CreatePracticeSessionInput,
  ): Promise<PracticeSnapshot> {
    const state = practiceSessionStateSchema.parse(input.state);
    assertIdentity({
      anonymousSessionId: input.anonymousSessionId,
      practiceSessionId: state.practiceSessionId,
      state,
    });

    return this.database.transaction(async (transaction) => {
      const [owner] = await transaction
        .select({ id: anonymousSessions.id })
        .from(anonymousSessions)
        .where(
          and(
            eq(anonymousSessions.id, input.anonymousSessionId),
            gt(anonymousSessions.expiresAt, state.createdAt),
          ),
        )
        .limit(1)
        .for("update");
      if (!owner) {
        throw new PracticePersistenceInvariantError(
          "A practice session requires an active anonymous owner.",
        );
      }

      await transaction
        .insert(practiceSessions)
        .values(sessionValues(state));
      if (state.messages.length > 0) {
        await transaction.insert(practiceMessages).values(
          state.messages.map((message) => ({
            id: message.id,
            practiceSessionId: state.practiceSessionId,
            role: message.role,
            phase: message.phase,
            learnerResponseNumber: message.learnerResponseNumber,
            sequence: message.sequence,
            text: message.text,
            createdAt: message.createdAt,
          })),
        );
      }
      return { state };
    });
  }

  async listRecentPracticeSituations(input: {
    anonymousSessionId: string;
    setup: PracticeSessionState["setup"];
    now: string;
    limit: number;
  }): Promise<string[]> {
    databaseIdSchema.parse(input.anonymousSessionId);
    const now = toIso(input.now);
    if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 10) {
      throw new PracticePersistenceInvariantError(
        "Recent practice lookup requires a limit between one and ten.",
      );
    }

    const rows = await this.database
      .select({ plan: practiceSessions.planJson })
      .from(practiceSessions)
      .where(
        and(
          eq(
            practiceSessions.anonymousSessionId,
            input.anonymousSessionId,
          ),
          eq(practiceSessions.setupJson, input.setup),
          gt(practiceSessions.expiresAt, now),
        ),
      )
      .orderBy(desc(practiceSessions.createdAt))
      .limit(input.limit);

    return rows.map((row) => practicePlanSchema.parse(row.plan).situation);
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
    const now = toIso(input.now);
    const [row] = await this.database
      .select()
      .from(practiceSessions)
      .where(
        and(
          eq(practiceSessions.id, input.practiceSessionId),
          eq(
            practiceSessions.anonymousSessionId,
            input.anonymousSessionId,
          ),
        ),
      )
      .limit(1);
    if (!row) return { kind: "not_found" };
    if (Date.parse(toIso(row.expiresAt)) <= Date.parse(now)) {
      return { kind: "expired" };
    }

    return {
      kind: "found",
      snapshot: {
        state: stateFromRows(
          row,
          await messageRowsFor(this.database, row.id),
        ),
      },
    };
  }

  async beginPracticeTurn(
    input: BeginPracticeTurnInput,
  ): Promise<BeginPracticeTurnResult> {
    databaseIdSchema.parse(input.anonymousSessionId);
    databaseIdSchema.parse(input.practiceSessionId);
    idempotencyKeySchema.parse(input.idempotencyKey);
    const now = toIso(input.now);

    return this.database.transaction(async (transaction) => {
      const [practice] = await transaction
        .select()
        .from(practiceSessions)
        .where(
          and(
            eq(practiceSessions.id, input.practiceSessionId),
            eq(
              practiceSessions.anonymousSessionId,
              input.anonymousSessionId,
            ),
          ),
        )
        .limit(1)
        .for("update");
      if (!practice) {
        return { kind: "rejected", reason: "not_found" };
      }

      const [existing] = await transaction
        .select()
        .from(practiceRequests)
        .where(
          and(
            eq(
              practiceRequests.practiceSessionId,
              input.practiceSessionId,
            ),
            eq(
              practiceRequests.idempotencyKey,
              input.idempotencyKey,
            ),
          ),
        )
        .limit(1)
        .for("update");
      if (existing?.status === "committed") {
        return {
          kind: "committed",
          receipt: practiceTurnReceiptSchema.parse(
            existing.receiptJson,
          ),
        };
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

      if (Date.parse(practice.expiresAt) <= Date.parse(now)) {
        return { kind: "rejected", reason: "expired" };
      }
      if (practice.status !== "active") {
        return { kind: "rejected", reason: "practice_not_active" };
      }
      if (
        practice.acceptedResponseCount >=
        COACHING_BETA_RULES.maxAcceptedResponses
      ) {
        return { kind: "rejected", reason: "allowance_exhausted" };
      }
      if (
        !["initial_simulation", "targeted_retry"].includes(
          practice.phase,
        )
      ) {
        return {
          kind: "rejected",
          reason: "phase_not_accepting_audio",
        };
      }
      if (
        practice.expectedLearnerSequence !==
        input.expectedLearnerSequence
      ) {
        return { kind: "rejected", reason: "stale_sequence" };
      }

      const [competing] = await transaction
        .select()
        .from(practiceRequests)
        .where(
          and(
            eq(
              practiceRequests.practiceSessionId,
              input.practiceSessionId,
            ),
            eq(
              practiceRequests.expectedLearnerSequence,
              input.expectedLearnerSequence,
            ),
            eq(practiceRequests.status, "processing"),
          ),
        )
        .limit(1)
        .for("update");
      if (competing && competing.id !== existing?.id) {
        if (
          competing.leaseExpiresAt &&
          Date.parse(competing.leaseExpiresAt) > Date.parse(now)
        ) {
          return {
            kind: "in_progress",
            retryAfterSeconds: Math.max(
              1,
              Math.ceil(
                (Date.parse(competing.leaseExpiresAt) -
                  Date.parse(now)) /
                  1_000,
              ),
            ),
          };
        }
        await transaction
          .update(practiceRequests)
          .set({
            status: "retryable_failure",
            leaseExpiresAt: null,
            failureReason: "provider_failure",
            updatedAt: now,
          })
          .where(eq(practiceRequests.id, competing.id));
      }

      const reservationId = randomUUID();
      const leaseExpiresAt = new Date(
        Date.parse(now) + PRACTICE_TURN_LEASE_MILLISECONDS,
      ).toISOString();
      if (existing) {
        await transaction
          .update(practiceRequests)
          .set({
            id: reservationId,
            expectedLearnerSequence: input.expectedLearnerSequence,
            status: "processing",
            leaseExpiresAt,
            learnerMessageId: null,
            partnerMessageId: null,
            receiptJson: null,
            failureReason: null,
            updatedAt: now,
            committedAt: null,
          })
          .where(eq(practiceRequests.id, existing.id));
      } else {
        await transaction.insert(practiceRequests).values({
          id: reservationId,
          practiceSessionId: input.practiceSessionId,
          idempotencyKey: input.idempotencyKey,
          expectedLearnerSequence: input.expectedLearnerSequence,
          status: "processing",
          leaseExpiresAt,
          createdAt: now,
          updatedAt: now,
        });
      }

      const rows = await transaction
        .select()
        .from(practiceMessages)
        .where(
          eq(
            practiceMessages.practiceSessionId,
            input.practiceSessionId,
          ),
        )
        .orderBy(asc(practiceMessages.sequence));
      return {
        kind: "ready",
        reservationId,
        leaseExpiresAt,
        snapshot: { state: stateFromRows(practice, rows) },
      };
    });
  }

  async commitPracticeTurn(
    input: CommitPracticeTurnInput,
  ): Promise<CommitPracticeTurnResult> {
    databaseIdSchema.parse(input.anonymousSessionId);
    databaseIdSchema.parse(input.practiceSessionId);
    databaseIdSchema.parse(input.reservationId);
    idempotencyKeySchema.parse(input.idempotencyKey);
    const nextState = practiceSessionStateSchema.parse(input.nextState);
    assertIdentity({
      anonymousSessionId: input.anonymousSessionId,
      practiceSessionId: input.practiceSessionId,
      state: nextState,
    });

    return this.database.transaction(async (transaction) => {
      const [practice] = await transaction
        .select()
        .from(practiceSessions)
        .where(
          and(
            eq(practiceSessions.id, input.practiceSessionId),
            eq(
              practiceSessions.anonymousSessionId,
              input.anonymousSessionId,
            ),
          ),
        )
        .limit(1)
        .for("update");
      const [request] = await transaction
        .select()
        .from(practiceRequests)
        .where(
          and(
            eq(
              practiceRequests.practiceSessionId,
              input.practiceSessionId,
            ),
            eq(
              practiceRequests.idempotencyKey,
              input.idempotencyKey,
            ),
          ),
        )
        .limit(1)
        .for("update");

      if (!practice) {
        return { kind: "rejected", reason: "practice_not_active" };
      }
      if (request?.status === "committed") {
        return {
          kind: "duplicate",
          receipt: practiceTurnReceiptSchema.parse(
            request.receiptJson,
          ),
        };
      }
      if (!request || request.id !== input.reservationId) {
        return { kind: "rejected", reason: "reservation_lost" };
      }
      if (practice.status !== "active") {
        return { kind: "rejected", reason: "practice_not_active" };
      }
      if (
        practice.acceptedResponseCount >=
        COACHING_BETA_RULES.maxAcceptedResponses
      ) {
        return { kind: "rejected", reason: "allowance_exhausted" };
      }
      if (
        !["initial_simulation", "targeted_retry"].includes(
          practice.phase,
        )
      ) {
        return {
          kind: "rejected",
          reason: "phase_not_accepting_audio",
        };
      }
      if (
        practice.expectedLearnerSequence !==
          input.expectedLearnerSequence ||
        request.expectedLearnerSequence !==
          input.expectedLearnerSequence
      ) {
        return { kind: "rejected", reason: "stale_sequence" };
      }

      const rows = await transaction
        .select()
        .from(practiceMessages)
        .where(
          eq(
            practiceMessages.practiceSessionId,
            input.practiceSessionId,
          ),
        )
        .orderBy(asc(practiceMessages.sequence));
      const currentState = stateFromRows(practice, rows);
      if (!canAcceptLearnerResponse(currentState)) {
        return {
          kind: "rejected",
          reason: "phase_not_accepting_audio",
        };
      }
      const acceptedMessages = validateCommittedMessages({
        currentState,
        acceptedMessages: input.acceptedMessages,
        nextState,
      });

      await transaction.insert(practiceMessages).values(
        acceptedMessages.map((message) => ({
          id: message.id,
          practiceSessionId: input.practiceSessionId,
          role: message.role,
          phase: message.phase,
          learnerResponseNumber: message.learnerResponseNumber,
          sequence: message.sequence,
          text: message.text,
          createdAt: message.createdAt,
        })),
      );
      await transaction
        .update(practiceSessions)
        .set(sessionValues(nextState))
        .where(eq(practiceSessions.id, input.practiceSessionId));

      const receipt: PracticeTurnReceipt =
        practiceTurnReceiptSchema.parse({
          idempotencyKey: input.idempotencyKey,
          practiceSessionId: input.practiceSessionId,
          acceptedMessages,
          state: nextState,
        });
      const learnerMessage = acceptedMessages.find(
        (message) => message.role === "learner",
      );
      const partnerMessage = acceptedMessages.find(
        (message) => message.role === "partner",
      );
      await transaction
        .update(practiceRequests)
        .set({
          status: "committed",
          leaseExpiresAt: null,
          learnerMessageId: learnerMessage?.id,
          partnerMessageId: partnerMessage?.id ?? null,
          receiptJson: receipt,
          failureReason: null,
          updatedAt: nextState.updatedAt,
          committedAt: nextState.updatedAt,
        })
        .where(eq(practiceRequests.id, input.reservationId));

      return { kind: "committed", receipt };
    });
  }

  async releasePracticeTurn(
    input: ReleasePracticeTurnInput,
  ): Promise<void> {
    databaseIdSchema.parse(input.practiceSessionId);
    databaseIdSchema.parse(input.reservationId);
    idempotencyKeySchema.parse(input.idempotencyKey);
    await this.database
      .update(practiceRequests)
      .set({
        status: "retryable_failure",
        leaseExpiresAt: null,
        failureReason: input.reason,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(practiceRequests.id, input.reservationId),
          eq(
            practiceRequests.practiceSessionId,
            input.practiceSessionId,
          ),
          eq(
            practiceRequests.idempotencyKey,
            input.idempotencyKey,
          ),
          eq(practiceRequests.status, "processing"),
        ),
      );
  }

  async savePracticeProgress(
    input: SavePracticeProgressInput,
  ): Promise<SavePracticeProgressResult> {
    databaseIdSchema.parse(input.anonymousSessionId);
    databaseIdSchema.parse(input.practiceSessionId);
    const expectedUpdatedAt = toIso(input.expectedUpdatedAt);
    const now = toIso(input.now);
    const nextState = practiceSessionStateSchema.parse(input.nextState);
    assertIdentity({
      anonymousSessionId: input.anonymousSessionId,
      practiceSessionId: input.practiceSessionId,
      state: nextState,
    });

    return this.database.transaction(async (transaction) => {
      const [row] = await transaction
        .select()
        .from(practiceSessions)
        .where(
          and(
            eq(practiceSessions.id, input.practiceSessionId),
            eq(
              practiceSessions.anonymousSessionId,
              input.anonymousSessionId,
            ),
          ),
        )
        .limit(1)
        .for("update");
      if (!row) return { kind: "rejected", reason: "not_found" };
      if (Date.parse(row.expiresAt) <= Date.parse(now)) {
        return { kind: "rejected", reason: "expired" };
      }
      if (
        row.phase !== input.expectedPhase ||
        toIso(row.updatedAt) !== expectedUpdatedAt
      ) {
        return { kind: "rejected", reason: "stale_state" };
      }

      const messageRows = await transaction
        .select()
        .from(practiceMessages)
        .where(
          eq(
            practiceMessages.practiceSessionId,
            input.practiceSessionId,
          ),
        )
        .orderBy(asc(practiceMessages.sequence));
      const current = stateFromRows(row, messageRows);
      if (sameJson(current, nextState)) {
        return {
          kind: "unchanged",
          snapshot: { state: current },
        };
      }
      const transition = validatePracticeProgressTransition(
        current,
        nextState,
      );
      if (!transition) {
        return { kind: "rejected", reason: "invalid_transition" };
      }

      await transaction
        .update(practiceSessions)
        .set(sessionValues(nextState))
        .where(eq(practiceSessions.id, input.practiceSessionId));
      if (transition.appendedMessages.length > 0) {
        await transaction.insert(practiceMessages).values(
          transition.appendedMessages.map((message) => ({
            id: message.id,
            practiceSessionId: input.practiceSessionId,
            role: message.role,
            phase: message.phase,
            learnerResponseNumber: message.learnerResponseNumber,
            sequence: message.sequence,
            text: message.text,
            createdAt: message.createdAt,
          })),
        );
      }
      return {
        kind: "saved",
        snapshot: { state: nextState },
      };
    });
  }

  async deletePracticeSession(input: {
    anonymousSessionId: string;
    practiceSessionId: string;
  }): Promise<boolean> {
    databaseIdSchema.parse(input.anonymousSessionId);
    databaseIdSchema.parse(input.practiceSessionId);
    const rows = await this.database
      .delete(practiceSessions)
      .where(
        and(
          eq(practiceSessions.id, input.practiceSessionId),
          eq(
            practiceSessions.anonymousSessionId,
            input.anonymousSessionId,
          ),
        ),
      )
      .returning({ id: practiceSessions.id });
    return rows.length === 1;
  }

  async deleteExpiredPracticeSessions(
    now: string,
    limit: number,
  ): Promise<number> {
    const timestamp = toIso(now);
    if (!Number.isInteger(limit) || limit < 1 || limit > 1_000) {
      throw new PracticePersistenceInvariantError(
        "Expiration cleanup limit must be an integer from 1 through 1000.",
      );
    }

    return this.database.transaction(async (transaction) => {
      const candidates = await transaction
        .select({ id: practiceSessions.id })
        .from(practiceSessions)
        .where(lte(practiceSessions.expiresAt, timestamp))
        .orderBy(asc(practiceSessions.expiresAt))
        .limit(limit)
        .for("update", { skipLocked: true });
      if (candidates.length > 0) {
        await transaction.delete(practiceSessions).where(
          inArray(
            practiceSessions.id,
            candidates.map((candidate) => candidate.id),
          ),
        );
      }

      await removeExpiredOwners(transaction, timestamp);
      return candidates.length;
    });
  }
}
