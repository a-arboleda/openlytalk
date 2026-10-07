import {
  practiceApiErrorSchema,
  startPracticeRequestSchema,
  startPracticeResponseSchema,
  toPublicPracticeSession,
} from "@/lib/coaching/public-contracts";
import {
  startPracticeSession,
  StartPracticeError,
} from "@/lib/coaching/start-practice-session";
import { getPracticeRepository } from "@/lib/persistence/postgres/practice-repository";
import { getOrCreateAnonymousRouteSession } from "@/lib/session/route-session";
import { databaseIdSchema } from "@/lib/validation/persistence";

export const runtime = "nodejs";

function errorResponse(input: {
  status: number;
  code:
    | "invalid_request"
    | "not_found"
    | "stale_state"
    | "practice_not_active"
    | "persistence_unavailable";
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
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const parsedRequest = startPracticeRequestSchema.safeParse(body);
  if (!parsedId.success || !parsedRequest.success) {
    return errorResponse({
      status: 400,
      code: "invalid_request",
      message: "Refresh the practice and try again.",
      retryable: false,
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
    const state = await startPracticeSession({
      anonymousSessionId,
      practiceSessionId: parsedId.data,
      expectedUpdatedAt: parsedRequest.data.expectedUpdatedAt,
      repository: getPracticeRepository(),
    });
    const session = toPublicPracticeSession(state);
    const partnerOpening = session.messages.find(
      (message) =>
        message.role === "partner" &&
        message.phase === "initial_simulation" &&
        message.sequence === 0,
    );

    return Response.json(
      startPracticeResponseSchema.parse({
        session,
        autoplaySpeechUrl: partnerOpening?.speechUrl ?? null,
      }),
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    if (error instanceof StartPracticeError) {
      if (error.reason === "not_found") {
        return errorResponse({
          status: 404,
          code: "not_found",
          message:
            "This practice may have expired or belongs to another session.",
          retryable: false,
        });
      }
      if (error.reason === "stale_state") {
        return errorResponse({
          status: 409,
          code: "stale_state",
          message: "This practice changed. Refresh it and try again.",
          retryable: true,
        });
      }
      if (error.reason === "practice_not_active") {
        return errorResponse({
          status: 409,
          code: "practice_not_active",
          message: "This practice cannot be started from its current stage.",
          retryable: false,
        });
      }
    }

    return errorResponse({
      status: 503,
      code: "persistence_unavailable",
      message: "We could not open this practice. Please try again.",
      retryable: true,
    });
  }
}
