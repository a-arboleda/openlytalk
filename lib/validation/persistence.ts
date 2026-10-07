import { z } from "zod";

import {
  conversationStateSchema,
  transcriptMessageSchema,
} from "@/lib/validation/conversation";

export const databaseIdSchema = z.string().uuid();

export const anonymousSessionRecordSchema = z
  .object({
    id: databaseIdSchema,
    createdAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
  })
  .superRefine((record, context) => {
    if (Date.parse(record.expiresAt) <= Date.parse(record.createdAt)) {
      context.addIssue({
        code: "custom",
        message: "Session expiration must occur after creation.",
        path: ["expiresAt"],
      });
    }
  });

export const idempotencyKeySchema = z.string().trim().min(1).max(128);

export const turnReceiptSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  conversationId: databaseIdSchema,
  learnerMessage: transcriptMessageSchema,
  sofiaMessage: transcriptMessageSchema,
  state: conversationStateSchema,
});
