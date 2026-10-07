import { randomUUID } from "node:crypto";

import {
  createEpisode,
  EpisodePersistenceError,
} from "@/lib/conversation-engine/create-episode";
import { getConversationRepository } from "@/lib/persistence/postgres/repository";
import { getOrCreateAnonymousRouteSession } from "@/lib/session/route-session";
import { apiErrorSchema, type ApiError } from "@/lib/validation/api-error";
import { createEpisodeRequestSchema } from "@/lib/validation/episode";

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

export async function POST(request: Request) {
  const requestId = randomUUID();
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse(requestId, 400, {
      code: "INVALID_REQUEST",
      message: "Choose what you want to practice and one area of your life.",
      retryable: false,
    });
  }

  const parsedRequest = createEpisodeRequestSchema.safeParse(body);
  if (!parsedRequest.success) {
    return errorResponse(requestId, 400, {
      code: "INVALID_REQUEST",
      message: "Choose one speaking goal and one area of your life.",
      retryable: false,
    });
  }

  let sessionId: string;
  try {
    const session = await getOrCreateAnonymousRouteSession();
    sessionId = session.id;
  } catch {
    return errorResponse(requestId, 503, {
      code: "PERSISTENCE_UNAVAILABLE",
      message: "We could not start your session. Please try again.",
      retryable: true,
    });
  }

  try {
    const episode = await createEpisode({
      sessionId,
      request: parsedRequest.data,
      repository: getConversationRepository(),
    });

    return Response.json(episode, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof EpisodePersistenceError) {
      return errorResponse(requestId, 503, {
        code: "PERSISTENCE_UNAVAILABLE",
        message: "We could not save your conversation. Please try again.",
        retryable: true,
      });
    }

    return errorResponse(requestId, 503, {
      code: "PROVIDER_UNAVAILABLE",
      message: "Conversation creation is temporarily unavailable. Please try again.",
      retryable: true,
    });
  }
}
