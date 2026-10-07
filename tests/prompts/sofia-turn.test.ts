import { describe, expect, it } from "vitest";

import type {
  ConversationState,
  TranscriptMessage,
} from "@/lib/validation/conversation";
import { buildSofiaTurnPrompt } from "@/prompts/sofia-turn";

describe("Sofia turn prompt", () => {
  it("keeps Sofia brief, personal, conversational, and easy to answer", () => {
    const state = {
      conversationId: "conversation-1",
      conversationType: "Sharing Experiences",
      context: "Daily Life",
      scenePlan: null,
      stage: "developing",
      mode: "normal",
      acceptedResponseCount: 1,
      trust: { level: "comfortable" },
      emotion: { kind: "curious", intensity: "low" },
      warningActive: false,
      topics: ["starting a new job"],
      privateFactRevealed: false,
      messages: [],
    } as unknown as ConversationState;
    const learnerMessage = {
      id: "learner-1",
      role: "learner",
      sequence: 1,
      text: "I probably would have asked someone for help.",
      createdAt: "2026-07-22T12:00:00.000Z",
    } satisfies TranscriptMessage;

    const prompt = buildSofiaTurnPrompt({
      state,
      learnerMessage,
      repairAttempt: false,
    });

    expect(prompt.instructions).toContain("relaxed friend-to-friend rhythm");
    expect(prompt.instructions).toContain(
      "one relevant thought or concrete detail from Sofia's own life",
    );
    expect(prompt.instructions).toContain("Do not turn the reply into a mini-speech");
    expect(prompt.instructions).toContain("what they would do now");
    expect(prompt.instructions).toContain(
      'A simple "What do you think?" is natural',
    );
    expect(prompt.instructions).toContain(
      "primary practice outcome is everyday personal fluency",
    );
    expect(prompt.instructions).toContain(
      "Let the learner's first contribution establish",
    );
    expect(prompt.instructions).toContain("this is Sofia's first spoken turn");
    expect(prompt.instructions).toContain(
      "If the learner gives a short or vague answer",
    );
    expect(prompt.instructions).toContain(
      "one concrete fact, person, place, time, first or",
    );
    expect(prompt.instructions).toContain(
      "explanation of a routine, task, process, sequence, reason, or decision",
    );
    expect(prompt.instructions).toContain(
      "organize only one missing part at a time",
    );
    expect(prompt.instructions).toContain("what happens first, what");
    expect(prompt.instructions).toContain(
      "simple but meaningful personal facts as self-expression evidence",
    );
    expect(prompt.instructions).toContain(
      "opinion, belief, reaction to a social question",
    );
    expect(prompt.instructions).toContain(
      "latest details and continue",
    );
    expect(prompt.instructions).toContain("formal debate");
    expect(prompt.instructions).toContain(
      "A question is optional in every Sofia response",
    );
    expect(prompt.instructions).toContain(
      "leave conversational space without asking anything",
    );
    expect(prompt.instructions).toContain(
      "Join joy warmly without inflated praise",
    );
    expect(prompt.instructions).toContain(
      "slow down with sadness",
    );
    expect(prompt.instructions).toContain(
      "Do not change topics merely to create variety",
    );
    expect(prompt.instructions).toContain(
      "Remember and naturally reuse relevant details",
    );
    expect(prompt.instructions).toContain("business-idea lists");
    expect(prompt.instructions).toContain("many plants");
    expect(prompt.instructions).toContain("Aim for 8-40");
  });

  it("includes the full bounded episode transcript for natural recall", () => {
    const messages = Array.from({ length: 10 }, (_, index) => ({
      id: `message-${index}`,
      role: index % 2 === 0 ? "learner" : "sofia",
      sequence: index,
      text:
        index === 0
          ? "I am training for my first 10K."
          : `Earlier conversation message ${index}.`,
      createdAt: "2026-07-23T12:00:00.000Z",
    }));
    const state = {
      conversationId: "conversation-memory",
      conversationType: "Sharing Experiences",
      context: "Daily Life",
      scenePlan: null,
      stage: "developing",
      mode: "normal",
      acceptedResponseCount: 5,
      trust: { level: "comfortable" },
      emotion: { kind: "curious", intensity: "low" },
      warningActive: false,
      topics: ["running"],
      privateFactRevealed: false,
      messages,
    } as unknown as ConversationState;
    const learnerMessage = {
      id: "learner-current",
      role: "learner",
      sequence: 10,
      text: "I went for another run this morning.",
      createdAt: "2026-07-23T12:05:00.000Z",
    } satisfies TranscriptMessage;

    const prompt = buildSofiaTurnPrompt({
      state,
      learnerMessage,
      repairAttempt: false,
    });

    expect(prompt.input).toContain("I am training for my first 10K.");
    expect(prompt.input).toContain("Earlier conversation message 9.");
  });
});
