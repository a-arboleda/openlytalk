import { randomUUID } from "node:crypto";

import {
  createPracticeSession,
  PracticeSessionCreationError,
} from "@/lib/coaching/create-practice-session";
import {
  createPracticeSessionRequestSchema,
  practiceApiErrorSchema,
  practiceSessionResponseSchema,
  quickPracticeSessionRequestSchema,
  toPublicPracticeSession,
  type PublicPracticeSession,
} from "@/lib/coaching/public-contracts";
import { getPracticeModel } from "@/lib/openai/practice-model";
import { getPracticeRepository } from "@/lib/persistence/postgres/practice-repository";
import { getOrCreateAnonymousRouteSession } from "@/lib/session/route-session";
import { buildPracticeFieldErrors } from "@/lib/coaching/public-errors";
import { buildQuickPracticeSetup } from "@/lib/coaching/quick-practice";

export const runtime = "nodejs";

function errorResponse(input: {
  status: number;
  code:
    | "invalid_request"
    | "persistence_unavailable"
    | "invalid_generated_output";
  message: string;
  retryable: boolean;
  fieldErrors?: Record<string, string[]>;
}) {
  return Response.json(
    practiceApiErrorSchema.parse({
      error: {
        code: input.code,
        message: input.message,
        retryable: input.retryable,
        fieldErrors: input.fieldErrors,
      },
    }),
    {
      status: input.status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse({
      status: 400,
      code: "invalid_request",
      message: "Check your practice choices and try again.",
      retryable: false,
    });
  }

  const parsedQuickSelection = quickPracticeSessionRequestSchema.safeParse(body);
  const parsedSetup = createPracticeSessionRequestSchema.safeParse(body);
  if (!parsedQuickSelection.success && !parsedSetup.success) {
    return errorResponse({
      status: 400,
      code: "invalid_request",
      message: "Check your practice choices and try again.",
      retryable: false,
      fieldErrors: buildPracticeFieldErrors(parsedQuickSelection.error.issues),
    });
  }

  let anonymousSessionId: string;
  try {
    anonymousSessionId = (await getOrCreateAnonymousRouteSession()).id;
  } catch {
    return errorResponse({
      status: 503,
      code: "persistence_unavailable",
      message: "We could not start your practice right now. Please try again.",
      retryable: true,
    });
  }

  try {
    const quickSelection = parsedQuickSelection.success;
    const setup = parsedQuickSelection.success
      ? buildQuickPracticeSetup({
          selection: parsedQuickSelection.data,
          variationSeed: randomUUID(),
        })
      : parsedSetup.data;
    const result = await createPracticeSession({
      anonymousSessionId,
      setup,
      model: getPracticeModel(),
      repository: getPracticeRepository(),
      practiceFormat: quickSelection ? "single_prompt" : undefined,
    });
    const session: PublicPracticeSession = toPublicPracticeSession(
      result.state,
    );
    return Response.json(
      practiceSessionResponseSchema.parse({ session }),
      {
        status: 201,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    if (error instanceof PracticeSessionCreationError) {
      if (error.reason === "invalid_generated_output") {
        return errorResponse({
          status: 503,
          code: "invalid_generated_output",
          message:
            "We could not prepare this practice yet. Please try again.",
          retryable: true,
        });
      }
      return errorResponse({
        status: 503,
        code: "persistence_unavailable",
        message:
          "We could not save your practice right now. Please try again.",
        retryable: true,
      });
    }

    return errorResponse({
      status: 503,
      code: "invalid_generated_output",
      message: "We could not prepare this practice yet. Please try again.",
      retryable: true,
    });
  }
}
