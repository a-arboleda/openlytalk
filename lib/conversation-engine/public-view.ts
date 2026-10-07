import { V1_RULES } from "@/lib/product-rules";
import { buildLearnerStarter } from "@/lib/conversation-engine/learner-starter";
import type { ConversationState } from "@/lib/validation/conversation";
import {
  conversationViewSchema,
  type ConversationView,
} from "@/lib/validation/conversation-view";

export function toConversationView(state: ConversationState): ConversationView {
  if (!state.scenePlan) {
    throw new Error("A learner-visible conversation requires a scene plan.");
  }
  const learnerFirst = state.scenePlan.openingMode === "learner_first";
  return conversationViewSchema.parse({
    conversationId: state.conversationId,
    conversationType: state.conversationType,
    context: state.context,
    starter: learnerFirst
      ? buildLearnerStarter({
          conversationId: state.conversationId,
          conversationType: state.conversationType,
          context: state.context,
        })
      : null,
    scene: learnerFirst ? null : state.scenePlan.learnerVisibleScene,
    messages: state.messages.map((message) => ({
      messageId: message.id,
      role: message.role,
      sequence: message.sequence,
      text: message.text,
    })),
    episode: {
      status: state.status,
      acceptedResponseCount: state.acceptedResponseCount,
      maxAcceptedResponses: V1_RULES.maxAcceptedResponses,
      expectedSequence: state.expectedSequence,
      expiresAt: state.expiresAt,
    },
  });
}
