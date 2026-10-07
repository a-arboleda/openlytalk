import { describe, expect, it } from "vitest";

import {
  conversationStateSchema,
  evidenceDimensionSchema,
  nextTurnOutputSchema,
} from "@/lib/validation/conversation";
import {
  DEBRIEF_SECTION_ORDER,
  debriefSchema,
} from "@/lib/validation/debrief";
import { createEpisodeResponseSchema } from "@/lib/validation/episode";
import { turnFormFieldsSchema } from "@/lib/validation/turn";

const createdAt = "2026-07-12T12:00:00.000Z";
const expiresAt = "2026-07-19T12:00:00.000Z";

const emotion = {
  kind: "curious" as const,
  intensity: "low" as const,
  cause: "Sofia wants the learner's opinion about a café layout.",
  evidenceMessageId: null,
};

const scenePlan = {
  openingMode: "learner_first" as const,
  conversationType: "Sharing Experiences" as const,
  context: "Daily Life" as const,
  personalLifeAnchor:
    "Sofia remembers how working in cafés abroad changed what hospitality means to her.",
  location: "A quiet street in Chicago",
  whySofiaBringsItUpNow:
    "She has been comparing those memories with the restaurant she manages now.",
  initialEmotion: emotion,
  sofiaImmediateGoal:
    "Share what that early work experience taught her and hear another perspective.",
  privateFact: {
    fact: "She almost left that café job during her first week.",
    relevanceCondition: "The learner asks how difficult the adjustment was.",
  },
  learnerOpportunity:
    "Respond to Sofia, then describe a related experience from your own life with one concrete detail.",
  stakes: {
    level: "low" as const,
    description: "A personal memory Sofia is ready to discuss without needing resolution.",
  },
  plausibleOutcomes: ["connection_reached", "perspective_clarified"] as const,
  canonConstraints: ["Sofia manages a small restaurant but does not own it."],
  prohibitedInventions: ["Do not invent a current romantic partner."],
  learnerVisibleScene:
    "Tell Sofia about one small thing that happened in your everyday life recently. It can be completely ordinary.",
  sofiaOpeningText:
    "Sofia has not spoken yet because the learner begins this conversation.",
};

function validState() {
  return {
    schemaVersion: 2 as const,
    conversationId: "conversation-1",
    status: "active" as const,
    terminationReason: null,
    outcomeCategory: null,
    conversationType: "Sharing Experiences" as const,
    context: "Daily Life" as const,
    scenePlan,
    stage: "opening" as const,
    mode: "normal" as const,
    acceptedResponseCount: 0,
    expectedSequence: 0,
    trust: {
      level: "comfortable" as const,
      supportStreak: 0,
      lastChangeEvidenceIds: [],
    },
    emotion,
    warningActive: false,
    warningEvidenceMessageId: null,
    topics: [],
    privateFactRevealed: false,
    evidenceEvents: [],
    messages: [] as Array<{
      id: string;
      role: "learner" | "sofia";
      sequence: number;
      text: string;
      createdAt: string;
    }>,
    createdAt,
    updatedAt: createdAt,
    expiresAt,
  };
}

describe("conversation state schema", () => {
  it("accepts a valid opening state", () => {
    expect(conversationStateSchema.safeParse(validState()).success).toBe(true);
  });

  it("rejects accepted responses while still in opening", () => {
    const state = validState();
    state.acceptedResponseCount = 1;
    expect(conversationStateSchema.safeParse(state).success).toBe(false);
  });

  it("requires warning evidence when warning is active", () => {
    const state = validState();
    state.warningActive = true;
    expect(conversationStateSchema.safeParse(state).success).toBe(false);
  });

  it("rejects duplicate transcript sequences", () => {
    const state = validState();
    state.messages.push({
      id: "learner-0",
      role: "learner",
      sequence: 0,
      text: "It sounds uncomfortable.",
      createdAt,
    });
    state.messages.push({
      id: "sofia-0",
      role: "sofia",
      sequence: 0,
      text: "That makes sense.",
      createdAt,
    });
    expect(conversationStateSchema.safeParse(state).success).toBe(false);
  });
});

