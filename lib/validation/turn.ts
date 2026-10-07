import { z } from "zod";

import { V1_RULES } from "@/lib/product-rules";
import { lifecycleStatusSchema } from "@/lib/validation/conversation";
import {
  databaseIdSchema,
  idempotencyKeySchema,
} from "@/lib/validation/persistence";

export const turnFormFieldsSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  expectedSequence: z.coerce.number().int().min(0),
});

const publicMessageSchema = z.object({
  messageId: databaseIdSchema,
  sequence: z.number().int().min(0),
  text: z.string().trim().min(1).max(4_000),
});

export const turnResponseSchema = z.object({
  conversationId: databaseIdSchema,
  learner: publicMessageSchema,
  sofia: publicMessageSchema,
  episode: z.object({
    status: lifecycleStatusSchema,
    acceptedResponseCount: z.number().int().min(1).max(V1_RULES.maxAcceptedResponses),
    maxAcceptedResponses: z.literal(V1_RULES.maxAcceptedResponses),
    expectedSequence: z.number().int().min(1),
    ended: z.boolean(),
  }),
  speechUrl: z.string().trim().min(1),
});

export type TurnResponse = z.infer<typeof turnResponseSchema>;
