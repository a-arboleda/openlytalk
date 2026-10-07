import { describe, expect, it } from "vitest";

import {
  CONTEXTS,
  CONTEXT_VALUES,
  CONVERSATION_TYPES,
  CONVERSATION_TYPE_VALUES,
  conversationContextLabel,
  conversationTypeLabel,
  V1_RULES,
} from "@/lib/product-rules";
import { createEpisodeRequestSchema } from "@/lib/validation/episode";

describe("canonical product rules", () => {
  it("keeps the three confirmed Conversation Types and four Contexts", () => {
    expect(CONVERSATION_TYPE_VALUES).toEqual([
      "Sharing Experiences",
      "Expressing Yourself",
      "Difficult Conversations",
    ]);
    expect(CONTEXT_VALUES).toEqual([
      "Relationships",
      "Work",
      "Daily Life",
      "Life Moments",
    ]);
  });

  it("maps stored values to the confirmed learner-facing choices", () => {
    expect(CONVERSATION_TYPES.map((option) => option.label)).toEqual([
      "Describe or explain something",
      "Express what you think or feel",
      "Talk through something difficult",
    ]);
    expect(CONVERSATION_TYPES.map((option) => option.description)).toEqual([
      "Describe what happened, explain how you do something, or walk through the steps.",
      "Share a feeling, opinion, belief, preference, or reaction in your own words.",
      "Explain a problem or uncomfortable situation you are dealing with.",
    ]);
    expect(CONTEXTS.map((option) => option.label)).toEqual([
      "Relationships & Friendship",
      "Work & Ambition",
      "Everyday Life",
      "Ideas & The World",
    ]);
    expect(conversationTypeLabel("Sharing Experiences")).toBe(
      "Describe or explain something",
    );
    expect(conversationContextLabel("Life Moments")).toBe(
      "Ideas & The World",
    );
  });

  it("accepts all 12 type and context combinations", () => {
    for (const conversationType of CONVERSATION_TYPE_VALUES) {
      for (const context of CONTEXT_VALUES) {
        expect(
          createEpisodeRequestSchema.safeParse({ conversationType, context })
            .success,
        ).toBe(true);
      }
    }
  });

  it("rejects unknown selection labels", () => {
    expect(
      createEpisodeRequestSchema.safeParse({
        conversationType: "Grammar Practice",
        context: "Work",
      }).success,
    ).toBe(false);
  });

  it("rejects the removed everyday-chat option", () => {
    expect(
      createEpisodeRequestSchema.safeParse({
        conversationType: "Everyday Conversations",
        context: "Daily Life",
      }).success,
    ).toBe(false);
  });

  it("encodes the confirmed v1 limits", () => {
    expect(V1_RULES).toMatchObject({
      captionsDefaultOn: false,
      language: "English",
      maxAcceptedResponses: 8,
      maxRecordingSeconds: 60,
      persistAudio: false,
      retentionDays: 7,
      textInputFallback: false,
    });
  });
});
