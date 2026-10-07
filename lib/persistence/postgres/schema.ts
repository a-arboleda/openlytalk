import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { CONTEXT_VALUES, CONVERSATION_TYPE_VALUES } from "@/lib/product-rules";
import type { TurnReceipt } from "@/lib/persistence/conversation-repository";
import type { PracticeTurnReceipt } from "@/lib/persistence/practice-repository";
import type {
  CoachingBreak,
  FinalSessionTakeaway,
  HelpEvent,
  PracticeEvidenceEvent,
  PracticePlan,
  PracticeSetup,
  RetryOutcome,
  RetryTarget,
  SessionPhase,
  SessionStatus,
  TerminationReason as PracticeTerminationReason,
} from "@/lib/coaching/schemas";
import type {
  ConversationState,
  NextTurnOutput,
} from "@/lib/validation/conversation";
import type { Debrief } from "@/lib/validation/debrief";

const PERSISTED_CONVERSATION_TYPE_VALUES = [
  "Everyday Conversations",
  ...CONVERSATION_TYPE_VALUES,
] as const;

export const conversationTypeEnum = pgEnum(
  "conversation_type",
  PERSISTED_CONVERSATION_TYPE_VALUES,
);
export const conversationContextEnum = pgEnum(
  "conversation_context",
  CONTEXT_VALUES,
);
export const lifecycleStatusEnum = pgEnum("lifecycle_status", [
  "creating",
  "active",
  "debrief_pending",
  "completed",
  "ended",
  "creation_failed",
]);
export const terminationReasonEnum = pgEnum("termination_reason", [
  "meaningful_outcome",
  "response_limit",
  "user_exit",
  "boundary_repeat",
  "safety_override",
]);
export const outcomeCategoryEnum = pgEnum("outcome_category", [
  "connection_reached",
  "perspective_clarified",
  "decision_reached",
  "repair_reached",
  "boundary_respected",
  "unresolved_but_acknowledged",
  "safety_ended",
]);
export const conversationStageEnum = pgEnum("conversation_stage", [
  "opening",
  "developing",
  "resolving",
  "closing",
]);
export const conversationModeEnum = pgEnum("conversation_mode", [
  "normal",
  "repair",
]);
export const trustLevelEnum = pgEnum("trust_level", [
  "guarded",
  "cautious",
  "comfortable",
  "open",
]);
export const emotionKindEnum = pgEnum("emotion_kind", [
  "calm",
  "curious",
  "amused",
  "pleased",
  "uncertain",
  "anxious",
  "disappointed",
  "frustrated",
  "hurt",
  "guarded",
  "hopeful",
  "relieved",
]);
export const emotionIntensityEnum = pgEnum("emotion_intensity", [
  "low",
  "medium",
  "high",
]);
export const messageRoleEnum = pgEnum("message_role", ["learner", "sofia"]);
export const turnRequestStatusEnum = pgEnum("turn_request_status", [
  "processing",
  "committed",
  "retryable_failure",
]);
export const debriefKindEnum = pgEnum("debrief_kind", ["full", "partial"]);
export const practiceSessionStatusEnum = pgEnum("practice_session_status", [
  "active",
  "completed",
  "ended",
]);
export const practiceSessionPhaseEnum = pgEnum("practice_session_phase", [
  "briefing",
  "initial_simulation",
  "coaching_break",
  "targeted_retry",
  "finalizing",
  "final_takeaway",
]);
export const practiceTerminationReasonEnum = pgEnum(
  "practice_termination_reason",
  [
    "practice_completed",
    "response_limit",
    "user_exit",
    "boundary_repeat",
    "safety_override",
    "state_error",
  ],
);
export const practiceMessageRoleEnum = pgEnum("practice_message_role", [
  "learner",
  "partner",
]);
export const practiceMessagePhaseEnum = pgEnum("practice_message_phase", [
  "initial_simulation",
  "targeted_retry",
]);
export const practiceRequestStatusEnum = pgEnum("practice_request_status", [
  "processing",
  "committed",
  "retryable_failure",
]);

