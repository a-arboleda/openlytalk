import {
  practiceApiErrorSchema,
  replacePracticeSituationRequestSchema,
  replacePracticeSituationResponseSchema,
  toPublicPracticeSession,
} from "@/lib/coaching/public-contracts";
import {
  replacePracticeSituation,
  ReplacePracticeSituationError,
} from "@/lib/coaching/replace-practice-situation";
import { getPracticeModel } from "@/lib/openai/practice-model";
import { getPracticeRepository } from "@/lib/persistence/postgres/practice-repository";
import { getOrCreateAnonymousRouteSession } from "@/lib/session/route-session";
import { databaseIdSchema } from "@/lib/validation/persistence";

export const runtime = "nodejs";

type ErrorCode =
  | "invalid_request"
  | "not_found"
  | "stale_state"
  | "phase_not_available"
  | "replacement_limit"
  | "invalid_generated_output"
  | "persistence_unavailable";

function errorResponse(input: {
  status: number;
  code: ErrorCode;
  message: string;
  retryable: boolean;
}) {
  return Response.json(
    practiceApiErrorSchema.parse({ error: input }),
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
  const parsedRequest = replacePracticeSituationRequestSchema.safeParse(body);
  if (!parsedId.success || !parsedRequest.success) {
    return errorResponse({
      status: 400,
      code: "invalid_request",
      message: "Refresh the practice and try another situation again.",
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
    const state = await replacePracticeSituation({
      anonymousSessionId,
      practiceSessionId: parsedId.data,
      idempotencyKey: parsedRequest.data.idempotencyKey,
      expectedUpdatedAt: parsedRequest.data.expectedUpdatedAt,
      model: getPracticeModel(),
      repository: getPracticeRepository(),
    });
    return Response.json(
      replacePracticeSituationResponseSchema.parse({
        session: toPublicPracticeSession(state),
      }),
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    if (error instanceof ReplacePracticeSituationError) {
      switch (error.reason) {
        case "not_found":
          return errorResponse({
            status: 404,
            code: "not_found",
            message:
              "This practice may have expired or belongs to another session.",
            retryable: false,
          });
        case "stale_state":
          return errorResponse({
            status: 409,
            code: "stale_state",
            message: "This practice changed. Refresh it and try again.",
            retryable: true,
          });
        case "phase_not_available":
          return errorResponse({
            status: 409,
            code: "phase_not_available",
            message:
              "You can only choose another generated situation before the simulation starts.",
            retryable: false,
          });
        case "replacement_limit":
          return errorResponse({
            status: 409,
            code: "replacement_limit",
            message:
              "You have already viewed all three situations for this practice.",
            retryable: false,
          });
        case "invalid_generated_output":
          return errorResponse({
            status: 502,
            code: "invalid_generated_output",
            message:
              "We could not prepare a different situation. Please try again.",
            retryable: true,
          });
        case "persistence_unavailable":
          break;
      }
    }

    return errorResponse({
      status: 503,
      code: "persistence_unavailable",
      message: "We could not update this practice. Please try again.",
      retryable: true,
    });
  }
}
