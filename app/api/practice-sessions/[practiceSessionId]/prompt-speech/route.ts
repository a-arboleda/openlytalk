import { cookies } from "next/headers";

import { getPracticeRepository } from "@/lib/persistence/postgres/practice-repository";
import { getElevenLabsPartnerSpeechProvider } from "@/lib/providers/practice-audio-providers";
import { ANONYMOUS_SESSION_COOKIE_NAME } from "@/lib/session/anonymous-session";
import { databaseIdSchema } from "@/lib/validation/persistence";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ practiceSessionId: string }> },
) {
  const { practiceSessionId } = await context.params;
  const parsedPracticeId = databaseIdSchema.safeParse(practiceSessionId);
  const cookieStore = await cookies();
  const parsedSessionId = databaseIdSchema.safeParse(
    cookieStore.get(ANONYMOUS_SESSION_COOKIE_NAME)?.value,
  );
  if (!parsedPracticeId.success || !parsedSessionId.success) {
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

  const promptText = snapshot?.state.plan.opening.partnerOpeningText;
  if (
    !snapshot ||
    snapshot.state.schemaVersion !== 6 ||
    snapshot.state.status !== "active" ||
    snapshot.state.phase !== "briefing" ||
    !promptText
  ) {
    return new Response(null, { status: 404 });
  }

  try {
    const result = await getElevenLabsPartnerSpeechProvider().synthesize({
      speechId: snapshot.state.practiceSessionId,
      text: promptText,
      role: "partner",
      voiceProfile: "neutral",
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
