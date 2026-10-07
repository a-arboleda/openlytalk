import { randomUUID } from "node:crypto";

import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { buildDeterministicPracticePlan } from "@/lib/coaching/plan-builder";
import {
  practiceSessionStateSchema,
  type PracticeMessage,
  type PracticeSessionState,
} from "@/lib/coaching/schemas";
import { requestPracticeHelp } from "@/lib/coaching/request-practice-help";
import { startPracticeSession } from "@/lib/coaching/start-practice-session";
import { createDatabase } from "@/lib/persistence/postgres/database";
import { DrizzlePracticeRepository } from "@/lib/persistence/postgres/drizzle-practice-repository";
import { anonymousSessions } from "@/lib/persistence/postgres/schema";

config({ path: ".env.local", quiet: true });

const runDatabaseTests =
  process.env.RUN_DATABASE_TESTS === "1" &&
  Boolean(process.env.DATABASE_URL);
const describeDatabase = runDatabaseTests ? describe : describe.skip;
const database = runDatabaseTests
  ? createDatabase(process.env.DATABASE_URL as string)
  : undefined;

afterAll(async () => {
  await database?.$client.end();
});

function initialPracticeState(input: {
  anonymousSessionId: string;
  practiceSessionId: string;
  createdAt: string;
  expiresAt: string;
}): PracticeSessionState {
  const setup = {
    primarySkill: "speaking_assertively",
    supportingSkill: "explaining_clearly",
    context: "work",
    targetBehavior: "make_clear_request",
    targetBehaviors: ["make_clear_request"],
    desiredImpression: "direct_respectful",
    situationMode: "choose_for_me",
  } as const;

  return practiceSessionStateSchema.parse({
    schemaVersion: 3,
    practiceSessionId: input.practiceSessionId,
    anonymousSessionId: input.anonymousSessionId,
    status: "active",
    phase: "initial_simulation",
    setup,
    plan: buildDeterministicPracticePlan(setup),
    acceptedResponseCount: 0,
    expectedLearnerSequence: 0,
    messages: [],
    evidenceEvents: [],
    helpEvents: [],
    challengeState: {
      introduced: false,
      resolved: false,
      evidenceMessageIds: [],
    },
    coachingBreak: null,
    retryTarget: null,
    retryOutcome: null,
    takeaway: null,
    terminationReason: null,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    expiresAt: input.expiresAt,
  });
}

