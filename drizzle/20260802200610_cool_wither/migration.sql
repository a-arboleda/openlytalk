ALTER TABLE "practice_sessions" ADD COLUMN "situation_replacement_count" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "practice_sessions" ADD COLUMN "last_situation_replacement_key" varchar(128);--> statement-breakpoint
ALTER TABLE "practice_sessions" ADD CONSTRAINT "practice_sessions_situation_replacement_count_range" CHECK ("situation_replacement_count" between 0 and 2);