export type PersistedEngineDetails = Pick<
  ConversationState,
  | "scenePlan"
  | "trust"
  | "emotion"
  | "warningEvidenceMessageId"
  | "topics"
  | "privateFactRevealed"
  | "evidenceEvents"
>;

export type PersistedMessageMetadata = {
  interpretation?: NextTurnOutput["interpretation"];
  communicationEvidence?: NextTurnOutput["communicationEvidence"];
  safetyClassification?: NextTurnOutput["safetyClassification"];
  boundaryAction?: NextTurnOutput["boundaryAction"];
};

export type PersistedPracticeMessageMetadata = {
  safetyClassification?: "none" | "boundary_violation" | "safety_override";
  boundaryAction?: "none" | "warn" | "end" | "safety_stop";
  challengeUpdate?: "no_change" | "introduced" | "resolved";
};

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
};

export const anonymousSessions = pgTable(
  "anonymous_sessions",
  {
    id: uuid("id").primaryKey(),
    createdAt: timestamps.createdAt,
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" })
      .notNull(),
  },
  (table) => [
    index("anonymous_sessions_expires_at_idx").on(table.expiresAt),
    check(
      "anonymous_sessions_expiry_after_creation",
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
  ],
);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => anonymousSessions.id, { onDelete: "cascade" }),
    schemaVersion: integer("schema_version").notNull().default(2),
    conversationType: conversationTypeEnum("conversation_type").notNull(),
    context: conversationContextEnum("context").notNull(),
    status: lifecycleStatusEnum("status").notNull(),
    terminationReason: terminationReasonEnum("termination_reason"),
    outcomeCategory: outcomeCategoryEnum("outcome_category"),
    stage: conversationStageEnum("stage").notNull(),
    mode: conversationModeEnum("mode").notNull(),
    acceptedResponseCount: smallint("accepted_response_count")
      .notNull()
      .default(0),
    expectedSequence: integer("expected_sequence").notNull(),
    trustLevel: trustLevelEnum("trust_level").notNull(),
    emotionKind: emotionKindEnum("emotion_kind").notNull(),
    emotionIntensity: emotionIntensityEnum("emotion_intensity").notNull(),
    warningActive: boolean("warning_active").notNull().default(false),
    stateJson: jsonb("state_json").$type<PersistedEngineDetails>().notNull(),
    createdAt: timestamps.createdAt,
    updatedAt: timestamps.updatedAt,
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" })
      .notNull(),
  },
  (table) => [
    index("conversations_session_id_idx").on(table.sessionId),
    index("conversations_expires_at_idx").on(table.expiresAt),
    check(
      "conversations_response_count_range",
      sql`${table.acceptedResponseCount} between 0 and 8`,
    ),
    check(
      "conversations_expected_sequence_nonnegative",
      sql`${table.expectedSequence} >= 0`,
    ),
    check(
      "conversations_expiry_after_creation",
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
    check(
      "conversations_active_has_no_termination",
      sql`${table.status} <> 'active' or ${table.terminationReason} is null`,
    ),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: messageRoleEnum("role").notNull(),
    sequence: integer("sequence").notNull(),
    text: text("text").notNull(),
    metadataJson: jsonb("metadata_json").$type<PersistedMessageMetadata>(),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    uniqueIndex("messages_conversation_sequence_uidx").on(
      table.conversationId,
      table.sequence,
    ),
    index("messages_conversation_id_idx").on(table.conversationId),
    check("messages_sequence_nonnegative", sql`${table.sequence} >= 0`),
    check("messages_text_not_blank", sql`length(btrim(${table.text})) > 0`),
  ],
);

