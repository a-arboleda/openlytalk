import { sql } from "drizzle-orm";
import { removeExpiredOwners } from "@/lib/operations/retention";
import { randomUUID } from "node:crypto";

import {
  and,
  asc,
  eq,
  gt,
  inArray,
  lte,
} from "drizzle-orm";

import type {
  AnonymousSessionRecord,
  BeginTurnInput,
  BeginTurnResult,
  CommitTurnInput,
  CommitTurnResult,
  ConversationRepository,
  ConversationSnapshot,
  CreateConversationInput,
  EndConversationInput,
  EndConversationResult,
  ReleaseTurnInput,
  SaveDebriefResult,
  TurnReceipt,
} from "@/lib/persistence/conversation-repository";
import type { OpenlyTalkDatabase } from "@/lib/persistence/postgres/database";
import {
  anonymousSessions,
  conversations,
  debriefs,
  messages,
  turnRequests,
  type PersistedEngineDetails,
} from "@/lib/persistence/postgres/schema";
import { V1_RULES } from "@/lib/product-rules";
import {
  conversationStateSchema,
  transcriptMessageSchema,
  type ConversationState,
  type TranscriptMessage,
} from "@/lib/validation/conversation";
import { debriefSchema, type Debrief } from "@/lib/validation/debrief";
import {
  anonymousSessionRecordSchema,
  databaseIdSchema,
  idempotencyKeySchema,
  turnReceiptSchema,
} from "@/lib/validation/persistence";

const TURN_LEASE_MILLISECONDS = 2 * 60 * 1_000;

type ConversationRow = typeof conversations.$inferSelect;
type MessageRow = typeof messages.$inferSelect;
type DebriefRow = typeof debriefs.$inferSelect;

export class RepositoryInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RepositoryInvariantError";
  }
}

function toIso(value: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new RepositoryInvariantError("Persistence returned an invalid timestamp.");
  }
  return timestamp.toISOString();
}

function toTranscriptMessage(row: MessageRow): TranscriptMessage {
  return transcriptMessageSchema.parse({
    id: row.id,
    role: row.role,
    sequence: row.sequence,
    text: row.text,
    createdAt: toIso(row.createdAt),
  });
}

function engineDetails(state: ConversationState): PersistedEngineDetails {
  return {
    scenePlan: state.scenePlan,
    trust: state.trust,
    emotion: state.emotion,
    warningEvidenceMessageId: state.warningEvidenceMessageId,
    topics: state.topics,
    privateFactRevealed: state.privateFactRevealed,
    evidenceEvents: state.evidenceEvents,
  };
}

function toConversationValues(sessionId: string, state: ConversationState) {
  return {
    id: state.conversationId,
    sessionId,
    schemaVersion: state.schemaVersion,
    conversationType: state.conversationType,
    context: state.context,
    status: state.status,
    terminationReason: state.terminationReason,
    outcomeCategory: state.outcomeCategory,
    stage: state.stage,
    mode: state.mode,
    acceptedResponseCount: state.acceptedResponseCount,
    expectedSequence: state.expectedSequence,
    trustLevel: state.trust.level,
    emotionKind: state.emotion.kind,
    emotionIntensity: state.emotion.intensity,
    warningActive: state.warningActive,
    stateJson: engineDetails(state),
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
    expiresAt: state.expiresAt,
  } satisfies typeof conversations.$inferInsert;
}

function reconstructState(
  row: ConversationRow,
  messageRows: MessageRow[],
): ConversationState {
  const details = row.stateJson;
  return conversationStateSchema.parse({
    schemaVersion: row.schemaVersion,
    conversationId: row.id,
    status: row.status,
    terminationReason: row.terminationReason,
    outcomeCategory: row.outcomeCategory,
    conversationType: row.conversationType,
    context: row.context,
    scenePlan: details.scenePlan,
    stage: row.stage,
    mode: row.mode,
    acceptedResponseCount: row.acceptedResponseCount,
    expectedSequence: row.expectedSequence,
    trust: details.trust,
    emotion: details.emotion,
    warningActive: row.warningActive,
    warningEvidenceMessageId: details.warningEvidenceMessageId,
    topics: details.topics,
    privateFactRevealed: details.privateFactRevealed,
    evidenceEvents: details.evidenceEvents,
    messages: messageRows.map(toTranscriptMessage),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
    expiresAt: toIso(row.expiresAt),
  });
}

