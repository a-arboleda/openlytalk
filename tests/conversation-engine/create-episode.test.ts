import { describe, expect, it, vi } from "vitest";

import {
  createEpisode,
  EpisodePersistenceError,
} from "@/lib/conversation-engine/create-episode";
import type { CreateConversationInput } from "@/lib/persistence/conversation-repository";

const sessionId = "10000000-0000-4000-8000-000000000001";
const conversationId = "20000000-0000-4000-8000-000000000002";

function recordingRepository() {
  let saved: CreateConversationInput | undefined;
  return {
    get saved() {
      return saved;
    },
    createConversation: vi.fn(async (input: CreateConversationInput) => {
      saved = input;
      return { sessionId: input.sessionId, state: input.state, debrief: null };
    }),
  };
}

describe("episode creation", () => {
  it("starts immediately with a learner invitation and no Sofia message", async () => {
    const repository = recordingRepository();
    const result = await createEpisode({
      sessionId,
      request: {
        conversationType: "Sharing Experiences",
        context: "Daily Life",
      },
      repository,
      now: new Date("2026-07-17T12:00:00.000Z"),
      idFactory: () => conversationId,
    });

    expect(result).toMatchObject({
      conversationId,
      starter: {
        ideas: [
          "How you prepare or organize something",
          "Your routine, step by step",
          "What happened and why",
        ],
      },
      episode: {
        acceptedResponseCount: 0,
        maxAcceptedResponses: 8,
        expectedSequence: 0,
        expiresAt: "2026-07-22T12:00:00.000Z",
      },
    });
    expect(result.starter.prompt).toContain("Sofia");
    expect(JSON.stringify(result)).not.toContain("privateFact");
    expect(JSON.stringify(result)).not.toContain("initialEmotion");

    expect(repository.saved?.state).toMatchObject({
      status: "active",
      stage: "opening",
      conversationType: "Sharing Experiences",
      context: "Daily Life",
      acceptedResponseCount: 0,
      expectedSequence: 0,
      trust: { level: "comfortable" },
      warningActive: false,
      messages: [],
      scenePlan: {
        openingMode: "learner_first",
      },
    });
  });

  it("does not require a conversation model to create an episode", async () => {
    const repository = recordingRepository();

    await expect(
      createEpisode({
        sessionId,
        request: {
          conversationType: "Expressing Yourself",
          context: "Work",
        },
        repository,
        idFactory: () => conversationId,
      }),
    ).resolves.toMatchObject({ conversationId });
    expect(repository.createConversation).toHaveBeenCalledTimes(1);
  });

  it("rejects an invalid creation time", async () => {
    await expect(
      createEpisode({
        sessionId,
        request: {
          conversationType: "Sharing Experiences",
          context: "Daily Life",
        },
        repository: recordingRepository(),
        now: new Date(Number.NaN),
      }),
    ).rejects.toThrow("valid current time");
  });

  it("maps repository failures to a persistence error", async () => {
    await expect(
      createEpisode({
        sessionId,
        request: {
          conversationType: "Difficult Conversations",
          context: "Relationships",
        },
        repository: {
          createConversation: vi.fn(async () => {
            throw new Error("database unavailable");
          }),
        },
        idFactory: () => conversationId,
      }),
    ).rejects.toBeInstanceOf(EpisodePersistenceError);
  });
});
