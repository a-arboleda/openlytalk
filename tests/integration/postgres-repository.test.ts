import { randomUUID } from "node:crypto";

import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { createEpisode } from "@/lib/conversation-engine/create-episode";
import { createDatabase } from "@/lib/persistence/postgres/database";
import { DrizzleConversationRepository } from "@/lib/persistence/postgres/drizzle-conversation-repository";
import { anonymousSessions } from "@/lib/persistence/postgres/schema";
import { resolveAnonymousSession } from "@/lib/session/anonymous-session";
import type {
  ConversationState,
  Emotion,
  ScenePlan,
  TranscriptMessage,
} from "@/lib/validation/conversation";
import type { Debrief } from "@/lib/validation/debrief";

config({ path: ".env.local", quiet: true });

const runDatabaseTests =
  process.env.RUN_DATABASE_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const describeDatabase = runDatabaseTests ? describe : describe.skip;
const database = runDatabaseTests
  ? createDatabase(process.env.DATABASE_URL as string)
  : undefined;

afterAll(async () => {
  await database?.$client.end();
});

function openingState(input: {
  conversationId: string;
  openingMessageId: string;
  createdAt: string;
  expiresAt: string;
}): ConversationState {
  const emotion: Emotion = {
    kind: "curious",
    intensity: "low",
    cause: "Sofia wants another perspective on a café layout.",
    evidenceMessageId: null,
  };
  const scenePlan: ScenePlan = {
    openingMode: "sofia_first",
    conversationType: "Sharing Experiences",
    context: "Daily Life",
    personalLifeAnchor:
      "Sofia remembers a café job that changed how she understands hospitality.",
    location: "A quiet street in Chicago",
    whySofiaBringsItUpNow:
      "She has been thinking about that experience while managing her current restaurant.",
    initialEmotion: emotion,
    sofiaImmediateGoal:
      "Share what the café job taught her and hear another view.",
    privateFact: {
      fact: "She nearly left the job during her first week.",
      relevanceCondition: "The learner asks how difficult the adjustment was.",
    },
    learnerOpportunity:
      "Respond to Sofia, then describe a related experience from your own life with one concrete detail.",
    stakes: {
      level: "low",
      description: "A personal work memory that still matters to Sofia.",
    },
    plausibleOutcomes: ["connection_reached", "perspective_clarified"],
    canonConstraints: ["Sofia manages a small restaurant but does not own it."],
    prohibitedInventions: ["Do not invent a romantic partner."],
    learnerVisibleScene:
      "You and Sofia are talking about her current work and her first café job abroad. Sofia says that a recent staffing question brought back the memory.",
    sofiaOpeningText:
      "My first café job abroad was much harder than I admitted. I kept acting confident because I did not want anyone to know how lost I felt. Have you ever tried to hide that kind of uncertainty?",
  };
  const openingMessage: TranscriptMessage = {
    id: input.openingMessageId,
    role: "sofia",
    sequence: 0,
    text: scenePlan.sofiaOpeningText,
    createdAt: input.createdAt,
  };

  return {
    schemaVersion: 2,
    conversationId: input.conversationId,
    status: "active",
    terminationReason: null,
    outcomeCategory: null,
    conversationType: scenePlan.conversationType,
    context: scenePlan.context,
    scenePlan,
    stage: "opening",
    mode: "normal",
    acceptedResponseCount: 0,
    expectedSequence: 1,
    trust: {
      level: "comfortable",
      supportStreak: 0,
      lastChangeEvidenceIds: [],
    },
    emotion,
    warningActive: false,
    warningEvidenceMessageId: null,
    topics: [],
    privateFactRevealed: false,
    evidenceEvents: [],
    messages: [openingMessage],
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    expiresAt: input.expiresAt,
  };
}

