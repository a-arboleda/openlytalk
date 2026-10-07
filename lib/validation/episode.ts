import { z } from "zod";

import {
  CONTEXT_VALUES,
  CONVERSATION_TYPE_VALUES,
} from "@/lib/product-rules";

export const conversationTypeSchema = z.enum(CONVERSATION_TYPE_VALUES);
export const conversationContextSchema = z.enum(CONTEXT_VALUES);

export const createEpisodeRequestSchema = z.object({
  conversationType: conversationTypeSchema,
  context: conversationContextSchema,
});

export const learnerStarterSchema = z.object({
  prompt: z.string().trim().min(1).max(700),
  ideas: z.array(z.string().trim().min(1).max(120)).length(3),
});

export const createEpisodeResponseSchema = z.object({
  conversationId: z.uuid(),
  conversationType: conversationTypeSchema,
  context: conversationContextSchema,
  starter: learnerStarterSchema,
  episode: z.object({
    status: z.literal("active"),
    acceptedResponseCount: z.literal(0),
    maxAcceptedResponses: z.literal(8),
    expectedSequence: z.literal(0),
    expiresAt: z.string().datetime(),
  }),
});

export type CreateEpisodeRequest = z.infer<typeof createEpisodeRequestSchema>;
export type CreateEpisodeResponse = z.infer<
  typeof createEpisodeResponseSchema
>;
