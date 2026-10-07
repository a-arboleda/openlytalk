import { randomUUID } from "node:crypto";

import { config } from "dotenv";
import { eq } from "drizzle-orm";
import OpenAI from "openai";
import { afterAll, describe, expect, it } from "vitest";

import { processTurn } from "@/lib/conversation-engine/process-turn";
import { parseServerEnv } from "@/lib/env";
import {
  OpenAISpeechProvider,
  OpenAITranscriptionProvider,
} from "@/lib/openai/openai-audio-providers";
import { OpenAIConversationModel } from "@/lib/openai/openai-conversation-model";
import { createDatabase } from "@/lib/persistence/postgres/database";
import { DrizzleConversationRepository } from "@/lib/persistence/postgres/drizzle-conversation-repository";
import { anonymousSessions } from "@/lib/persistence/postgres/schema";
import { resolveAnonymousSession } from "@/lib/session/anonymous-session";
import { conversationStateSchema } from "@/lib/validation/conversation";

config({ path: ".env.local", quiet: true });

const enabled =
  process.env.RUN_LIVE_OPENAI_TESTS === "1" &&
  Boolean(process.env.DATABASE_URL) &&
  Boolean(process.env.OPENAI_API_KEY);
const describeLive = enabled ? describe : describe.skip;
const database = enabled
  ? createDatabase(process.env.DATABASE_URL as string)
  : undefined;

afterAll(async () => {
  await database?.$client.end();
});

describeLive("live OpenAI audio turn", () => {
  it(
    "transcribes one spoken response, commits Sofia's turn, and synthesizes playback",
    async () => {
      if (!database) throw new Error("Live test configuration is missing.");
      const env = parseServerEnv();
      if (!env.OPENAI_API_KEY) throw new Error("OpenAI test key is missing.");
      const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
      const repository = new DrizzleConversationRepository(database);
      const transcription = new OpenAITranscriptionProvider(
        client,
        env.OPENAI_TRANSCRIPTION_MODEL,
      );
      const speech = new OpenAISpeechProvider(
        client,
        env.OPENAI_TTS_MODEL,
        env.OPENAI_TTS_VOICE,
      );
      const model = new OpenAIConversationModel(
        client,
        env.OPENAI_TURN_MODEL,
      );
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
        const conversationId = randomUUID();
        const state = conversationStateSchema.parse({
          schemaVersion: 2,
          conversationId,
          status: "active",
          terminationReason: null,
          outcomeCategory: null,
          conversationType: "Expressing Yourself",
          context: "Life Moments",
          scenePlan: {
            openingMode: "learner_first",
            conversationType: "Expressing Yourself",
            context: "Life Moments",
            personalLifeAnchor:
              "The learner's first contribution establishes the personal topic.",
            location: "Unspecified; the learner begins from their real life.",
            whySofiaBringsItUpNow:
              "The learner chose to express a genuine point of view.",
            initialEmotion: {
              kind: "curious",
              intensity: "low",
              cause: "Sofia is ready to listen without making assumptions.",
              evidenceMessageId: null,
            },
            sofiaImmediateGoal:
              "Respond to the learner's meaning and help the conversation develop naturally.",
            privateFact: {
              fact: "No episode-specific private fact exists before the learner speaks.",
              relevanceCondition: "Do not reveal a preselected fact.",
            },
            learnerOpportunity:
              "Tell Sofia what you think about a belief, social question, or current topic.",
            stakes: {
              level: "low",
              description: "The learner decides how much they want to share.",
            },
            plausibleOutcomes: ["connection_reached", "perspective_clarified"],
            canonConstraints: ["Sofia is an established but unspecified friend."],
            prohibitedInventions: ["Do not invent romance or shared memories."],
            learnerVisibleScene:
              "Tell Sofia what you think about an idea, situation, or current topic. Start with your honest reaction.",
            sofiaOpeningText:
              "Sofia has not spoken yet because the learner begins this conversation.",
          },
          stage: "opening",
          mode: "normal",
          acceptedResponseCount: 0,
          expectedSequence: 0,
          trust: {
            level: "comfortable",
            supportStreak: 0,
            lastChangeEvidenceIds: [],
          },
          emotion: {
            kind: "curious",
            intensity: "low",
            cause: "Sofia is ready to listen without making assumptions.",
            evidenceMessageId: null,
          },
          warningActive: false,
          warningEvidenceMessageId: null,
          topics: [],
          privateFactRevealed: false,
          evidenceEvents: [],
          messages: [],
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          expiresAt: new Date(now.getTime() + 7 * 86_400_000).toISOString(),
        });
        await repository.createConversation({ sessionId, state });

        const learnerAudio = await speech.synthesize({
          messageId: randomUUID(),
          text: "I think social media makes people compare their lives too much. It can connect us, but sometimes it also makes ordinary life feel inadequate.",
          voice: "sofia",
          format: "mp3",
        });
        const result = await processTurn({
          sessionId,
          conversationId,
          idempotencyKey: randomUUID(),
          expectedSequence: 0,
          audio: learnerAudio.audio,
          mimeType: learnerAudio.contentType,
          repository,
          transcription,
          model,
        });

        expect(result.episode).toMatchObject({
          status: "active",
          acceptedResponseCount: 1,
          expectedSequence: 2,
        });
        expect(result.learner.text.toLowerCase()).toContain("social media");
        expect(result.sofia.text.split(/\s+/).length).toBeGreaterThanOrEqual(8);
        const questionCount = result.sofia.text.match(/\?/g)?.length ?? 0;
        expect(questionCount).toBeLessThanOrEqual(1);
        if (questionCount === 1) {
          expect(result.sofia.text.trim().endsWith("?")).toBe(true);
        }

        const sofiaAudio = await speech.synthesize({
          messageId: result.sofia.messageId,
          text: result.sofia.text,
          voice: "sofia",
          format: "mp3",
        });
        expect(sofiaAudio.audio.byteLength).toBeGreaterThan(1_000);
      } finally {
        if (sessionId) {
          await database
            .delete(anonymousSessions)
            .where(eq(anonymousSessions.id, sessionId));
        }
      }
    },
    120_000,
  );
});
