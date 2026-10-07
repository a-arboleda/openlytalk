import { SESSION_ACCESS_DAYS } from "@/lib/operations/retention-policy";
import { randomUUID } from "node:crypto";

import type {
  AnonymousSessionRecord,
  ConversationRepository,
} from "@/lib/persistence/conversation-repository";
import { databaseIdSchema } from "@/lib/validation/persistence";

export const ANONYMOUS_SESSION_COOKIE_NAME = "openlytalk_session";
export const ANONYMOUS_SESSION_MAX_AGE_SECONDS =
  SESSION_ACCESS_DAYS * 24 * 60 * 60;

type SessionRepository = Pick<
  ConversationRepository,
  "createSession" | "renewSession"
>;

export interface SessionCookieOptions {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
  expires: Date;
}

export interface ResolvedAnonymousSession {
  record: AnonymousSessionRecord;
  created: boolean;
  cookie: {
    name: typeof ANONYMOUS_SESSION_COOKIE_NAME;
    value: string;
    options: SessionCookieOptions;
  };
}

function expirationFrom(now: Date): Date {
  return new Date(now.getTime() + ANONYMOUS_SESSION_MAX_AGE_SECONDS * 1_000);
}

function cookieOptions(expires: Date, production: boolean, now: Date): SessionCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: production,
    path: "/",
    maxAge: Math.max(1, Math.ceil((expires.getTime() - now.getTime()) / 1000)),
    expires,
  };
}

export async function resolveAnonymousSession(input: {
  cookieValue: string | undefined;
  repository: SessionRepository;
  now?: Date;
  production?: boolean;
}): Promise<ResolvedAnonymousSession> {
  const now = input.now ?? new Date();
  const expires = expirationFrom(now);
  const nowIso = now.toISOString();
  const expiresAt = expires.toISOString();
  const production =
    input.production ?? process.env.NODE_ENV === "production";

  const validCookieId = databaseIdSchema.safeParse(input.cookieValue);
  if (validCookieId.success) {
    const renewed = await input.repository.renewSession({
      sessionId: validCookieId.data,
      now: nowIso,
      expiresAt,
    });
    if (renewed) {
      return {
        record: renewed,
        created: false,
        cookie: {
          name: ANONYMOUS_SESSION_COOKIE_NAME,
          value: renewed.id,
          options: cookieOptions(new Date(renewed.expiresAt), production, now),
        },
      };
    }
  }

  const record = {
    id: randomUUID(),
    createdAt: nowIso,
    expiresAt,
  } satisfies AnonymousSessionRecord;
  await input.repository.createSession(record);

  return {
    record,
    created: true,
    cookie: {
      name: ANONYMOUS_SESSION_COOKIE_NAME,
      value: record.id,
      options: cookieOptions(expires, production, now),
    },
  };
}
