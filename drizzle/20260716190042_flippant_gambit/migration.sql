CREATE TYPE "public"."conversation_context" AS ENUM('Relationships', 'Work', 'Daily Life', 'Life Moments');--> statement-breakpoint
CREATE TYPE "public"."conversation_mode" AS ENUM('normal', 'repair');--> statement-breakpoint
CREATE TYPE "public"."conversation_stage" AS ENUM('opening', 'developing', 'resolving', 'closing');--> statement-breakpoint
CREATE TYPE "public"."conversation_type" AS ENUM('Everyday Conversations', 'Sharing Experiences', 'Expressing Yourself', 'Difficult Conversations');--> statement-breakpoint
CREATE TYPE "public"."debrief_kind" AS ENUM('full', 'partial');--> statement-breakpoint
CREATE TYPE "public"."emotion_intensity" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."emotion_kind" AS ENUM('calm', 'curious', 'amused', 'pleased', 'uncertain', 'anxious', 'disappointed', 'frustrated', 'hurt', 'guarded', 'hopeful', 'relieved');--> statement-breakpoint
CREATE TYPE "public"."lifecycle_status" AS ENUM('creating', 'active', 'debrief_pending', 'completed', 'ended', 'creation_failed');--> statement-breakpoint
CREATE TYPE "public"."message_role" AS ENUM('learner', 'sofia');--> statement-breakpoint
CREATE TYPE "public"."outcome_category" AS ENUM('connection_reached', 'perspective_clarified', 'decision_reached', 'repair_reached', 'boundary_respected', 'unresolved_but_acknowledged', 'safety_ended');--> statement-breakpoint
CREATE TYPE "public"."termination_reason" AS ENUM('meaningful_outcome', 'response_limit', 'user_exit', 'boundary_repeat', 'safety_override');--> statement-breakpoint
CREATE TYPE "public"."trust_level" AS ENUM('guarded', 'cautious', 'comfortable', 'open');--> statement-breakpoint
CREATE TYPE "public"."turn_request_status" AS ENUM('processing', 'committed', 'retryable_failure');--> statement-breakpoint
CREATE TABLE "anonymous_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "anonymous_sessions_expiry_after_creation" CHECK ("anonymous_sessions"."expires_at" > "anonymous_sessions"."created_at")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"conversation_type" "conversation_type" NOT NULL,
	"context" "conversation_context" NOT NULL,
	"status" "lifecycle_status" NOT NULL,
	"termination_reason" "termination_reason",
	"outcome_category" "outcome_category",
	"stage" "conversation_stage" NOT NULL,
	"mode" "conversation_mode" NOT NULL,
	"accepted_response_count" smallint DEFAULT 0 NOT NULL,
	"expected_sequence" integer NOT NULL,
	"trust_level" "trust_level" NOT NULL,
	"emotion_kind" "emotion_kind" NOT NULL,
	"emotion_intensity" "emotion_intensity" NOT NULL,
	"warning_active" boolean DEFAULT false NOT NULL,
	"state_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "conversations_response_count_range" CHECK ("conversations"."accepted_response_count" between 0 and 8),
	CONSTRAINT "conversations_expected_sequence_nonnegative" CHECK ("conversations"."expected_sequence" >= 0),
	CONSTRAINT "conversations_expiry_after_creation" CHECK ("conversations"."expires_at" > "conversations"."created_at"),
	CONSTRAINT "conversations_active_has_no_termination" CHECK ("conversations"."status" <> 'active' or "conversations"."termination_reason" is null)
);
--> statement-breakpoint
CREATE TABLE "debriefs" (
	"conversation_id" uuid NOT NULL,
	"kind" "debrief_kind" NOT NULL,
	"content_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "debriefs_conversation_id_pk" PRIMARY KEY("conversation_id")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" "message_role" NOT NULL,
	"sequence" integer NOT NULL,
	"text" text NOT NULL,
	"metadata_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_sequence_nonnegative" CHECK ("messages"."sequence" >= 0),
	CONSTRAINT "messages_text_not_blank" CHECK (length(btrim("messages"."text")) > 0)
);
--> statement-breakpoint
CREATE TABLE "turn_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"conversation_id" uuid NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"expected_sequence" integer NOT NULL,
	"status" "turn_request_status" NOT NULL,
	"lease_expires_at" timestamp with time zone,
	"learner_message_id" uuid,
	"sofia_message_id" uuid,
	"receipt_json" jsonb,
	"failure_reason" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"committed_at" timestamp with time zone,
	CONSTRAINT "turn_requests_expected_sequence_nonnegative" CHECK ("turn_requests"."expected_sequence" >= 0),
	CONSTRAINT "turn_requests_committed_has_result" CHECK ("turn_requests"."status" <> 'committed' or ("turn_requests"."committed_at" is not null and "turn_requests"."receipt_json" is not null and "turn_requests"."learner_message_id" is not null and "turn_requests"."sofia_message_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_session_id_anonymous_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."anonymous_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debriefs" ADD CONSTRAINT "debriefs_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turn_requests" ADD CONSTRAINT "turn_requests_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turn_requests" ADD CONSTRAINT "turn_requests_learner_message_id_messages_id_fk" FOREIGN KEY ("learner_message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turn_requests" ADD CONSTRAINT "turn_requests_sofia_message_id_messages_id_fk" FOREIGN KEY ("sofia_message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "anonymous_sessions_expires_at_idx" ON "anonymous_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "conversations_session_id_idx" ON "conversations" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "conversations_expires_at_idx" ON "conversations" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_conversation_sequence_uidx" ON "messages" USING btree ("conversation_id","sequence");--> statement-breakpoint
CREATE INDEX "messages_conversation_id_idx" ON "messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "turn_requests_conversation_idempotency_uidx" ON "turn_requests" USING btree ("conversation_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "turn_requests_committed_sequence_uidx" ON "turn_requests" USING btree ("conversation_id","expected_sequence") WHERE "turn_requests"."status" = 'committed';--> statement-breakpoint
CREATE INDEX "turn_requests_lease_expires_at_idx" ON "turn_requests" USING btree ("lease_expires_at");