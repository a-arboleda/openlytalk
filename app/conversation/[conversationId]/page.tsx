import { notFound } from "next/navigation";
import { cookies } from "next/headers";

import { ConversationExperience } from "@/components/conversation/conversation-experience";
import { toConversationView } from "@/lib/conversation-engine/public-view";
import { getConversationRepository } from "@/lib/persistence/postgres/repository";
import { ANONYMOUS_SESSION_COOKIE_NAME } from "@/lib/session/anonymous-session";
import { databaseIdSchema } from "@/lib/validation/persistence";

export const dynamic = "force-dynamic";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  const parsedConversationId = databaseIdSchema.safeParse(conversationId);
  if (!parsedConversationId.success) notFound();

  const cookieStore = await cookies();
  const sessionId = cookieStore.get(ANONYMOUS_SESSION_COOKIE_NAME)?.value;
  const parsedSessionId = databaseIdSchema.safeParse(sessionId);
  if (!parsedSessionId.success) notFound();

  const snapshot = await getConversationRepository().getConversation({
    sessionId: parsedSessionId.data,
    conversationId: parsedConversationId.data,
    now: new Date().toISOString(),
  });
  if (!snapshot) notFound();

  return <ConversationExperience initial={toConversationView(snapshot.state)} />;
}
