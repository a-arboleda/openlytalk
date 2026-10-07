import {
  practiceApiErrorSchema,
  retryPracticeRequestSchema,
  retryPracticeResponseSchema,
  toPublicPracticeSession,
} from "@/lib/coaching/public-contracts";
import {
  beginPracticeTargetedRetry,
  BeginTargetedRetryError,
} from "@/lib/coaching/begin-targeted-retry";
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
  const parsedRequest = retryPracticeRequestSchema.safeParse(body);
  if (!parsedId.success || !parsedRequest.success) {
    return errorResponse({
      status: 400,
      code: "invalid_request",
      message: "Refresh the practice and try the retry again.",
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
    const state = await beginPracticeTargetedRetry({
      anonymousSessionId,
      practiceSessionId: parsedId.data,
      expectedUpdatedAt: parsedRequest.data.expectedUpdatedAt,
      repository: getPracticeRepository(),
    });
    return Response.json(
      retryPracticeResponseSchema.parse({
        session: toPublicPracticeSession(state),
      }),
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    if (error instanceof BeginTargetedRetryError) {
      if (error.reason === "not_found") {
        return errorResponse({
          status: 404,
          code: "not_found",
          message: "This practice is no longer available.",
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
          message: "The retry cannot begin from this stage.",
          retryable: false,
        });
      }
    }
    return errorResponse({
      status: 503,
      code: "persistence_unavailable",
      message: "We could not start the retry. Please try again.",
      retryable: true,
    });
  }
}
