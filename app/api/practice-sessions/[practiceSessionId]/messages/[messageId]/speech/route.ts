import { cookies } from "next/headers";

import { partnerVoiceProfile } from "@/lib/coaching/partner-voice-profile";
import { getPracticeSpeechProvider } from "@/lib/providers/practice-audio-providers";
import { getPracticeRepository } from "@/lib/persistence/postgres/practice-repository";
import { ANONYMOUS_SESSION_COOKIE_NAME } from "@/lib/session/anonymous-session";
import { databaseIdSchema } from "@/lib/validation/persistence";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      practiceSessionId: string;
      messageId: string;
    }>;
  },
) {
  const { practiceSessionId, messageId } = await context.params;
  const parsedPracticeId = databaseIdSchema.safeParse(practiceSessionId);
  const parsedMessageId = databaseIdSchema.safeParse(messageId);
  const cookieStore = await cookies();
  const parsedSessionId = databaseIdSchema.safeParse(
    cookieStore.get(ANONYMOUS_SESSION_COOKIE_NAME)?.value,
  );
  if (
    !parsedPracticeId.success ||
    !parsedMessageId.success ||
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

  const message = snapshot.state.messages.find(
    (candidate) =>
      candidate.id === parsedMessageId.data &&
      candidate.role === "partner",
  );
  if (!message) return new Response(null, { status: 404 });

  try {
    const result = await getPracticeSpeechProvider().synthesize({
      speechId: message.id,
      text: message.text,
      role: "partner",
      voiceProfile: partnerVoiceProfile(
        snapshot.state.plan.partner.roleLabel,
        [
          snapshot.state.plan.partner.relationshipToLearner,
          snapshot.state.plan.situation,
          snapshot.state.setup.situationDetail ?? "",
        ],
      ),
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
