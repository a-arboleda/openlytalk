import { randomUUID } from "node:crypto";

import {
  endConversation,
  EndConversationError,
} from "@/lib/conversation-engine/end-conversation";
import { getConversationRepository } from "@/lib/persistence/postgres/repository";
import { getOrCreateAnonymousRouteSession } from "@/lib/session/route-session";
import { apiErrorSchema, type ApiError } from "@/lib/validation/api-error";
import { databaseIdSchema } from "@/lib/validation/persistence";

export const runtime = "nodejs";

function errorResponse(
  requestId: string,
  status: number,
  error: Omit<ApiError, "requestId">,
) {
  return Response.json(apiErrorSchema.parse({ ...error, requestId }), {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  const requestId = randomUUID();
  const { conversationId } = await context.params;
  const parsedConversationId = databaseIdSchema.safeParse(conversationId);
  if (!parsedConversationId.success) {
    return errorResponse(requestId, 404, {
      code: "UNAUTHORIZED_CONVERSATION",
      message: "This conversation is not available in your session.",
      retryable: false,
    });
  }

  let sessionId: string;
  try {
    sessionId = (await getOrCreateAnonymousRouteSession()).id;
  } catch {
    return errorResponse(requestId, 503, {
      code: "PERSISTENCE_UNAVAILABLE",
      message: "Your session is temporarily unavailable. Please try again.",
      retryable: true,
    });
  }

  try {
    const result = await endConversation({
      sessionId,
      conversationId: parsedConversationId.data,
      repository: getConversationRepository(),
    });
    return Response.json(result, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof EndConversationError) {
      if (error.reason === "not_found") {
        return errorResponse(requestId, 404, {
          code: "UNAUTHORIZED_CONVERSATION",
          message: "This conversation is not available in your session.",
          retryable: false,
        });
      }
      if (error.reason === "conversation_not_active") {
        return errorResponse(requestId, 409, {
          code: "CONVERSATION_NOT_ACTIVE",
          message: "This conversation has already ended.",
          retryable: false,
        });
      }
    }

    return errorResponse(requestId, 503, {
      code: "PERSISTENCE_UNAVAILABLE",
      message: "We could not end the conversation. Please try again.",
      retryable: true,
    });
  }
}
