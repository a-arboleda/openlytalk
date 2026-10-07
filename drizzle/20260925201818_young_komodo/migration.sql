CREATE TABLE "story_practices" (
	"id" uuid PRIMARY KEY,
	"anonymous_session_id" uuid NOT NULL,
	"state_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "story_practices_retention" CHECK ("expires_at" > "created_at" and "expires_at" <= "created_at" + interval '7 days'),
	CONSTRAINT "story_practices_schema" CHECK (("state_json"->>'schemaVersion')::int = 7 and ("state_json"->>'responseLimit')::int = 1 and ("state_json"->>'acceptedResponseCount')::int between 0 and 1),
	CONSTRAINT "story_practices_mode" CHECK ("state_json"->>'entryMode' in ('free_share', 'random_question') and ("state_json"->>'entryMode' <> 'free_share' or ("state_json"->'questionReference' = 'null'::jsonb and "state_json"->'privateCoachingMetadata' = 'null'::jsonb and ("state_json"->>'replacementCount')::int = 0)))
);
--> statement-breakpoint
CREATE INDEX "story_practices_owner_idx" ON "story_practices" ("anonymous_session_id");--> statement-breakpoint
CREATE INDEX "story_practices_expiry_idx" ON "story_practices" ("expires_at");--> statement-breakpoint
ALTER TABLE "story_practices" ADD CONSTRAINT "story_practices_anonymous_session_id_anonymous_sessions_id_fkey" FOREIGN KEY ("anonymous_session_id") REFERENCES "anonymous_sessions"("id") ON DELETE CASCADE;