import "server-only";

import { cookies } from "next/headers";

import { getConversationRepository } from "@/lib/persistence/postgres/repository";
import {
  ANONYMOUS_SESSION_COOKIE_NAME,
  resolveAnonymousSession,
} from "@/lib/session/anonymous-session";

/**
 * Call only from a Route Handler or Server Action where response cookies may
 * be written. The cookie value is never exposed by learner-facing APIs.
 */
export async function getOrCreateAnonymousRouteSession() {
  const cookieStore = await cookies();
  const resolved = await resolveAnonymousSession({
    cookieValue: cookieStore.get(ANONYMOUS_SESSION_COOKIE_NAME)?.value,
    repository: getConversationRepository(),
  });

  cookieStore.set(
    resolved.cookie.name,
    resolved.cookie.value,
    resolved.cookie.options,
  );

  return resolved.record;
}
