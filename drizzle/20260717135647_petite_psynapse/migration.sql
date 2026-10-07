CREATE UNIQUE INDEX "turn_requests_processing_sequence_uidx"
ON "turn_requests" ("conversation_id", "expected_sequence")
WHERE "status" = 'processing';
