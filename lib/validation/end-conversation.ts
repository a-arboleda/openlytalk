import { z } from "zod";

import { V1_RULES } from "@/lib/product-rules";
import { databaseIdSchema } from "@/lib/validation/persistence";

export const endConversationResponseSchema = z.object({
  conversationId: databaseIdSchema,
  episode: z.object({
    status: z.literal("ended"),
    terminationReason: z.literal("user_exit"),
    acceptedResponseCount: z
      .number()
      .int()
      .min(0)
      .max(V1_RULES.maxAcceptedResponses),
    maxAcceptedResponses: z.literal(V1_RULES.maxAcceptedResponses),
  }),
});

export type EndConversationResponse = z.infer<
  typeof endConversationResponseSchema
>;
