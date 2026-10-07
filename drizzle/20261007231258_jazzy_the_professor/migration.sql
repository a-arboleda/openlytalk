CREATE TABLE "request_rate_limits" (
	"key" varchar(64),
	"window_start" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"count" integer NOT NULL,
	CONSTRAINT "request_rate_limits_pkey" PRIMARY KEY("key","window_start"),
	CONSTRAINT "request_rate_limits_positive" CHECK ("count" > 0)
);
--> statement-breakpoint
CREATE INDEX "request_rate_limits_expiry_idx" ON "request_rate_limits" ("expires_at");