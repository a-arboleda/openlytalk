import "server-only";

import OpenAI from "openai";

import { parseServerEnv } from "@/lib/env";
import { OpenAIConversationModel } from "@/lib/openai/openai-conversation-model";

let conversationModel: OpenAIConversationModel | undefined;

export function getConversationModel(): OpenAIConversationModel {
  if (conversationModel) return conversationModel;

  const { OPENAI_API_KEY, OPENAI_TURN_MODEL } = parseServerEnv();
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for Sofia's responses.");
  }

  conversationModel = new OpenAIConversationModel(
    new OpenAI({ apiKey: OPENAI_API_KEY }),
    OPENAI_TURN_MODEL,
  );
  return conversationModel;
}
