import { readAudioForm } from "@/lib/audio/request";
import {
  AudioValidationError,
  validateRecording,
} from "@/lib/audio/recording";
import {
  practiceApiErrorSchema,
  practiceTranscriptionPreviewResponseSchema,
} from "@/lib/coaching/public-contracts";
import { canAcceptLearnerResponse } from "@/lib/coaching/transitions";
import { getPracticeRepository } from "@/lib/persistence/postgres/practice-repository";
import { getPracticeTranscriptionProvider } from "@/lib/providers/practice-audio-providers";
import { getOrCreateAnonymousRouteSession } from "@/lib/session/route-session";
import { databaseIdSchema } from "@/lib/validation/persistence";

export const runtime = "nodejs";

function errorResponse(input: {
  status: number;
  code:
    | "invalid_request"
    | "not_found"
    | "invalid_audio"
    | "unclear_audio"
    | "provider_unavailable"
    | "persistence_unavailable"
    | "phase_not_available";
  message: string;
  retryable: boolean;
}) {
  return Response.json(
    practiceApiErrorSchema.parse({ error: input }),
    { status: input.status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ practiceSessionId: string }> },
) {
  const { practiceSessionId } = await context.params;
  const parsedId = databaseIdSchema.safeParse(practiceSessionId);
  let form: FormData;
  try {
    form = await readAudioForm(request);
  } catch {
    form = new FormData();
  }
  const audio = form.get("audio");
  if (!parsedId.success || !(audio instanceof File)) {
    return errorResponse({
      status: 400,
      code: "invalid_request",
      message: "Record one response to create its transcript.",
      retryable: false,
    });
  }

  try {
    const anonymousSessionId = (await getOrCreateAnonymousRouteSession()).id;
    const snapshot = await getPracticeRepository().getPracticeSession({
      anonymousSessionId,
      practiceSessionId: parsedId.data,
      now: new Date().toISOString(),
    });
    if (!snapshot) {
      return errorResponse({
        status: 404,
        code: "not_found",
        message: "This practice is no longer available.",
        retryable: false,
      });
    }
    if (!canAcceptLearnerResponse(snapshot.state)) {
      return errorResponse({
        status: 409,
        code: "phase_not_available",
        message: "This practice is not ready for a response.",
        retryable: false,
      });
    }

    const bytes = new Uint8Array(await audio.arrayBuffer());
    const recording = await validateRecording({
      audio: bytes,
      mimeType: audio.type,
    });
    const result = await getPracticeTranscriptionProvider().transcribe({
      audio: bytes,
      mimeType: audio.type,
      language: "en",
      filename: recording.filename,
    });
    const transcript = result.text.replace(/\s+/g, " ").trim();
    if (!transcript) {
      return errorResponse({
        status: 422,
        code: "unclear_audio",
        message: "We could not hear a clear response. Please record it again.",
        retryable: true,
      });
    }
    return Response.json(
      practiceTranscriptionPreviewResponseSchema.parse({ transcript }),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof AudioValidationError) {
      return errorResponse({
        status: 422,
        code: ["empty", "unreadable", "too_short"].includes(error.code)
          ? "unclear_audio"
          : "invalid_audio",
        message: "We could not hear a clear response. Please record it again.",
        retryable: true,
      });
    }
    return errorResponse({
      status: 503,
      code: "provider_unavailable",
      message: "We could not prepare the transcript. Please try again.",
      retryable: true,
    });
  }
}
