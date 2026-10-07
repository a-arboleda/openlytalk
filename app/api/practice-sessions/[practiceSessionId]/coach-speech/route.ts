import { cookies } from "next/headers";

import { buildCoachSpeechText } from "@/lib/coaching/coach-speech";
import { coachSpeechRequestSchema } from "@/lib/coaching/public-contracts";
import { getPracticeSpeechProvider } from "@/lib/providers/practice-audio-providers";
import { getPracticeRepository } from "@/lib/persistence/postgres/practice-repository";
import { ANONYMOUS_SESSION_COOKIE_NAME } from "@/lib/session/anonymous-session";
import { databaseIdSchema } from "@/lib/validation/persistence";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ practiceSessionId: string }> },
) {
  const { practiceSessionId } = await context.params;
  const url = new URL(request.url);
  const parsedPracticeId = databaseIdSchema.safeParse(practiceSessionId);
  const parsedContent = coachSpeechRequestSchema.safeParse({
    content: url.searchParams.get("content"),
  });
  const cookieStore = await cookies();
  const parsedSessionId = databaseIdSchema.safeParse(
    cookieStore.get(ANONYMOUS_SESSION_COOKIE_NAME)?.value,
  );
  if (
    !parsedPracticeId.success ||
    !parsedContent.success ||
    !parsedSessionId.success
  ) {
    return new Response(null, { status: 404 });
  }

  let snapshot;
  try {
    snapshot = await getPracticeRepository().getPracticeSession({
      anonymousSessionId: parsedSessionId.data,
      practiceSessionId: parsedPracticeId.data,
      now: new Date().toISOString(),
    });
  } catch {
    return new Response(null, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
  if (!snapshot) return new Response(null, { status: 404 });

  const text = buildCoachSpeechText(
    snapshot.state,
    parsedContent.data.content,
  );
  if (!text) return new Response(null, { status: 404 });

  try {
    const result = await getPracticeSpeechProvider().synthesize({
      speechId: `${snapshot.state.updatedAt}:${parsedContent.data.content}`,
      text,
      role: "coach",
      format: "mp3",
    });
    return new Response(Uint8Array.from(result.audio).buffer, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, private",
        "Content-Type": result.contentType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
