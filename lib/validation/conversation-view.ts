import { z } from "zod";

import { V1_RULES } from "@/lib/product-rules";
import { lifecycleStatusSchema } from "@/lib/validation/conversation";
import {
  conversationContextSchema,
  conversationTypeSchema,
  learnerStarterSchema,
} from "@/lib/validation/episode";
import { databaseIdSchema } from "@/lib/validation/persistence";

export const conversationViewSchema = z.object({
  conversationId: databaseIdSchema,
  conversationType: conversationTypeSchema,
  context: conversationContextSchema,
  starter: learnerStarterSchema.nullable(),
  scene: z.string().trim().min(1).max(700).nullable(),
  messages: z.array(
    z.object({
      messageId: databaseIdSchema,
      role: z.enum(["learner", "sofia"]),
      sequence: z.number().int().min(0),
      text: z.string().trim().min(1).max(4_000),
    }),
  ),
  episode: z.object({
    status: lifecycleStatusSchema,
    acceptedResponseCount: z.number().int().min(0).max(V1_RULES.maxAcceptedResponses),
    maxAcceptedResponses: z.literal(V1_RULES.maxAcceptedResponses),
    expectedSequence: z.number().int().min(0),
    expiresAt: z.string().datetime(),
  }),
});

export type ConversationView = z.infer<typeof conversationViewSchema>;