describe("episode API response schema", () => {
  it("accepts only the learner-visible opening contract", () => {
    const state = validState();
    expect(
      createEpisodeResponseSchema.safeParse({
        conversationId: "20000000-0000-4000-8000-000000000002",
        conversationType: state.conversationType,
        context: state.context,
        starter: {
          prompt: scenePlan.learnerVisibleScene,
          ideas: [
            "How you prepare or organize something",
            "Your routine, step by step",
            "What happened and why",
          ],
        },
        episode: {
          status: "active",
          acceptedResponseCount: 0,
          maxAcceptedResponses: 8,
          expectedSequence: 0,
          expiresAt,
        },
      }).success,
    ).toBe(true);
  });
});

describe("turn form fields schema", () => {
  it("accepts sequence zero for the learner's first audio response", () => {
    expect(
      turnFormFieldsSchema.safeParse({
        idempotencyKey: "first-audio-response",
        expectedSequence: "0",
      }).success,
    ).toBe(true);
  });

  it("rejects a negative sequence", () => {
    expect(
      turnFormFieldsSchema.safeParse({
        idempotencyKey: "invalid-audio-response",
        expectedSequence: "-1",
      }).success,
    ).toBe(false);
  });
});

describe("next-turn output schema", () => {
  it("requires all eight distinct evidence dimensions", () => {
    const dimensions = evidenceDimensionSchema.options;
    const output = {
      languageAssessment: { substantiallyEnglish: true },
      interpretation: {
        primaryIntent: "acknowledge",
        secondaryIntent: null,
        evidenceMessageId: "learner-1",
      },
      communicationEvidence: dimensions.map((dimension) => ({
        learnerMessageId: "learner-1",
        dimension,
        classification: "not_observed",
        note: "No observable evidence for this dimension in the response.",
      })),
      safetyClassification: "none",
      boundaryAction: "none",
      stateUpdate: {
        stage: "developing",
        mode: "normal",
        trust: {
          level: "comfortable",
          supportStreak: 1,
          lastChangeEvidenceIds: [],
        },
        emotion,
        topics: ["café layout"],
        privateFactRevealed: false,
      },
      endingDecision: {
        shouldClose: false,
        terminationReason: null,
        outcomeCategory: null,
        evidenceMessageIds: [],
      },
      sofiaText:
        "Exactly. It felt like nobody was supposed to stay very long. What helps a place feel welcoming to you?",
    };

    expect(nextTurnOutputSchema.safeParse(output).success).toBe(true);

    output.communicationEvidence[7] = output.communicationEvidence[0];
    expect(nextTurnOutputSchema.safeParse(output).success).toBe(false);
  });
});

describe("debrief schema", () => {
  it("enforces the ordered three-section contract", () => {
    const debrief = {
      kind: "full",
      sectionOrder: DEBRIEF_SECTION_ORDER,
      communicationInsights: [
        {
          title: "You responded to Sofia's point",
          observation:
            "You acknowledged why the room felt uncomfortable before sharing your view.",
          evidenceMessageIds: ["learner-1"],
        },
        {
          title: "Develop your follow-up",
          observation:
            "A relevant question could have helped Sofia explain what she would change.",
          evidenceMessageIds: ["learner-1"],
        },
      ],
      englishImprovements: [],
      noHighValueEnglishImprovementMessage:
        "Your meaning was clear, and no high-value correction is needed here.",
      retell: {
        prompt:
          "Explain to a friend what Sofia noticed and how the conversation developed.",
        localOnly: true,
        evaluated: false,
      },
    };

    expect(debriefSchema.safeParse(debrief).success).toBe(true);
    expect(
      debriefSchema.safeParse({
        ...debrief,
        sectionOrder: [
          "English Improvements",
          "Communication Insights",
          "Retell the Conversation",
        ],
      }).success,
    ).toBe(false);
  });
});
