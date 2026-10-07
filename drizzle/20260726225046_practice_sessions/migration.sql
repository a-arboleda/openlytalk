CREATE TYPE "practice_message_phase" AS ENUM('initial_simulation', 'targeted_retry');--> statement-breakpoint
CREATE TYPE "practice_message_role" AS ENUM('learner', 'partner');--> statement-breakpoint
CREATE TYPE "practice_request_status" AS ENUM('processing', 'committed', 'retryable_failure');--> statement-breakpoint
CREATE TYPE "practice_session_phase" AS ENUM('briefing', 'initial_simulation', 'coaching_break', 'targeted_retry', 'finalizing', 'final_takeaway');--> statement-breakpoint
CREATE TYPE "practice_session_status" AS ENUM('active', 'completed', 'ended');--> statement-breakpoint
CREATE TYPE "practice_termination_reason" AS ENUM('practice_completed', 'response_limit', 'user_exit', 'boundary_repeat', 'safety_override', 'state_error');--> statement-breakpoint
CREATE TABLE "practice_messages" (
	"id" uuid PRIMARY KEY,
	"practice_session_id" uuid NOT NULL,
	"role" "practice_message_role" NOT NULL,
	"phase" "practice_message_phase" NOT NULL,
	"learner_response_number" smallint,
	"sequence" integer NOT NULL,
	"text" text NOT NULL,
	"metadata_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "practice_messages_sequence_nonnegative" CHECK ("sequence" >= 0),
	CONSTRAINT "practice_messages_text_not_blank" CHECK (length(btrim("text")) > 0),
	CONSTRAINT "practice_messages_learner_number_matches_role" CHECK (("role" = 'learner' and "learner_response_number" between 1 and 5) or ("role" = 'partner' and "learner_response_number" is null))
);
--> statement-breakpoint
CREATE TABLE "practice_requests" (
	"id" uuid PRIMARY KEY,
	"practice_session_id" uuid NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"expected_learner_sequence" integer NOT NULL,
	"status" "practice_request_status" NOT NULL,
	"lease_expires_at" timestamp with time zone,
	"learner_message_id" uuid,
	"partner_message_id" uuid,
	"receipt_json" jsonb,
	"failure_reason" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"committed_at" timestamp with time zone,
	CONSTRAINT "practice_requests_expected_sequence_nonnegative" CHECK ("expected_learner_sequence" >= 0),
	CONSTRAINT "practice_requests_committed_has_result" CHECK ("status" <> 'committed' or ("committed_at" is not null and "receipt_json" is not null and "learner_message_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "practice_sessions" (
	"id" uuid PRIMARY KEY,
	"anonymous_session_id" uuid NOT NULL,
	"schema_version" integer DEFAULT 3 NOT NULL,
	"status" "practice_session_status" NOT NULL,
	"phase" "practice_session_phase" NOT NULL,
	"setup_json" jsonb NOT NULL,
	"plan_json" jsonb NOT NULL,
	"accepted_response_count" smallint DEFAULT 0 NOT NULL,
	"expected_learner_sequence" integer DEFAULT 0 NOT NULL,
	"evidence_events_json" jsonb DEFAULT '[]' NOT NULL,
	"help_events_json" jsonb DEFAULT '[]' NOT NULL,
	"challenge_state_json" jsonb NOT NULL,
	"coaching_break_json" jsonb,
	"retry_target_json" jsonb,
	"retry_outcome_json" jsonb,
	"takeaway_json" jsonb,
	"termination_reason" "practice_termination_reason",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "practice_sessions_schema_version_v3" CHECK ("schema_version" = 3),
	CONSTRAINT "practice_sessions_response_count_range" CHECK ("accepted_response_count" between 0 and 5),
	CONSTRAINT "practice_sessions_expected_sequence_nonnegative" CHECK ("expected_learner_sequence" >= 0),
	CONSTRAINT "practice_sessions_expiry_after_creation" CHECK ("expires_at" > "created_at"),
	CONSTRAINT "practice_sessions_active_has_no_termination" CHECK ("status" <> 'active' or "termination_reason" is null),
	CONSTRAINT "practice_sessions_completed_has_takeaway" CHECK ("status" <> 'completed' or ("takeaway_json" is not null and "termination_reason" is not null and "phase" = 'final_takeaway')),
	CONSTRAINT "practice_sessions_briefing_has_no_responses" CHECK ("phase" <> 'briefing' or "accepted_response_count" = 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "practice_messages_session_sequence_uidx" ON "practice_messages" ("practice_session_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "practice_messages_learner_response_uidx" ON "practice_messages" ("practice_session_id","learner_response_number") WHERE "role" = 'learner';--> statement-breakpoint
CREATE INDEX "practice_messages_session_id_idx" ON "practice_messages" ("practice_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "practice_requests_session_idempotency_uidx" ON "practice_requests" ("practice_session_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "practice_requests_committed_sequence_uidx" ON "practice_requests" ("practice_session_id","expected_learner_sequence") WHERE "status" = 'committed';--> statement-breakpoint
CREATE UNIQUE INDEX "practice_requests_processing_sequence_uidx" ON "practice_requests" ("practice_session_id","expected_learner_sequence") WHERE "status" = 'processing';--> statement-breakpoint
CREATE INDEX "practice_requests_lease_expires_at_idx" ON "practice_requests" ("lease_expires_at");--> statement-breakpoint
CREATE INDEX "practice_sessions_anonymous_session_id_idx" ON "practice_sessions" ("anonymous_session_id");--> statement-breakpoint
CREATE INDEX "practice_sessions_expires_at_idx" ON "practice_sessions" ("expires_at");--> statement-breakpoint
ALTER TABLE "practice_messages" ADD CONSTRAINT "practice_messages_practice_session_id_practice_sessions_id_fkey" FOREIGN KEY ("practice_session_id") REFERENCES "practice_sessions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "practice_requests" ADD CONSTRAINT "practice_requests_practice_session_id_practice_sessions_id_fkey" FOREIGN KEY ("practice_session_id") REFERENCES "practice_sessions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "practice_requests" ADD CONSTRAINT "practice_requests_learner_message_id_practice_messages_id_fkey" FOREIGN KEY ("learner_message_id") REFERENCES "practice_messages"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "practice_requests" ADD CONSTRAINT "practice_requests_partner_message_id_practice_messages_id_fkey" FOREIGN KEY ("partner_message_id") REFERENCES "practice_messages"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "practice_sessions" ADD CONSTRAINT "practice_sessions_fflX1lQTkxUY_fkey" FOREIGN KEY ("anonymous_session_id") REFERENCES "anonymous_sessions"("id") ON DELETE CASCADE;