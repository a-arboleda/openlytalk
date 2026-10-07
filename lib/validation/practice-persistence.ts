import { z } from "zod";

import {
  practiceMessageSchema,
  practiceSessionStateSchema,
} from "@/lib/coaching/schemas";
import {
  databaseIdSchema,
  idempotencyKeySchema,
} from "@/lib/validation/persistence";

export const practiceTurnReceiptSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  practiceSessionId: databaseIdSchema,
  acceptedMessages: z.array(practiceMessageSchema).min(1).max(2),
  state: practiceSessionStateSchema,
});
