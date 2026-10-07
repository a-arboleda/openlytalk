import { describe, expect, it, vi } from "vitest";

import { endConversation } from "@/lib/conversation-engine/end-conversation";
import type { ConversationRepository } from "@/lib/persistence/conversation-repository";
import type { ConversationState } from "@/lib/validation/conversation";

const sessionId = "10000000-0000-4000-8000-000000000001";
const conversationId = "20000000-0000-4000-8000-000000000002";
const now = new Date("2026-07-20T12:00:00.000Z");

function endedState(): ConversationState {
  return {
    conversationId,
    status: "ended",
    terminationReason: "user_exit",
    acceptedResponseCount: 3,
  } as ConversationState;
}

describe("endConversation", () => {
  it("returns the public ended state without consuming a response", async () => {
    const repository: Pick<ConversationRepository, "endConversation"> = {
      endConversation: vi.fn().mockResolvedValue({
        kind: "ended",
        state: endedState(),
      }),
    };

    await expect(
      endConversation({ sessionId, conversationId, repository, now }),
    ).resolves.toEqual({
      conversationId,
      episode: {
        status: "ended",
        terminationReason: "user_exit",
        acceptedResponseCount: 3,
        maxAcceptedResponses: 8,
      },
    });
    expect(repository.endConversation).toHaveBeenCalledWith({
      sessionId,
      conversationId,
      now: now.toISOString(),
    });
  });

  it("accepts an idempotent repeat for a conversation already ended by the learner", async () => {
    const repository: Pick<ConversationRepository, "endConversation"> = {
      endConversation: vi.fn().mockResolvedValue({
        kind: "already_ended",
        state: endedState(),
      }),
    };

    await expect(
      endConversation({ sessionId, conversationId, repository, now }),
    ).resolves.toMatchObject({
      episode: { status: "ended", terminationReason: "user_exit" },
    });
  });

  it("maps repository rejections to an explicit engine error", async () => {
    const repository: Pick<ConversationRepository, "endConversation"> = {
      endConversation: vi.fn().mockResolvedValue({
        kind: "rejected",
        reason: "conversation_not_active",
      }),
    };

    await expect(
      endConversation({ sessionId, conversationId, repository, now }),
    ).rejects.toMatchObject({
      name: "EndConversationError",
      reason: "conversation_not_active",
    });
  });
});
