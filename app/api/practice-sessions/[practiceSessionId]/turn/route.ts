import { readAudioForm } from "@/lib/audio/request";
import { MAX_AUDIO_BYTES } from "@/lib/audio/recording";
import {
  practiceApiErrorSchema,
  practiceTurnFieldsSchema,
} from "@/lib/coaching/public-contracts";
import {
  processPracticeTurn,
  PracticeTurnProcessingError,
} from "@/lib/coaching/process-practice-turn";
import {
  getPracticeTranscriptionProvider,
} from "@/lib/providers/practice-audio-providers";
import { getPracticeModel } from "@/lib/openai/practice-model";
import { getPracticeRepository } from "@/lib/persistence/postgres/practice-repository";
import { getOrCreateAnonymousRouteSession } from "@/lib/session/route-session";
import { databaseIdSchema } from "@/lib/validation/persistence";

export const runtime = "nodejs";

function errorResponse(input: {
  status: number;
  code:
    | "invalid_request"
    | "not_found"
    | "expired"
    | "stale_state"
    | "operation_in_progress"
    | "allowance_exhausted"
    | "invalid_audio"
    | "unclear_audio"
    | "non_english"
    | "provider_unavailable"
    | "persistence_unavailable"
    | "invalid_generated_output"
    | "practice_not_active"
    | "phase_not_available";
  message: string;
  retryable: boolean;
}) {
  return Response.json(
    practiceApiErrorSchema.parse({
      error: {
        code: input.code,
        message: input.message,
        retryable: input.retryable,
      },
    }),
    {
      status: input.status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ practiceSessionId: string }> },
) {
  const { practiceSessionId } = await context.params;
  const parsedId = databaseIdSchema.safeParse(practiceSessionId);
  if (!parsedId.success) {
    return errorResponse({
      status: 400,
      code: "invalid_request",
      message: "Send one recorded response to continue.",
      retryable: false,
    });
  }

  let form: FormData;
  try {
    form = await readAudioForm(request);
  } catch {
    return errorResponse({
      status: 400,
      code: "invalid_request",
      message: "Send one recorded response to continue.",
      retryable: false,
    });
  }

  const audio = form.get("audio");
  const fields = practiceTurnFieldsSchema.safeParse({
    idempotencyKey: form.get("idempotencyKey"),
    expectedLearnerSequence: form.get("expectedLearnerSequence"),
    previewTranscript: form.get("previewTranscript") ?? undefined,
  });
  if (!(audio instanceof File) || !fields.success) {
    return errorResponse({
      status: 400,
      code: "invalid_request",
      message: "Send one recorded response to continue.",
      retryable: false,
    });
  }
  if (audio.size === 0 || audio.size > MAX_AUDIO_BYTES) {
    return errorResponse({
      status: 422,
      code: audio.size === 0 ? "unclear_audio" : "invalid_audio",
      message:
        audio.size === 0
          ? "We did not receive any audio. Please record it again."
          : "That recording is too large. Please make it shorter.",
      retryable: true,
    });
  }

  let anonymousSessionId: string;
  try {
    anonymousSessionId = (await getOrCreateAnonymousRouteSession()).id;
  } catch {
    return errorResponse({
      status: 503,
      code: "persistence_unavailable",
      message: "Your practice is temporarily unavailable. Please try again.",
      retryable: true,
    });
  }

  try {
    const result = await processPracticeTurn({
      anonymousSessionId,
      practiceSessionId: parsedId.data,
      idempotencyKey: fields.data.idempotencyKey,
      expectedLearnerSequence:
        fields.data.expectedLearnerSequence,
      audio: new Uint8Array(await audio.arrayBuffer()),
      mimeType: audio.type,
      previewTranscript: fields.data.previewTranscript,
      repository: getPracticeRepository(),
      transcription: getPracticeTranscriptionProvider(),
      model: getPracticeModel(),
    });
    return Response.json(result, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof PracticeTurnProcessingError) {
      return errorResponse({
        status: error.status,
        ...error.apiError,
      });
    }
    return errorResponse({
      status: 503,
      code: "persistence_unavailable",
      message: "We could not save this response. Please try again.",
      retryable: true,
    });
  }
}
