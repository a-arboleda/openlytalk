import { cookies } from "next/headers";

import { getAudioProviders } from "@/lib/openai/audio-providers";
import { getConversationRepository } from "@/lib/persistence/postgres/repository";
import { ANONYMOUS_SESSION_COOKIE_NAME } from "@/lib/session/anonymous-session";
import { databaseIdSchema } from "@/lib/validation/persistence";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: {
    params: Promise<{ conversationId: string; messageId: string }>;
  },
) {
  const { conversationId, messageId } = await context.params;
  const ids = databaseIdSchema.safeParse(conversationId);
  const message = databaseIdSchema.safeParse(messageId);
  const cookieStore = await cookies();
  const session = databaseIdSchema.safeParse(
    cookieStore.get(ANONYMOUS_SESSION_COOKIE_NAME)?.value,
  );
  if (!ids.success || !message.success || !session.success) {
    return new Response(null, { status: 404 });
  }

  let snapshot;
  try {
    snapshot = await getConversationRepository().getConversation({
      sessionId: session.data,
      conversationId: ids.data,
      now: new Date().toISOString(),
    });
  } catch {
    return new Response(null, { status: 503 });
  }
  const sofiaMessage = snapshot?.state.messages.find(
    (candidate) =>
      candidate.id === message.data && candidate.role === "sofia",
  );
  if (!sofiaMessage) return new Response(null, { status: 404 });

  try {
    const result = await getAudioProviders().speech.synthesize({
      messageId: sofiaMessage.id,
      text: sofiaMessage.text,
      voice: "sofia",
      format: "mp3",
    });
    const body = Uint8Array.from(result.audio).buffer;
    return new Response(body, {
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
