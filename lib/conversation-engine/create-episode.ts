import { SESSION_ACCESS_DAYS } from "@/lib/operations/retention-policy";
import { randomUUID } from "node:crypto";

import { buildLearnerStarter } from "@/lib/conversation-engine/learner-starter";
import type { ConversationRepository } from "@/lib/persistence/conversation-repository";
import { V1_RULES } from "@/lib/product-rules";
import {
  conversationStateSchema,
  scenePlanSchema,
  type ConversationState,
} from "@/lib/validation/conversation";
import {
  createEpisodeResponseSchema,
  type CreateEpisodeRequest,
  type CreateEpisodeResponse,
} from "@/lib/validation/episode";

const DAY_MILLISECONDS = 24 * 60 * 60 * 1_000;

export class EpisodePersistenceError extends Error {
  constructor() {
    super("The conversation could not be persisted.");
    this.name = "EpisodePersistenceError";
  }
}

function createLearnerFirstPlan(input: {
  conversationId: string;
  request: CreateEpisodeRequest;
}) {
  const starter = buildLearnerStarter({
    conversationId: input.conversationId,
    conversationType: input.request.conversationType,
    context: input.request.context,
  });

  return scenePlanSchema.parse({
    openingMode: "learner_first",
    conversationType: input.request.conversationType,
    context: input.request.context,
    location: "Unspecified; the learner begins from their real life.",
    personalLifeAnchor:
      "The learner's first contribution establishes the personal topic.",
    whySofiaBringsItUpNow:
      "The learner chose this communication goal and life area.",
    initialEmotion: {
      kind: "curious",
      intensity: "low",
      cause: "Sofia is ready to listen without assuming what the learner will share.",
      evidenceMessageId: null,
    },
    sofiaImmediateGoal:
      "Listen to the learner, respond to their meaning, and help the conversation develop naturally.",
    privateFact: {
      fact: "No episode-specific private fact is established before the learner speaks.",
      relevanceCondition:
        "Do not reveal a preselected fact; Sofia may share one brief canon-compatible detail only when it genuinely relates.",
    },
    learnerOpportunity: `${starter.prompt} Possible starting points: ${starter.ideas.join("; ")}.`,
    stakes: {
      level: "low",
      description:
        "The learner can begin with an ordinary detail and decide how much to share.",
    },
    plausibleOutcomes: ["connection_reached", "perspective_clarified"],
    canonConstraints: [
      "Sofia is an established but unspecified friend who listens before relating the topic to her own life.",
    ],
    prohibitedInventions: [
      "Do not invent shared memories, romance, or facts about the learner.",
      "Do not pretend Sofia already introduced a personal story in this episode.",
    ],
    learnerVisibleScene: starter.prompt,
    sofiaOpeningText:
      "Sofia has not spoken yet because the learner begins this conversation.",
  });
}

export function toCreateEpisodeResponse(
  state: ConversationState,
): CreateEpisodeResponse {
  if (!state.scenePlan || state.scenePlan.openingMode !== "learner_first") {
    throw new Error("A new conversation requires a learner-first plan.");
  }

  return createEpisodeResponseSchema.parse({
    conversationId: state.conversationId,
    conversationType: state.conversationType,
    context: state.context,
    starter: buildLearnerStarter({
      conversationId: state.conversationId,
      conversationType: state.conversationType,
      context: state.context,
    }),
    episode: {
      status: state.status,
      acceptedResponseCount: state.acceptedResponseCount,
      maxAcceptedResponses: V1_RULES.maxAcceptedResponses,
      expectedSequence: state.expectedSequence,
      expiresAt: state.expiresAt,
    },
  });
}

export async function createEpisode(input: {
  sessionId: string;
  request: CreateEpisodeRequest;
  repository: Pick<ConversationRepository, "createConversation">;
  now?: Date;
  idFactory?: () => string;
}): Promise<CreateEpisodeResponse> {
  const now = input.now ?? new Date();
  if (Number.isNaN(now.getTime())) {
    throw new Error("Conversation creation requires a valid current time.");
  }

  const conversationId = (input.idFactory ?? randomUUID)();
  const createdAt = now.toISOString();
  const expiresAt = new Date(
    now.getTime() + SESSION_ACCESS_DAYS * DAY_MILLISECONDS,
  ).toISOString();
  const scenePlan = createLearnerFirstPlan({
    conversationId,
    request: input.request,
  });

  const state = conversationStateSchema.parse({
    schemaVersion: 2,
    conversationId,
    status: "active",
    terminationReason: null,
    outcomeCategory: null,
    conversationType: input.request.conversationType,
    context: input.request.context,
    scenePlan,
    stage: "opening",
    mode: "normal",
    acceptedResponseCount: 0,
    expectedSequence: 0,
    trust: {
      level: "comfortable",
      supportStreak: 0,
      lastChangeEvidenceIds: [],
    },
    emotion: scenePlan.initialEmotion,
    warningActive: false,
    warningEvidenceMessageId: null,
    topics: [],
    privateFactRevealed: false,
    evidenceEvents: [],
    messages: [],
    createdAt,
    updatedAt: createdAt,
    expiresAt,
  });

  try {
    const snapshot = await input.repository.createConversation({
      sessionId: input.sessionId,
      state,
    });
    return toCreateEpisodeResponse(snapshot.state);
  } catch {
    throw new EpisodePersistenceError();
  }
}