function snapshotFromRows(
  row: ConversationRow,
  messageRows: MessageRow[],
  debriefRow: DebriefRow | undefined,
): ConversationSnapshot {
  return {
    sessionId: row.sessionId,
    state: reconstructState(row, messageRows),
    debrief: debriefRow ? debriefSchema.parse(debriefRow.contentJson) : null,
  };
}

function validateDatabaseIdentity(sessionId: string, state: ConversationState) {
  databaseIdSchema.parse(sessionId);
  databaseIdSchema.parse(state.conversationId);
  for (const message of state.messages) {
    databaseIdSchema.parse(message.id);
  }
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validateCommitTransition(
  current: ConversationState,
  input: CommitTurnInput,
  nextState: ConversationState,
) {
  const { learnerMessage, sofiaMessage, expectedSequence } = input;

  if (
    learnerMessage.role !== "learner" ||
    learnerMessage.sequence !== expectedSequence ||
    sofiaMessage.role !== "sofia" ||
    sofiaMessage.sequence !== expectedSequence + 1
  ) {
    throw new RepositoryInvariantError(
      "Committed learner and Sofia messages must occupy the next ordered pair.",
    );
  }

  if (
    nextState.conversationId !== current.conversationId ||
    nextState.schemaVersion !== current.schemaVersion ||
    nextState.conversationType !== current.conversationType ||
    nextState.context !== current.context ||
    nextState.createdAt !== current.createdAt ||
    nextState.expiresAt !== current.expiresAt
  ) {
    throw new RepositoryInvariantError(
      "A turn cannot change immutable conversation identity or retention fields.",
    );
  }

  if (
    nextState.acceptedResponseCount !== current.acceptedResponseCount + 1 ||
    nextState.expectedSequence !== current.expectedSequence + 2
  ) {
    throw new RepositoryInvariantError(
      "A committed turn must consume one response and two message sequences.",
    );
  }

  const expectedMessages = [
    ...current.messages,
    learnerMessage,
    sofiaMessage,
  ];
  if (!sameJson(nextState.messages, expectedMessages)) {
    throw new RepositoryInvariantError(
      "The next state transcript must append exactly the committed message pair.",
    );
  }
}

export class DrizzleConversationRepository implements ConversationRepository {
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
      throw new RepositoryInvariantError(
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

  async createConversation(
    input: CreateConversationInput,
  ): Promise<ConversationSnapshot> {
    const state = conversationStateSchema.parse(input.state);
    validateDatabaseIdentity(input.sessionId, state);

    return this.database.transaction(async (transaction) => {
      const [session] = await transaction
        .select({ id: anonymousSessions.id })
        .from(anonymousSessions)
        .where(
          and(
            eq(anonymousSessions.id, input.sessionId),
            gt(anonymousSessions.expiresAt, state.createdAt),
          ),
        )
        .limit(1)
        .for("update");

      if (!session) {
        throw new RepositoryInvariantError(
          "A conversation requires an active owning session.",
        );
      }

      await transaction
        .insert(conversations)
        .values(toConversationValues(input.sessionId, state));

      if (state.messages.length > 0) {
        await transaction.insert(messages).values(
          state.messages.map((message) => ({
            id: message.id,
            conversationId: state.conversationId,
            role: message.role,
            sequence: message.sequence,
            text: message.text,
            createdAt: message.createdAt,
          })),
        );
      }

      return { sessionId: input.sessionId, state, debrief: null };
    });
  }

  async getConversation(input: {
    sessionId: string;
    conversationId: string;
    now: string;
  }): Promise<ConversationSnapshot | null> {
    databaseIdSchema.parse(input.sessionId);
    databaseIdSchema.parse(input.conversationId);
    const now = toIso(input.now);

    const [row] = await this.database
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.id, input.conversationId),
          eq(conversations.sessionId, input.sessionId),
          gt(conversations.expiresAt, now),
        ),
      )
      .limit(1);

    if (!row) return null;

    const [messageRows, debriefRows] = await Promise.all([
      this.database
        .select()
        .from(messages)
        .where(eq(messages.conversationId, row.id))
        .orderBy(asc(messages.sequence)),
      this.database
        .select()
        .from(debriefs)
        .where(eq(debriefs.conversationId, row.id))
        .limit(1),
    ]);

    return snapshotFromRows(row, messageRows, debriefRows[0]);
  }

  async beginTurn(input: BeginTurnInput): Promise<BeginTurnResult> {
    databaseIdSchema.parse(input.sessionId);
    databaseIdSchema.parse(input.conversationId);
    idempotencyKeySchema.parse(input.idempotencyKey);
    const now = toIso(input.now);

    return this.database.transaction(async (transaction) => {
      const [conversation] = await transaction
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.id, input.conversationId),
            eq(conversations.sessionId, input.sessionId),
          ),
        )
        .limit(1)
        .for("update");

      if (!conversation) return { kind: "rejected", reason: "not_found" };

      const [existingRequest] = await transaction
        .select()
        .from(turnRequests)
        .where(
          and(
            eq(turnRequests.conversationId, input.conversationId),
            eq(turnRequests.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1)
        .for("update");

      if (existingRequest?.status === "committed") {
        return {
          kind: "committed",
          receipt: turnReceiptSchema.parse(existingRequest.receiptJson),
        };
      }

      if (
        existingRequest?.status === "processing" &&
        existingRequest.leaseExpiresAt &&
        Date.parse(existingRequest.leaseExpiresAt) > Date.parse(now)
      ) {
        return {
          kind: "in_progress",
          retryAfterSeconds: Math.max(
            1,
            Math.ceil(
              (Date.parse(existingRequest.leaseExpiresAt) - Date.parse(now)) /
                1_000,
            ),
          ),
        };
      }

      if (Date.parse(conversation.expiresAt) <= Date.parse(now)) {
        return { kind: "rejected", reason: "expired" };
      }
      if (conversation.status !== "active") {
        return { kind: "rejected", reason: "conversation_not_active" };
      }
      if (
        conversation.acceptedResponseCount >= V1_RULES.maxAcceptedResponses
      ) {
        return { kind: "rejected", reason: "allowance_exhausted" };
      }
      if (conversation.expectedSequence !== input.expectedSequence) {
        return { kind: "rejected", reason: "stale_sequence" };
      }

      const [otherProcessingRequest] = await transaction
        .select()
        .from(turnRequests)
        .where(
          and(
            eq(turnRequests.conversationId, input.conversationId),
            eq(turnRequests.expectedSequence, input.expectedSequence),
            eq(turnRequests.status, "processing"),
          ),
        )
        .limit(1)
        .for("update");

      if (
        otherProcessingRequest &&
        otherProcessingRequest.id !== existingRequest?.id
      ) {
        if (
          otherProcessingRequest.leaseExpiresAt &&
          Date.parse(otherProcessingRequest.leaseExpiresAt) > Date.parse(now)
        ) {
          return {
            kind: "in_progress",
            retryAfterSeconds: Math.max(
              1,
              Math.ceil(
                (Date.parse(otherProcessingRequest.leaseExpiresAt) -
                  Date.parse(now)) /
                  1_000,
              ),
            ),
          };
        }

        await transaction
          .update(turnRequests)
          .set({
            status: "retryable_failure",
            leaseExpiresAt: null,
            failureReason: "provider_failure",
            updatedAt: now,
          })
          .where(eq(turnRequests.id, otherProcessingRequest.id));
      }

      const reservationId = randomUUID();
      const leaseExpiresAt = new Date(
        Date.parse(now) + TURN_LEASE_MILLISECONDS,
      ).toISOString();

      if (existingRequest) {
        await transaction
          .update(turnRequests)
          .set({
            id: reservationId,
            expectedSequence: input.expectedSequence,
            status: "processing",
            leaseExpiresAt,
            learnerMessageId: null,
            sofiaMessageId: null,
            receiptJson: null,
            failureReason: null,
            updatedAt: now,
            committedAt: null,
          })
          .where(eq(turnRequests.id, existingRequest.id));
      } else {
        await transaction.insert(turnRequests).values({
          id: reservationId,
          conversationId: input.conversationId,
          idempotencyKey: input.idempotencyKey,
          expectedSequence: input.expectedSequence,
          status: "processing",
          leaseExpiresAt,
          createdAt: now,
          updatedAt: now,
        });
      }

      const messageRows = await transaction
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversation.id))
        .orderBy(asc(messages.sequence));
      const debriefRows = await transaction
        .select()
        .from(debriefs)
        .where(eq(debriefs.conversationId, conversation.id))
        .limit(1);

      return {
        kind: "ready",
        reservationId,
        leaseExpiresAt,
        snapshot: snapshotFromRows(
          conversation,
          messageRows,
          debriefRows[0],
        ),
      };
    });
  }

  async commitTurn(input: CommitTurnInput): Promise<CommitTurnResult> {
    databaseIdSchema.parse(input.sessionId);
    databaseIdSchema.parse(input.conversationId);
    databaseIdSchema.parse(input.reservationId);
    databaseIdSchema.parse(input.learnerMessage.id);
    databaseIdSchema.parse(input.sofiaMessage.id);
    idempotencyKeySchema.parse(input.idempotencyKey);
    const learnerMessage = transcriptMessageSchema.parse(input.learnerMessage);
    const sofiaMessage = transcriptMessageSchema.parse(input.sofiaMessage);
    const nextState = conversationStateSchema.parse(input.nextState);
    validateDatabaseIdentity(input.sessionId, nextState);

    return this.database.transaction(async (transaction) => {
      const [conversation] = await transaction
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.id, input.conversationId),
            eq(conversations.sessionId, input.sessionId),
          ),
        )
        .limit(1)
        .for("update");

      const [request] = await transaction
        .select()
        .from(turnRequests)
        .where(
          and(
            eq(turnRequests.conversationId, input.conversationId),
            eq(turnRequests.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1)
        .for("update");

      if (!conversation) {
        return { kind: "rejected", reason: "conversation_not_active" };
      }

      if (request?.status === "committed") {
        return {
          kind: "duplicate",
          receipt: turnReceiptSchema.parse(request.receiptJson),
        };
      }

      if (!request || request.id !== input.reservationId) {
        return { kind: "rejected", reason: "reservation_lost" };
      }
      if (conversation.status !== "active") {
        return { kind: "rejected", reason: "conversation_not_active" };
      }
      if (
        conversation.acceptedResponseCount >= V1_RULES.maxAcceptedResponses
      ) {
        return { kind: "rejected", reason: "allowance_exhausted" };
      }
      if (
        conversation.expectedSequence !== input.expectedSequence ||
        request.expectedSequence !== input.expectedSequence
      ) {
        return { kind: "rejected", reason: "stale_sequence" };
      }

      const messageRows = await transaction
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversation.id))
        .orderBy(asc(messages.sequence));
      const currentState = reconstructState(conversation, messageRows);
      validateCommitTransition(currentState, input, nextState);

      await transaction.insert(messages).values([
        {
          id: learnerMessage.id,
          conversationId: input.conversationId,
          role: learnerMessage.role,
          sequence: learnerMessage.sequence,
          text: learnerMessage.text,
          createdAt: learnerMessage.createdAt,
        },
        {
          id: sofiaMessage.id,
          conversationId: input.conversationId,
          role: sofiaMessage.role,
          sequence: sofiaMessage.sequence,
          text: sofiaMessage.text,
          createdAt: sofiaMessage.createdAt,
        },
      ]);

      await transaction
        .update(conversations)
        .set(toConversationValues(input.sessionId, nextState))
        .where(eq(conversations.id, input.conversationId));

      const receipt: TurnReceipt = turnReceiptSchema.parse({
        idempotencyKey: input.idempotencyKey,
        conversationId: input.conversationId,
        learnerMessage,
        sofiaMessage,
        state: nextState,
      });

      await transaction
        .update(turnRequests)
        .set({
          status: "committed",
          leaseExpiresAt: null,
          learnerMessageId: learnerMessage.id,
          sofiaMessageId: sofiaMessage.id,
          receiptJson: receipt,
          failureReason: null,
          updatedAt: nextState.updatedAt,
          committedAt: nextState.updatedAt,
        })
        .where(eq(turnRequests.id, input.reservationId));

      return { kind: "committed", receipt };
    });
  }

  async releaseTurn(input: ReleaseTurnInput): Promise<void> {
    databaseIdSchema.parse(input.conversationId);
    databaseIdSchema.parse(input.reservationId);
    idempotencyKeySchema.parse(input.idempotencyKey);
    await this.database
      .update(turnRequests)
      .set({
        status: "retryable_failure",
        leaseExpiresAt: null,
        failureReason: input.reason,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(turnRequests.id, input.reservationId),
          eq(turnRequests.conversationId, input.conversationId),
          eq(turnRequests.idempotencyKey, input.idempotencyKey),
          eq(turnRequests.status, "processing"),
        ),
      );
  }

  async endConversation(
    input: EndConversationInput,
  ): Promise<EndConversationResult> {
    databaseIdSchema.parse(input.sessionId);
    databaseIdSchema.parse(input.conversationId);
    const now = toIso(input.now);

    return this.database.transaction(async (transaction) => {
      const [conversation] = await transaction
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.id, input.conversationId),
            eq(conversations.sessionId, input.sessionId),
            gt(conversations.expiresAt, now),
          ),
        )
        .limit(1)
        .for("update");

      if (!conversation) {
        return { kind: "rejected", reason: "not_found" };
      }

      const messageRows = await transaction
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversation.id))
        .orderBy(asc(messages.sequence));
      const currentState = reconstructState(conversation, messageRows);

      if (
        currentState.status === "ended" &&
        currentState.terminationReason === "user_exit"
      ) {
        return { kind: "already_ended", state: currentState };
      }
      if (currentState.status !== "active") {
        return { kind: "rejected", reason: "conversation_not_active" };
      }

      const nextState = conversationStateSchema.parse({
        ...currentState,
        status: "ended",
        terminationReason: "user_exit",
        outcomeCategory: null,
        updatedAt: now,
      });

      await transaction
        .update(conversations)
        .set(toConversationValues(input.sessionId, nextState))
        .where(eq(conversations.id, input.conversationId));

      return { kind: "ended", state: nextState };
    });
  }

  async saveDebrief(input: {
    sessionId: string;
    conversationId: string;
    debrief: Debrief;
  }): Promise<SaveDebriefResult> {
    databaseIdSchema.parse(input.sessionId);
    databaseIdSchema.parse(input.conversationId);
    const validatedDebrief = debriefSchema.parse(input.debrief);

    return this.database.transaction(async (transaction) => {
      const [conversation] = await transaction
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.id, input.conversationId),
            eq(conversations.sessionId, input.sessionId),
          ),
        )
        .limit(1)
        .for("update");

      if (!conversation) {
        return { kind: "rejected", reason: "not_found" };
      }

      const [existing] = await transaction
        .select()
        .from(debriefs)
        .where(eq(debriefs.conversationId, input.conversationId))
        .limit(1);
      if (existing) {
        return {
          kind: "existing",
          debrief: debriefSchema.parse(existing.contentJson),
        };
      }
      if (conversation.status !== "debrief_pending") {
        return { kind: "rejected", reason: "not_pending" };
      }

      const now = new Date().toISOString();
      await transaction.insert(debriefs).values({
        conversationId: input.conversationId,
        kind: validatedDebrief.kind,
        contentJson: validatedDebrief,
        createdAt: now,
      });
      await transaction
        .update(conversations)
        .set({ status: "completed", updatedAt: now })
        .where(eq(conversations.id, input.conversationId));

      return { kind: "saved", debrief: validatedDebrief };
    });
  }

  async deleteConversation(input: {
    sessionId: string;
    conversationId: string;
  }): Promise<boolean> {
    databaseIdSchema.parse(input.sessionId);
    databaseIdSchema.parse(input.conversationId);
    const rows = await this.database
      .delete(conversations)
      .where(
        and(
          eq(conversations.id, input.conversationId),
          eq(conversations.sessionId, input.sessionId),
        ),
      )
      .returning({ id: conversations.id });
    return rows.length === 1;
  }

  async deleteExpired(now: string, limit: number): Promise<number> {
    const timestamp = toIso(now);
    if (!Number.isInteger(limit) || limit < 1 || limit > 1_000) {
      throw new RepositoryInvariantError(
        "Expiration cleanup limit must be an integer from 1 through 1000.",
      );
    }

    return this.database.transaction(async (transaction) => {
      const candidates = await transaction
        .select({ id: conversations.id })
        .from(conversations)
        .where(lte(conversations.expiresAt, timestamp))
        .orderBy(asc(conversations.expiresAt))
        .limit(limit)
        .for("update", { skipLocked: true });

      if (candidates.length > 0) {
        await transaction.delete(conversations).where(
          inArray(
            conversations.id,
            candidates.map((candidate) => candidate.id),
          ),
        );
      }

      await removeExpiredOwners(transaction, timestamp);

      return candidates.length;
    });
  }
}
