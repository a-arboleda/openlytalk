import { readAudioForm } from "@/lib/audio/request";
import { randomUUID } from "node:crypto";

import { MAX_AUDIO_BYTES } from "@/lib/audio/recording";
import { processTurn, TurnProcessingError } from "@/lib/conversation-engine/process-turn";
import { getAudioProviders } from "@/lib/openai/audio-providers";
import { getConversationModel } from "@/lib/openai/conversation-model";
import { getConversationRepository } from "@/lib/persistence/postgres/repository";
import { getOrCreateAnonymousRouteSession } from "@/lib/session/route-session";
import { apiErrorSchema, type ApiError } from "@/lib/validation/api-error";
import { databaseIdSchema } from "@/lib/validation/persistence";
import { turnFormFieldsSchema } from "@/lib/validation/turn";

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
  request: Request,
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

  let form: FormData;
  try {
    form = await readAudioForm(request);
  } catch {
    return errorResponse(requestId, 400, {
      code: "INVALID_REQUEST",
      message: "Send one recorded response to continue.",
      retryable: false,
    });
  }

  const audio = form.get("audio");
  const parsedFields = turnFormFieldsSchema.safeParse({
    idempotencyKey: form.get("idempotencyKey"),
    expectedSequence: form.get("expectedSequence"),
  });
  if (!(audio instanceof File) || !parsedFields.success) {
    return errorResponse(requestId, 400, {
      code: "INVALID_REQUEST",
      message: "Send one recorded response to continue.",
      retryable: false,
    });
  }
  if (audio.size === 0 || audio.size > MAX_AUDIO_BYTES) {
    return errorResponse(requestId, 422, {
      code: "INVALID_AUDIO",
      message:
        audio.size === 0
          ? "We did not receive any audio. Please record it again."
          : "That recording is too large. Please make it shorter.",
      retryable: true,
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
    const providers = getAudioProviders();
    const result = await processTurn({
      sessionId,
      conversationId: parsedConversationId.data,
      idempotencyKey: parsedFields.data.idempotencyKey,
      expectedSequence: parsedFields.data.expectedSequence,
      audio: new Uint8Array(await audio.arrayBuffer()),
      mimeType: audio.type,
      repository: getConversationRepository(),
      transcription: providers.transcription,
      model: getConversationModel(),
    });
    return Response.json(result, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof TurnProcessingError) {
      return errorResponse(requestId, error.status, error.apiError);
    }
    return errorResponse(requestId, 503, {
      code: "PERSISTENCE_UNAVAILABLE",
      message: "We could not save this response. Please try again.",
      retryable: true,
    });
  }
}
