import {
  createPracticeSession,
  PracticeSessionCreationError,
} from "@/lib/coaching/create-practice-session";
import { inferPracticeSetup } from "@/lib/coaching/infer-practice-setup";
import {
  describedSituationRequestSchema,
  practiceApiErrorSchema,
  practiceSessionResponseSchema,
  toPublicPracticeSession,
} from "@/lib/coaching/public-contracts";
import { buildPracticeFieldErrors } from "@/lib/coaching/public-errors";
import { getPracticeModel } from "@/lib/openai/practice-model";
import { getPracticeRepository } from "@/lib/persistence/postgres/practice-repository";
import { getOrCreateAnonymousRouteSession } from "@/lib/session/route-session";

export const runtime = "nodejs";

function errorResponse(input: {
  status: number;
  code: "invalid_request" | "persistence_unavailable" | "invalid_generated_output";
  message: string;
  retryable: boolean;
  fieldErrors?: Record<string, string[]>;
}) {
  return Response.json(
    practiceApiErrorSchema.parse({ error: input }),
    { status: input.status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const parsed = describedSituationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse({
      status: 400,
      code: "invalid_request",
      message: "Answer both questions so we can create your practice.",
      retryable: false,
      fieldErrors: buildPracticeFieldErrors(parsed.error.issues),
    });
  }

  try {
    const anonymousSessionId = (await getOrCreateAnonymousRouteSession()).id;
    const model = getPracticeModel();
    const setup = await inferPracticeSetup({ ...parsed.data, model });
    const result = await createPracticeSession({
      anonymousSessionId,
      setup,
      model,
      repository: getPracticeRepository(),
    });

    return Response.json(
      practiceSessionResponseSchema.parse({
        session: toPublicPracticeSession(result.state),
      }),
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const persistenceFailure =
      error instanceof PracticeSessionCreationError &&
      error.reason === "persistence_unavailable";
    return errorResponse({
      status: 503,
      code: persistenceFailure
        ? "persistence_unavailable"
        : "invalid_generated_output",
      message: persistenceFailure
        ? "We could not save your practice right now. Please try again."
        : "We could not prepare this practice yet. Please try again.",
      retryable: true,
    });
  }
}
