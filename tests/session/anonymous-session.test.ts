import { describe, expect, it, vi } from "vitest";

import type { AnonymousSessionRecord } from "@/lib/persistence/conversation-repository";
import {
  ANONYMOUS_SESSION_COOKIE_NAME,
  ANONYMOUS_SESSION_MAX_AGE_SECONDS,
  resolveAnonymousSession,
} from "@/lib/session/anonymous-session";

const now = new Date("2026-07-17T12:00:00.000Z");
const existingSessionId = "2f30f9ac-37d9-4bf2-b924-d6455d6ce41f";

function repository() {
  return {
    createSession: vi.fn(async () => undefined),
    renewSession: vi.fn(
      async (): Promise<AnonymousSessionRecord | null> => null,
    ),
  };
}

describe("anonymous session resolution", () => {
  it("creates a cryptographically random session and protected cookie", async () => {
    const sessionRepository = repository();
    const result = await resolveAnonymousSession({
      cookieValue: undefined,
      repository: sessionRepository,
      now,
      production: true,
    });

    expect(result.created).toBe(true);
    expect(result.record.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(result.cookie).toEqual({
      name: ANONYMOUS_SESSION_COOKIE_NAME,
      value: result.record.id,
      options: {
        httpOnly: true,
        sameSite: "lax",
        secure: true,
        path: "/",
        maxAge: ANONYMOUS_SESSION_MAX_AGE_SECONDS,
        expires: new Date("2026-07-22T12:00:00.000Z"),
      },
    });
    expect(sessionRepository.createSession).toHaveBeenCalledWith(result.record);
  });

  it("requests a five-day renewal while preserving a longer retained expiry", async () => {
    const sessionRepository = repository();
    sessionRepository.renewSession.mockResolvedValue({
      id: existingSessionId,
      createdAt: "2026-07-15T12:00:00.000Z",
      expiresAt: "2026-07-24T12:00:00.000Z",
    });

    const result = await resolveAnonymousSession({
      cookieValue: existingSessionId,
      repository: sessionRepository,
      now,
      production: false,
    });

    expect(result.created).toBe(false);
    expect(result.record.id).toBe(existingSessionId);
    expect(sessionRepository.renewSession).toHaveBeenCalledWith({
      sessionId: existingSessionId,
      now: "2026-07-17T12:00:00.000Z",
      expiresAt: "2026-07-22T12:00:00.000Z",
    });
    expect(result.cookie.options.expires.toISOString()).toBe("2026-07-24T12:00:00.000Z");
    expect(result.cookie.options.maxAge).toBe(7 * 86400);
    expect(sessionRepository.createSession).not.toHaveBeenCalled();
    expect(result.cookie.options.secure).toBe(false);
  });

  it("replaces an invalid or expired cookie without querying it as an id", async () => {
    const sessionRepository = repository();
    const result = await resolveAnonymousSession({
      cookieValue: "not-a-session-id",
      repository: sessionRepository,
      now,
      production: false,
    });

    expect(result.created).toBe(true);
    expect(sessionRepository.renewSession).not.toHaveBeenCalled();
    expect(sessionRepository.createSession).toHaveBeenCalledOnce();
  });
});