export const turnRequests = pgTable(
  "turn_requests",
  {
    id: uuid("id").primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
    expectedSequence: integer("expected_sequence").notNull(),
    status: turnRequestStatusEnum("status").notNull(),
    leaseExpiresAt: timestamp("lease_expires_at", {
      withTimezone: true,
      mode: "string",
    }),
    learnerMessageId: uuid("learner_message_id").references(() => messages.id, {
      onDelete: "cascade",
    }),
    sofiaMessageId: uuid("sofia_message_id").references(() => messages.id, {
      onDelete: "cascade",
    }),
    receiptJson: jsonb("receipt_json").$type<TurnReceipt>(),
    failureReason: varchar("failure_reason", { length: 64 }),
    createdAt: timestamps.createdAt,
    updatedAt: timestamps.updatedAt,
    committedAt: timestamp("committed_at", {
      withTimezone: true,
      mode: "string",
    }),
  },
  (table) => [
    uniqueIndex("turn_requests_conversation_idempotency_uidx").on(
      table.conversationId,
      table.idempotencyKey,
    ),
    uniqueIndex("turn_requests_committed_sequence_uidx")
      .on(table.conversationId, table.expectedSequence)
      .where(sql`${table.status} = 'committed'`),
    uniqueIndex("turn_requests_processing_sequence_uidx")
      .on(table.conversationId, table.expectedSequence)
      .where(sql`${table.status} = 'processing'`),
    index("turn_requests_lease_expires_at_idx").on(table.leaseExpiresAt),
    check(
      "turn_requests_expected_sequence_nonnegative",
      sql`${table.expectedSequence} >= 0`,
    ),
    check(
      "turn_requests_committed_has_result",
      sql`${table.status} <> 'committed' or (${table.committedAt} is not null and ${table.receiptJson} is not null and ${table.learnerMessageId} is not null and ${table.sofiaMessageId} is not null)`,
    ),
  ],
);

export const debriefs = pgTable(
  "debriefs",
  {
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    kind: debriefKindEnum("kind").notNull(),
    contentJson: jsonb("content_json").$type<Debrief>().notNull(),
    createdAt: timestamps.createdAt,
  },
  (table) => [primaryKey({ columns: [table.conversationId] })],
);

