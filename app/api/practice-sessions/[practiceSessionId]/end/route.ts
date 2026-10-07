import {
  endPracticeRequestSchema,
  practiceApiErrorSchema,
} from "@/lib/coaching/public-contracts";
import {
  endPracticeSession,
  EndPracticeSessionError,
} from "@/lib/coaching/end-practice-session";
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
    | "stale_state"
    | "provider_unavailable"
    | "persistence_unavailable"
    | "invalid_generated_output"
    | "practice_not_active";
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
  const parsedRequest = endPracticeRequestSchema.safeParse(body);
  if (!parsedId.success || !parsedRequest.success) {
    return errorResponse({
      status: 400,
      code: "invalid_request",
      message: "Refresh the practice and try ending it again.",
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
    const result = await endPracticeSession({
      anonymousSessionId,
      practiceSessionId: parsedId.data,
      expectedUpdatedAt: parsedRequest.data.expectedUpdatedAt,
      repository: getPracticeRepository(),
      model: getPracticeModel(),
    });
    return Response.json(result, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof EndPracticeSessionError) {
      return errorResponse({
        status: error.status,
        ...error.apiError,
      });
    }
    return errorResponse({
      status: 503,
      code: "persistence_unavailable",
      message: "We could not end this practice. Please try again.",
      retryable: true,
    });
  }
}
