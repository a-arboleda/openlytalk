import type { ConversationRepository } from "@/lib/persistence/conversation-repository";
import { V1_RULES } from "@/lib/product-rules";
import {
  endConversationResponseSchema,
  type EndConversationResponse,
} from "@/lib/validation/end-conversation";

export class EndConversationError extends Error {
  constructor(
    readonly reason: "not_found" | "conversation_not_active" | "persistence",
  ) {
    super(`The conversation could not be ended: ${reason}.`);
    this.name = "EndConversationError";
  }
}

export async function endConversation(input: {
  sessionId: string;
  conversationId: string;
  repository: Pick<ConversationRepository, "endConversation">;
  now?: Date;
}): Promise<EndConversationResponse> {
  const now = input.now ?? new Date();
  if (Number.isNaN(now.getTime())) {
    throw new Error("Ending a conversation requires a valid current time.");
  }

  let result: Awaited<ReturnType<ConversationRepository["endConversation"]>>;
  try {
    result = await input.repository.endConversation({
      sessionId: input.sessionId,
      conversationId: input.conversationId,
      now: now.toISOString(),
    });
  } catch {
    throw new EndConversationError("persistence");
  }

  if (result.kind === "rejected") {
    throw new EndConversationError(result.reason);
  }

  return endConversationResponseSchema.parse({
    conversationId: result.state.conversationId,
    episode: {
      status: result.state.status,
      terminationReason: result.state.terminationReason,
      acceptedResponseCount: result.state.acceptedResponseCount,
      maxAcceptedResponses: V1_RULES.maxAcceptedResponses,
    },
  });
}
