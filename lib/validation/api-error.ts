import { z } from "zod";

export const apiErrorSchema = z.object({
  code: z.enum([
    "INVALID_REQUEST",
    "UNAUTHORIZED_CONVERSATION",
    "CONVERSATION_NOT_ACTIVE",
    "STALE_SEQUENCE",
    "ALLOWANCE_EXHAUSTED",
    "TURN_IN_PROGRESS",
    "INVALID_AUDIO",
    "UNCLEAR_AUDIO",
    "NON_ENGLISH_RETRY",
    "MODEL_OUTPUT_INVALID",
    "PROVIDER_UNAVAILABLE",
    "PERSISTENCE_UNAVAILABLE",
    "DEBRIEF_UNAVAILABLE",
  ]),
  message: z.string().trim().min(1).max(500),
  retryable: z.boolean(),
  requestId: z.string().trim().min(1),
});

export type ApiError = z.infer<typeof apiErrorSchema>;