export const practiceSessions = pgTable(
  "practice_sessions",
  {
    id: uuid("id").primaryKey(),
    anonymousSessionId: uuid("anonymous_session_id")
      .notNull()
      .references(() => anonymousSessions.id, { onDelete: "cascade" }),
    schemaVersion: integer("schema_version").notNull().default(6),
    status: practiceSessionStatusEnum("status")
      .$type<SessionStatus>()
      .notNull(),
    phase: practiceSessionPhaseEnum("phase").$type<SessionPhase>().notNull(),
    setupJson: jsonb("setup_json").$type<PracticeSetup>().notNull(),
    planJson: jsonb("plan_json").$type<PracticePlan>().notNull(),
    situationReplacementCount: smallint("situation_replacement_count")
      .notNull()
      .default(0),
    lastSituationReplacementKey: varchar("last_situation_replacement_key", {
      length: 128,
    }),
    acceptedResponseCount: smallint("accepted_response_count")
      .notNull()
      .default(0),
    expectedLearnerSequence: integer("expected_learner_sequence")
      .notNull()
      .default(0),
    evidenceEventsJson: jsonb("evidence_events_json")
      .$type<PracticeEvidenceEvent[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    helpEventsJson: jsonb("help_events_json")
      .$type<HelpEvent[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    challengeStateJson: jsonb("challenge_state_json")
      .$type<{
        introduced: boolean;
        resolved: boolean;
        evidenceMessageIds: string[];
        conductWarningActive: boolean;
        conductWarningEvidenceMessageId: string | null;
      }>()
      .notNull(),
    coachingBreakJson: jsonb("coaching_break_json").$type<CoachingBreak>(),
    retryTargetJson: jsonb("retry_target_json").$type<RetryTarget>(),
    retryOutcomeJson: jsonb("retry_outcome_json").$type<RetryOutcome>(),
    takeawayJson: jsonb("takeaway_json").$type<FinalSessionTakeaway>(),
    terminationReason: practiceTerminationReasonEnum("termination_reason")
      .$type<PracticeTerminationReason>(),
    createdAt: timestamps.createdAt,
    updatedAt: timestamps.updatedAt,
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" })
      .notNull(),
  },
  (table) => [
    index("practice_sessions_anonymous_session_id_idx").on(
      table.anonymousSessionId,
    ),
    index("practice_sessions_expires_at_idx").on(table.expiresAt),
    check(
      "practice_sessions_supported_schema_versions",
      sql`${table.schemaVersion} in (3, 4, 5, 6)`,
    ),
    check(
      "practice_sessions_response_count_by_schema",
      sql`(${table.schemaVersion} = 3 and ${table.acceptedResponseCount} between 0 and 5) or (${table.schemaVersion} = 4 and ${table.acceptedResponseCount} between 0 and 3) or (${table.schemaVersion} = 5 and ${table.acceptedResponseCount} between 0 and 2) or (${table.schemaVersion} = 6 and ${table.acceptedResponseCount} between 0 and 1)`,
    ),
    check(
      "practice_sessions_situation_replacement_count_range",
      sql`${table.situationReplacementCount} between 0 and 2`,
    ),
    check(
      "practice_sessions_expected_sequence_nonnegative",
      sql`${table.expectedLearnerSequence} >= 0`,
    ),
    check(
      "practice_sessions_expiry_after_creation",
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
    check(
      "practice_sessions_active_has_no_termination",
      sql`${table.status} <> 'active' or ${table.terminationReason} is null`,
    ),
    check(
      "practice_sessions_completed_has_takeaway",
      sql`${table.status} <> 'completed' or (${table.takeawayJson} is not null and ${table.terminationReason} is not null and ${table.phase} = 'final_takeaway')`,
    ),
    check(
      "practice_sessions_briefing_has_no_responses",
      sql`${table.phase} <> 'briefing' or ${table.acceptedResponseCount} = 0`,
    ),
  ],
);

export const practiceMessages = pgTable(
  "practice_messages",
  {
    id: uuid("id").primaryKey(),
    practiceSessionId: uuid("practice_session_id")
      .notNull()
      .references(() => practiceSessions.id, { onDelete: "cascade" }),
    role: practiceMessageRoleEnum("role").notNull(),
    phase: practiceMessagePhaseEnum("phase").notNull(),
    learnerResponseNumber: smallint("learner_response_number"),
    sequence: integer("sequence").notNull(),
    text: text("text").notNull(),
    metadataJson: jsonb("metadata_json").$type<PersistedPracticeMessageMetadata>(),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    uniqueIndex("practice_messages_session_sequence_uidx").on(
      table.practiceSessionId,
      table.sequence,
    ),
    uniqueIndex("practice_messages_learner_response_uidx")
      .on(table.practiceSessionId, table.learnerResponseNumber)
      .where(sql`${table.role} = 'learner'`),
    index("practice_messages_session_id_idx").on(table.practiceSessionId),
    check(
      "practice_messages_sequence_nonnegative",
      sql`${table.sequence} >= 0`,
    ),
    check(
      "practice_messages_text_not_blank",
      sql`length(btrim(${table.text})) > 0`,
    ),
    check(
      "practice_messages_learner_number_matches_role",
      sql`(${table.role} = 'learner' and ${table.learnerResponseNumber} between 1 and 5) or (${table.role} = 'partner' and ${table.learnerResponseNumber} is null)`,
    ),
  ],
);

export const practiceRequests = pgTable(
  "practice_requests",
  {
    id: uuid("id").primaryKey(),
    practiceSessionId: uuid("practice_session_id")
      .notNull()
      .references(() => practiceSessions.id, { onDelete: "cascade" }),
    idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
    expectedLearnerSequence: integer("expected_learner_sequence").notNull(),
    status: practiceRequestStatusEnum("status").notNull(),
    leaseExpiresAt: timestamp("lease_expires_at", {
      withTimezone: true,
      mode: "string",
    }),
    learnerMessageId: uuid("learner_message_id").references(
      () => practiceMessages.id,
      { onDelete: "cascade" },
    ),
    partnerMessageId: uuid("partner_message_id").references(
      () => practiceMessages.id,
      { onDelete: "cascade" },
    ),
    receiptJson: jsonb("receipt_json").$type<PracticeTurnReceipt>(),
    failureReason: varchar("failure_reason", { length: 64 }),
    createdAt: timestamps.createdAt,
    updatedAt: timestamps.updatedAt,
    committedAt: timestamp("committed_at", {
      withTimezone: true,
      mode: "string",
    }),
  },
  (table) => [
    uniqueIndex("practice_requests_session_idempotency_uidx").on(
      table.practiceSessionId,
      table.idempotencyKey,
    ),
    uniqueIndex("practice_requests_committed_sequence_uidx")
      .on(table.practiceSessionId, table.expectedLearnerSequence)
      .where(sql`${table.status} = 'committed'`),
    uniqueIndex("practice_requests_processing_sequence_uidx")
      .on(table.practiceSessionId, table.expectedLearnerSequence)
      .where(sql`${table.status} = 'processing'`),
    index("practice_requests_lease_expires_at_idx").on(table.leaseExpiresAt),
    check(
      "practice_requests_expected_sequence_nonnegative",
      sql`${table.expectedLearnerSequence} >= 0`,
    ),
    check(
      "practice_requests_committed_has_result",
      sql`${table.status} <> 'committed' or (${table.committedAt} is not null and ${table.receiptJson} is not null and ${table.learnerMessageId} is not null)`,
    ),
  ],
);

// Version 7 has its own bounded state; retained versions 3–6 stay untouched.
export const storyPractices = pgTable("story_practices", {
  id: uuid("id").primaryKey(),
  anonymousSessionId: uuid("anonymous_session_id").notNull().references(() => anonymousSessions.id, { onDelete: "cascade" }),
  stateJson: jsonb("state_json").$type<import("@/lib/story-practice/contracts").StoryState>().notNull(),
  createdAt: timestamps.createdAt,
  updatedAt: timestamps.updatedAt,
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
}, table => [
  index("story_practices_owner_idx").on(table.anonymousSessionId),
  index("story_practices_expiry_idx").on(table.expiresAt),
  check("story_practices_retention", sql`${table.expiresAt} > ${table.createdAt} and ${table.expiresAt} <= ${table.createdAt} + interval '7 days'`),
  check("story_practices_schema", sql`(${table.stateJson}->>'schemaVersion')::int = 7 and (${table.stateJson}->>'responseLimit')::int = 1 and (${table.stateJson}->>'acceptedResponseCount')::int between 0 and 1`),
  check("story_practices_mode", sql`${table.stateJson}->>'entryMode' in ('free_share', 'random_question') and (${table.stateJson}->>'entryMode' <> 'free_share' or (${table.stateJson}->'questionReference' = 'null'::jsonb and ${table.stateJson}->'privateCoachingMetadata' = 'null'::jsonb and (${table.stateJson}->>'replacementCount')::int = 0))`),
]);

// Short-lived abuse counters. Keys are HMACs; no raw IPs or learner content.
export const requestRateLimits = pgTable("request_rate_limits", {
  key: varchar("key", { length: 64 }).notNull(),
  windowStart: timestamp("window_start", { withTimezone: true, mode: "string" }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
  count: integer("count").notNull(),
}, table => [
  primaryKey({ columns: [table.key, table.windowStart] }),
  index("request_rate_limits_expiry_idx").on(table.expiresAt),
  check("request_rate_limits_positive", sql`${table.count} > 0`),
]);
