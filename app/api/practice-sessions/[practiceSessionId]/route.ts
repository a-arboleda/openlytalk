import {
  deletePracticeResponseSchema,
  practiceApiErrorSchema,
  practiceSessionResponseSchema,
  toPublicPracticeSession,
} from "@/lib/coaching/public-contracts";
import { getPracticeRepository } from "@/lib/persistence/postgres/practice-repository";
import { getOrCreateAnonymousRouteSession } from "@/lib/session/route-session";
import { databaseIdSchema } from "@/lib/validation/persistence";

export const runtime = "nodejs";

function errorResponse(input: {
  status: number;
  code: "not_found" | "expired" | "persistence_unavailable";
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

export async function GET(
  _request: Request,
  context: { params: Promise<{ practiceSessionId: string }> },
) {
  const { practiceSessionId } = await context.params;
  const parsedId = databaseIdSchema.safeParse(practiceSessionId);
  if (!parsedId.success) {
    return errorResponse({
      status: 404,
      code: "not_found",
      message: "This practice may have expired or belongs to another session.",
      retryable: false,
    });
  }

  try {
    const anonymousSession = await getOrCreateAnonymousRouteSession();
    const result = await getPracticeRepository().lookupPracticeSession({
      anonymousSessionId: anonymousSession.id,
      practiceSessionId: parsedId.data,
      now: new Date().toISOString(),
    });
    if (result.kind === "expired") {
      return errorResponse({
        status: 410,
        code: "expired",
        message:
          "This practice has expired. Anonymous practices are available for seven days.",
        retryable: false,
      });
    }
    if (result.kind === "not_found") {
      return errorResponse({
        status: 404,
        code: "not_found",
        message:
          "This practice may have expired or belongs to another session.",
        retryable: false,
      });
    }

    return Response.json(
      practiceSessionResponseSchema.parse({
        session: toPublicPracticeSession(result.snapshot.state),
      }),
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch {
    return errorResponse({
      status: 503,
      code: "persistence_unavailable",
      message: "Your practice is temporarily unavailable. Please try again.",
      retryable: true,
    });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ practiceSessionId: string }> },
) {
  const { practiceSessionId } = await context.params;
  const parsedId = databaseIdSchema.safeParse(practiceSessionId);
  if (!parsedId.success) {
    return errorResponse({
      status: 404,
      code: "not_found",
      message: "This practice is no longer available.",
      retryable: false,
    });
  }

  try {
    const anonymousSession = await getOrCreateAnonymousRouteSession();
    const deleted = await getPracticeRepository().deletePracticeSession({
      anonymousSessionId: anonymousSession.id,
      practiceSessionId: parsedId.data,
    });
    if (!deleted) {
      return errorResponse({
        status: 404,
        code: "not_found",
        message: "This practice is no longer available.",
        retryable: false,
      });
    }

    return Response.json(deletePracticeResponseSchema.parse({ deleted: true }), {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return errorResponse({
      status: 503,
      code: "persistence_unavailable",
      message: "We could not delete this practice. Please try again.",
      retryable: true,
    });
  }
}