describeDatabase("Drizzle practice repository", () => {
  it(
    "resumes across repository instances, reports expiry, and deletes by owner",
    async () => {
      if (!database) {
        throw new Error("Database test configuration is missing.");
      }
      const anonymousSessionId = randomUUID();
      const practiceSessionId = randomUUID();
      const now = new Date();
      const createdAt = now.toISOString();
      const expiresAt = new Date(now.getTime() + 60_000).toISOString();
      const state = initialPracticeState({
        anonymousSessionId,
        practiceSessionId,
        createdAt,
        expiresAt,
      });

      try {
        const writer = new DrizzlePracticeRepository(database);
        await writer.createSession({
          id: anonymousSessionId,
          createdAt,
          expiresAt,
        });
        await writer.createPracticeSession({
          anonymousSessionId,
          state,
        });
        expect(
          await writer.listRecentPracticeSituations({
            anonymousSessionId,
            setup: state.setup,
            now: createdAt,
            limit: 5,
          }),
        ).toEqual([state.plan.situation]);

        const resumed = new DrizzlePracticeRepository(database);
        expect(
          await resumed.lookupPracticeSession({
            anonymousSessionId,
            practiceSessionId,
            now: new Date(now.getTime() + 1_000).toISOString(),
          }),
        ).toMatchObject({
          kind: "found",
          snapshot: { state: { practiceSessionId } },
        });
        expect(
          await resumed.lookupPracticeSession({
            anonymousSessionId: randomUUID(),
            practiceSessionId,
            now: createdAt,
          }),
        ).toEqual({ kind: "not_found" });
        expect(
          await resumed.lookupPracticeSession({
            anonymousSessionId,
            practiceSessionId,
            now: expiresAt,
          }),
        ).toEqual({ kind: "expired" });
        expect(
          await resumed.deletePracticeSession({
            anonymousSessionId,
            practiceSessionId,
          }),
        ).toBe(true);
        expect(
          await resumed.lookupPracticeSession({
            anonymousSessionId,
            practiceSessionId,
            now: createdAt,
          }),
        ).toEqual({ kind: "not_found" });
      } finally {
        await database
          .delete(anonymousSessions)
          .where(eq(anonymousSessions.id, anonymousSessionId));
      }
    },
    30_000,
  );

  it(
    "persists a partner-first opening atomically when practice starts",
    async () => {
      if (!database) {
        throw new Error("Database test configuration is missing.");
      }
      const repository = new DrizzlePracticeRepository(database);
      const anonymousSessionId = randomUUID();
      const practiceSessionId = randomUUID();
      const messageId = randomUUID();
      const now = new Date();
      const createdAt = now.toISOString();
      const expiresAt = new Date(
        now.getTime() + 7 * 24 * 60 * 60 * 1_000,
      ).toISOString();
      const setup = {
        primarySkill: "responding_naturally",
        supportingSkill: null,
        context: "job_interviews",
        targetBehavior: "ask_natural_follow_up",
        targetBehaviors: ["ask_natural_follow_up"],
        desiredImpression: "professional_prepared",
        situationMode: "choose_for_me",
        situationDetail: null,
      } as const;
      const plan = buildDeterministicPracticePlan(setup);
      const briefing = practiceSessionStateSchema.parse({
        ...initialPracticeState({
          anonymousSessionId,
          practiceSessionId,
          createdAt,
          expiresAt,
        }),
        phase: "briefing",
        setup,
        plan,
      });

      try {
        await repository.createSession({
          id: anonymousSessionId,
          createdAt,
          expiresAt,
        });
        await repository.createPracticeSession({
          anonymousSessionId,
          state: briefing,
        });
        const started = await startPracticeSession({
          anonymousSessionId,
          practiceSessionId,
          expectedUpdatedAt: createdAt,
          repository,
          now: new Date(now.getTime() + 1_000),
          idFactory: () => messageId,
        });
        const loaded = await repository.getPracticeSession({
          anonymousSessionId,
          practiceSessionId,
          now: new Date(now.getTime() + 2_000).toISOString(),
        });

        expect(started.messages).toHaveLength(1);
        expect(loaded?.state.messages).toEqual(started.messages);
        expect(loaded?.state.messages[0]).toMatchObject({
          id: messageId,
          role: "partner",
          text: plan.opening.partnerOpeningText,
        });
      } finally {
        await database
          .delete(anonymousSessions)
          .where(eq(anonymousSessions.id, anonymousSessionId));
      }
    },
    30_000,
  );

  it(
    "protects ownership and commits an idempotent practice turn atomically",
    async () => {
      if (!database) {
        throw new Error("Database test configuration is missing.");
      }
      const repository = new DrizzlePracticeRepository(database);
      const anonymousSessionId = randomUUID();
      const practiceSessionId = randomUUID();
      const now = new Date();
      const createdAt = now.toISOString();
      const expiresAt = new Date(
        now.getTime() + 7 * 24 * 60 * 60 * 1_000,
      ).toISOString();

      try {
        await repository.createSession({
          id: anonymousSessionId,
          createdAt,
          expiresAt,
        });
        const state = initialPracticeState({
          anonymousSessionId,
          practiceSessionId,
          createdAt,
          expiresAt,
        });
        await repository.createPracticeSession({
          anonymousSessionId,
          state,
        });

        expect(
          await repository.getPracticeSession({
            anonymousSessionId: randomUUID(),
            practiceSessionId,
            now: createdAt,
          }),
        ).toBeNull();

        const reservation = await repository.beginPracticeTurn({
          anonymousSessionId,
          practiceSessionId,
          idempotencyKey: "postgres-practice-turn-1",
          expectedLearnerSequence: 0,
          now: createdAt,
        });
        expect(reservation.kind).toBe("ready");
        if (reservation.kind !== "ready") {
          throw new Error("Expected a ready practice reservation.");
        }

        const turnTime = new Date(now.getTime() + 1_000).toISOString();
        const acceptedMessages: PracticeMessage[] = [
          {
            id: randomUUID(),
            role: "learner",
            phase: "initial_simulation",
            learnerResponseNumber: 1,
            sequence: 0,
            text: "Could we decide which task should come first?",
            createdAt: turnTime,
          },
          {
            id: randomUUID(),
            role: "partner",
            phase: "initial_simulation",
            learnerResponseNumber: null,
            sequence: 1,
            text: "Why can’t you choose the priority yourself?",
            createdAt: turnTime,
          },
        ];
        const nextState = practiceSessionStateSchema.parse({
          ...state,
          acceptedResponseCount: 1,
          expectedLearnerSequence: 1,
          messages: acceptedMessages,
          updatedAt: turnTime,
        });
        const commitInput = {
          anonymousSessionId,
          practiceSessionId,
          reservationId: reservation.reservationId,
          idempotencyKey: "postgres-practice-turn-1",
          expectedLearnerSequence: 0,
          acceptedMessages,
          nextState,
        };

        expect(
          await repository.commitPracticeTurn(commitInput),
        ).toMatchObject({ kind: "committed" });
        expect(
          await repository.commitPracticeTurn(commitInput),
        ).toMatchObject({ kind: "duplicate" });
        expect(
          (
            await repository.getPracticeSession({
              anonymousSessionId,
              practiceSessionId,
              now: turnTime,
            })
          )?.state,
        ).toMatchObject({
          acceptedResponseCount: 1,
          expectedLearnerSequence: 1,
          messages: acceptedMessages,
        });
      } finally {
        await database
          .delete(anonymousSessions)
          .where(eq(anonymousSessions.id, anonymousSessionId));
      }
    },
    30_000,
  );

  it(
    "persists only help metadata without advancing the learner turn",
    async () => {
      if (!database) {
        throw new Error("Database test configuration is missing.");
      }
      const repository = new DrizzlePracticeRepository(database);
      const anonymousSessionId = randomUUID();
      const practiceSessionId = randomUUID();
      const helpEventId = randomUUID();
      const now = new Date();
      const createdAt = now.toISOString();
      const expiresAt = new Date(
        now.getTime() + 7 * 24 * 60 * 60 * 1_000,
      ).toISOString();
      const state = initialPracticeState({
        anonymousSessionId,
        practiceSessionId,
        createdAt,
        expiresAt,
      });
      const coachText =
        "You could start with: “The main issue is…” Then continue in your own words.";

      try {
        await repository.createSession({
          id: anonymousSessionId,
          createdAt,
          expiresAt,
        });
        await repository.createPracticeSession({
          anonymousSessionId,
          state,
        });
        const result = await requestPracticeHelp({
          anonymousSessionId,
          practiceSessionId,
          type: "starting_phrase",
          currentPartnerMessageId: null,
          expectedLearnerSequence: 0,
          expectedUpdatedAt: createdAt,
          repository,
          model: {
            generateHelp: async () => ({
              type: "starting_phrase",
              coachText,
              resumesPhase: "initial_simulation",
              relatedPartnerMessageId: null,
            }),
          },
          now: new Date(now.getTime() + 1_000),
          idFactory: () => helpEventId,
        });
        const loaded = await repository.getPracticeSession({
          anonymousSessionId,
          practiceSessionId,
          now: new Date(now.getTime() + 2_000).toISOString(),
        });

        expect(result.help.coachText).toBe(coachText);
        expect(loaded?.state).toMatchObject({
          acceptedResponseCount: 0,
          expectedLearnerSequence: 0,
          messages: [],
          helpEvents: [
            {
              id: helpEventId,
              type: "starting_phrase",
              relatedPartnerMessageId: null,
            },
          ],
        });
        expect(JSON.stringify(loaded?.state)).not.toContain(coachText);
      } finally {
        await database
          .delete(anonymousSessions)
          .where(eq(anonymousSessions.id, anonymousSessionId));
      }
    },
    30_000,
  );
});