describeDatabase("Drizzle conversation repository", () => {
  it(
    "persists a learner-first opening through the episode-creation orchestrator",
    async () => {
      if (!database) throw new Error("Database test configuration is missing.");
      const repository = new DrizzleConversationRepository(database);
      const now = new Date();
      let sessionId: string | undefined;

      try {
        const session = await resolveAnonymousSession({
          cookieValue: undefined,
          repository,
          now,
          production: true,
        });
        sessionId = session.record.id;
        const created = await createEpisode({
          sessionId,
          request: {
            conversationType: "Sharing Experiences",
            context: "Daily Life",
          },
          repository,
          now,
        });

        const persisted = await repository.getConversation({
          sessionId,
          conversationId: created.conversationId,
          now: now.toISOString(),
        });
        expect(created.episode).toMatchObject({
          status: "active",
          acceptedResponseCount: 0,
          expectedSequence: 0,
        });
        expect(created.starter.ideas).toHaveLength(3);
        expect(persisted?.state.scenePlan).toMatchObject({
          openingMode: "learner_first",
          conversationType: "Sharing Experiences",
          context: "Daily Life",
        });
        expect(persisted?.state.messages).toEqual([]);
      } finally {
        if (sessionId) {
          await database
            .delete(anonymousSessions)
            .where(eq(anonymousSessions.id, sessionId));
        }
      }
    },
    30_000,
  );

  it(
    "protects ownership, ordering, reservation replay, and atomic turn commits",
    async () => {
      if (!database) throw new Error("Database test configuration is missing.");
      const repository = new DrizzleConversationRepository(database);
      let sessionId: string | undefined;

      try {
        const now = new Date();
        const session = await resolveAnonymousSession({
          cookieValue: undefined,
          repository,
          now,
          production: true,
        });
        sessionId = session.record.id;

        const renewed = await resolveAnonymousSession({
          cookieValue: sessionId,
          repository,
          now: new Date(now.getTime() + 1_000),
          production: true,
        });
        expect(renewed.created).toBe(false);
        expect(renewed.record.id).toBe(sessionId);

        const conversationId = randomUUID();
        const state = openingState({
          conversationId,
          openingMessageId: randomUUID(),
          createdAt: now.toISOString(),
          expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1_000).toISOString(),
        });
        await repository.createConversation({ sessionId, state });

        expect(
          await repository.getConversation({
            sessionId: randomUUID(),
            conversationId,
            now: now.toISOString(),
          }),
        ).toBeNull();

        const [first, concurrent] = await Promise.all([
          repository.beginTurn({
            sessionId,
            conversationId,
            idempotencyKey: "integration-turn-a",
            expectedSequence: 1,
            now: now.toISOString(),
          }),
          repository.beginTurn({
            sessionId,
            conversationId,
            idempotencyKey: "integration-turn-b",
            expectedSequence: 1,
            now: now.toISOString(),
          }),
        ]);

        const ready = [first, concurrent].find((result) => result.kind === "ready");
        const blocked = [first, concurrent].find(
          (result) => result.kind === "in_progress",
        );
        expect(ready?.kind).toBe("ready");
        expect(blocked?.kind).toBe("in_progress");
        if (!ready || ready.kind !== "ready") {
          throw new Error("Expected one ready reservation.");
        }

        const readyKey =
          first.kind === "ready" ? "integration-turn-a" : "integration-turn-b";
        await repository.releaseTurn({
          conversationId,
          reservationId: ready.reservationId,
          idempotencyKey: readyKey,
          reason: "provider_failure",
        });

        const retried = await repository.beginTurn({
          sessionId,
          conversationId,
          idempotencyKey: readyKey,
          expectedSequence: 1,
          now: new Date(now.getTime() + 2_000).toISOString(),
        });
        expect(retried.kind).toBe("ready");
        if (retried.kind !== "ready") {
          throw new Error("Expected the released reservation to be retryable.");
        }
        expect(retried.reservationId).not.toBe(ready.reservationId);

        const turnTime = new Date(now.getTime() + 3_000).toISOString();
        const learnerMessage: TranscriptMessage = {
          id: randomUUID(),
          role: "learner",
          sequence: 1,
          text: "Maybe the seats were too far apart, so the room felt cold.",
          createdAt: turnTime,
        };
        const sofiaMessage: TranscriptMessage = {
          id: randomUUID(),
          role: "sofia",
          sequence: 2,
          text: "Yes, exactly. It felt organized, but not very welcoming.",
          createdAt: turnTime,
        };
        const nextState: ConversationState = {
          ...retried.snapshot.state,
          stage: "developing",
          acceptedResponseCount: 1,
          expectedSequence: 3,
          trust: {
            ...retried.snapshot.state.trust,
            supportStreak: 1,
          },
          topics: ["café seating"],
          messages: [
            ...retried.snapshot.state.messages,
            learnerMessage,
            sofiaMessage,
          ],
          updatedAt: turnTime,
        };

        const committed = await repository.commitTurn({
          sessionId,
          conversationId,
          reservationId: retried.reservationId,
          idempotencyKey: readyKey,
          expectedSequence: 1,
          learnerMessage,
          sofiaMessage,
          nextState,
        });
        expect(committed.kind).toBe("committed");

        const duplicate = await repository.commitTurn({
          sessionId,
          conversationId,
          reservationId: retried.reservationId,
          idempotencyKey: readyKey,
          expectedSequence: 1,
          learnerMessage,
          sofiaMessage,
          nextState,
        });
        expect(duplicate.kind).toBe("duplicate");

        const replay = await repository.beginTurn({
          sessionId,
          conversationId,
          idempotencyKey: readyKey,
          expectedSequence: 1,
          now: new Date(now.getTime() + 4_000).toISOString(),
        });
        expect(replay.kind).toBe("committed");

        const snapshot = await repository.getConversation({
          sessionId,
          conversationId,
          now: new Date(now.getTime() + 4_000).toISOString(),
        });
        expect(snapshot?.state.acceptedResponseCount).toBe(1);
        expect(snapshot?.state.expectedSequence).toBe(3);
        expect(snapshot?.state.messages).toHaveLength(3);

        expect(
          await repository.deleteConversation({
            sessionId: randomUUID(),
            conversationId,
          }),
        ).toBe(false);
        expect(
          await repository.deleteConversation({ sessionId, conversationId }),
        ).toBe(true);
      } finally {
        if (sessionId) {
          await database
            .delete(anonymousSessions)
            .where(eq(anonymousSessions.id, sessionId));
        }
      }
    },
    30_000,
  );

  it(
    "ends an active conversation without consuming a response or deleting its transcript",
    async () => {
      if (!database) throw new Error("Database test configuration is missing.");
      const repository = new DrizzleConversationRepository(database);
      const sessionId = randomUUID();
      const conversationId = randomUUID();
      const now = new Date();
      const createdAt = now.toISOString();
      const expiresAt = new Date(
        now.getTime() + 7 * 24 * 60 * 60 * 1_000,
      ).toISOString();

      try {
        await repository.createSession({ id: sessionId, createdAt, expiresAt });
        const state = openingState({
          conversationId,
          openingMessageId: randomUUID(),
          createdAt,
          expiresAt,
        });
        await repository.createConversation({ sessionId, state });

        const endedAt = new Date(now.getTime() + 1_000).toISOString();
        const ended = await repository.endConversation({
          sessionId,
          conversationId,
          now: endedAt,
        });
        expect(ended.kind).toBe("ended");
        if (ended.kind !== "ended") {
          throw new Error("Expected the active conversation to end.");
        }
        expect(ended.state).toMatchObject({
          status: "ended",
          terminationReason: "user_exit",
          outcomeCategory: null,
          acceptedResponseCount: 0,
          expectedSequence: 1,
        });
        expect(ended.state.messages).toEqual(state.messages);

        const repeated = await repository.endConversation({
          sessionId,
          conversationId,
          now: new Date(now.getTime() + 2_000).toISOString(),
        });
        expect(repeated.kind).toBe("already_ended");

        const snapshot = await repository.getConversation({
          sessionId,
          conversationId,
          now: new Date(now.getTime() + 3_000).toISOString(),
        });
        expect(snapshot?.state.status).toBe("ended");
        expect(snapshot?.state.messages).toEqual(state.messages);
      } finally {
        await database
          .delete(anonymousSessions)
          .where(eq(anonymousSessions.id, sessionId));
      }
    },
    30_000,
  );

  it(
    "stores a debrief once and moves the conversation to completed",
    async () => {
      if (!database) throw new Error("Database test configuration is missing.");
      const repository = new DrizzleConversationRepository(database);
      const sessionId = randomUUID();
      const conversationId = randomUUID();
      const now = new Date();
      const createdAt = now.toISOString();
      const expiresAt = new Date(
        now.getTime() + 7 * 24 * 60 * 60 * 1_000,
      ).toISOString();

      try {
        await repository.createSession({
          id: sessionId,
          createdAt,
          expiresAt,
        });
        const state: ConversationState = {
          ...openingState({
            conversationId,
            openingMessageId: randomUUID(),
            createdAt,
            expiresAt,
          }),
          status: "debrief_pending",
          terminationReason: "meaningful_outcome",
          outcomeCategory: "connection_reached",
          stage: "closing",
          acceptedResponseCount: 4,
        };
        await repository.createConversation({ sessionId, state });

        const debrief: Debrief = {
          kind: "full",
          sectionOrder: [
            "Communication Insights",
            "English Improvements",
            "Retell the Conversation",
          ],
          communicationInsights: [
            {
              title: "You stayed with Sofia's meaning",
              observation:
                "You acknowledged her concern before offering your own perspective.",
              evidenceMessageIds: [state.messages[0].id],
            },
            {
              title: "You helped the conversation move",
              observation:
                "Your follow-up made space for Sofia to explain what mattered.",
              evidenceMessageIds: [state.messages[0].id],
            },
          ],
          englishImprovements: [],
          noHighValueEnglishImprovementMessage:
            "Your meaning was clear, and no high-value correction is needed.",
          retell: {
            prompt: "Explain what Sofia noticed and how you responded.",
            localOnly: true,
            evaluated: false,
          },
        };

        expect(
          await repository.saveDebrief({
            sessionId,
            conversationId,
            debrief,
          }),
        ).toEqual({ kind: "saved", debrief });
        expect(
          await repository.saveDebrief({
            sessionId,
            conversationId,
            debrief,
          }),
        ).toEqual({ kind: "existing", debrief });

        const snapshot = await repository.getConversation({
          sessionId,
          conversationId,
          now: createdAt,
        });
        expect(snapshot?.state.status).toBe("completed");
        expect(snapshot?.debrief).toEqual(debrief);
      } finally {
        await database
          .delete(anonymousSessions)
          .where(eq(anonymousSessions.id, sessionId));
      }
    },
    30_000,
  );
});
