import { describe, expect, it } from "vitest";

import {
  createPracticeSession,
  substantiallySameSituation,
} from "@/lib/coaching/create-practice-session";
import { buildDeterministicPracticePlan } from "@/lib/coaching/plan-builder";
import type { GeneratePracticePlanRequest } from "@/lib/coaching/provider-contracts";
import { practiceSetupSchema } from "@/lib/coaching/schemas";
import { InMemoryPracticeRepository } from "@/lib/persistence/in-memory-practice-repository";

const OWNER_ID = "10000000-0000-4000-8000-000000000001";
const PRACTICE_ID = "20000000-0000-4000-8000-000000000001";
const SECOND_PRACTICE_ID = "20000000-0000-4000-8000-000000000002";
const CREATED_AT = "2026-07-27T12:00:00.000Z";
const OWNER_EXPIRES_AT = "2026-08-10T12:00:00.000Z";

const setup = practiceSetupSchema.parse({
  primarySkill: "speaking_assertively",
  supportingSkill: "explaining_clearly",
  context: "work",
  targetBehavior: "make_clear_request",
  targetBehaviors: ["make_clear_request"],
  desiredImpression: "direct_respectful",
  situationMode: "choose_for_me",
});

const respondingSetup = practiceSetupSchema.parse({
  primarySkill: "responding_naturally",
  supportingSkill: null,
  context: "work",
  targetBehavior: "give_natural_first_reaction",
  targetBehaviors: ["give_natural_first_reaction"],
  desiredImpression: null,
  situationMode: "choose_for_me",
});

class QueuedPlanModel {
  readonly calls: GeneratePracticePlanRequest[] = [];

  constructor(private readonly outputs: unknown[]) {}

  async generatePlan(request: GeneratePracticePlanRequest): Promise<unknown> {
    this.calls.push(request);
    const output = this.outputs.shift();
    if (output instanceof Error) throw output;
    return output;
  }
}

async function readyRepository() {
  const repository = new InMemoryPracticeRepository();
  await repository.createSession({
    id: OWNER_ID,
    createdAt: CREATED_AT,
    expiresAt: OWNER_EXPIRES_AT,
  });
  return repository;
}

describe("practice-session creation", () => {
  it("recognizes a lightly reworded recent situation", () => {
    expect(
      substantiallySameSituation(
        "You and a friend are making a weekend plan, but the timing is unclear.",
        "You are making weekend plans with a friend and need to decide the time.",
      ),
    ).toBe(true);
    expect(
      substantiallySameSituation(
        "You and a friend are making a weekend plan.",
        "A neighbor asks about a package delivered to the wrong apartment.",
      ),
    ).toBe(false);
  });

  it("persists a valid adaptive plan in a private briefing state", async () => {
    const repository = await readyRepository();
    const adaptivePlan = {
      ...buildDeterministicPracticePlan(setup),
      sessionGoal:
        "Ask for one clear priority while sounding direct and respectful.",
    };
    const model = new QueuedPlanModel([adaptivePlan]);

    const result = await createPracticeSession({
      anonymousSessionId: OWNER_ID,
      setup,
      model,
      repository,
      now: new Date(CREATED_AT),
      idFactory: () => PRACTICE_ID,
    });

    expect(result.planSource).toBe("model");
    expect(result.state).toMatchObject({
      schemaVersion: 5,
      practiceSessionId: PRACTICE_ID,
      anonymousSessionId: OWNER_ID,
      status: "active",
      phase: "briefing",
      acceptedResponseCount: 0,
      responseLimit: 2,
      expectedLearnerSequence: 0,
      messages: [],
      coachingBreak: null,
      takeaway: null,
      expiresAt: "2026-08-01T12:00:00.000Z",
    });
    expect(result.state.plan.sessionGoal).toBe(adaptivePlan.sessionGoal);
    expect(model.calls).toEqual([
      {
        setup,
        repairAttempt: false,
        scenarioVariation: {
          seed: PRACTICE_ID,
          recentlyUsedSituations: [],
        },
      },
    ]);
    expect(
      (
        await repository.getPracticeSession({
          anonymousSessionId: OWNER_ID,
          practiceSessionId: PRACTICE_ID,
          now: CREATED_AT,
        })
      )?.state.plan.sessionGoal,
    ).toBe(adaptivePlan.sessionGoal);
  });

  it("creates a one-response text-prompt practice without changing retained sessions", async () => {
    const repository = await readyRepository();
    const promptPlan = buildDeterministicPracticePlan(setup, {
      singlePrompt: true,
      variationSeed: PRACTICE_ID,
    });
    const model = new QueuedPlanModel([promptPlan]);

    const result = await createPracticeSession({
      anonymousSessionId: OWNER_ID,
      setup,
      model,
      repository,
      practiceFormat: "single_prompt",
      now: new Date(CREATED_AT),
      idFactory: () => PRACTICE_ID,
    });

    expect(result.state).toMatchObject({
      schemaVersion: 6,
      phase: "briefing",
      responseLimit: 1,
      acceptedResponseCount: 0,
    });
    expect(result.state.plan.opening.partnerOpeningText).toBeTruthy();
    expect(model.calls[0]).toMatchObject({
      practiceFormat: "single_prompt",
    });
  });

  it("accepts a responding-naturally prompt that ends without a question", async () => {
    const repository = await readyRepository();
    const reactionPlan = buildDeterministicPracticePlan(respondingSetup, {
      singlePrompt: true,
      variationSeed: PRACTICE_ID,
    });
    const model = new QueuedPlanModel([reactionPlan]);

    const result = await createPracticeSession({
      anonymousSessionId: OWNER_ID,
      setup: respondingSetup,
      model,
      repository,
      practiceFormat: "single_prompt",
      now: new Date(CREATED_AT),
      idFactory: () => PRACTICE_ID,
    });

    expect(result.planSource).toBe("model");
    expect(result.state.plan.opening.partnerOpeningText).not.toContain("?");
  });

  it("repairs a responding-naturally prompt that asks the learner a question", async () => {
    const repository = await readyRepository();
    const validPlan = buildDeterministicPracticePlan(respondingSetup, {
      singlePrompt: true,
      variationSeed: PRACTICE_ID,
    });
    const questionPlan = {
      ...validPlan,
      opening: {
        ...validPlan.opening,
        partnerOpeningText:
          "A coworker gave me unexpected feedback today. I needed time to think about it. How would you react?",
      },
    };
    const model = new QueuedPlanModel([questionPlan, validPlan]);

    const result = await createPracticeSession({
      anonymousSessionId: OWNER_ID,
      setup: respondingSetup,
      model,
      repository,
      practiceFormat: "single_prompt",
      now: new Date(CREATED_AT),
      idFactory: () => PRACTICE_ID,
    });

    expect(result.planSource).toBe("model_repair");
    expect(model.calls.map((call) => call.repairAttempt)).toEqual([
      false,
      true,
    ]);
    expect(result.state.plan.opening.partnerOpeningText).not.toContain("?");
  });

  it("repairs a single prompt that starts as a bare exercise question", async () => {
    const repository = await readyRepository();
    const validPlan = buildDeterministicPracticePlan(setup, {
      singlePrompt: true,
      variationSeed: PRACTICE_ID,
    });
    const bareQuestionPlan = {
      ...validPlan,
      opening: {
        ...validPlan.opening,
        partnerOpeningText: "What would you say matters most to you right now?",
      },
    };
    const model = new QueuedPlanModel([bareQuestionPlan, validPlan]);

    const result = await createPracticeSession({
      anonymousSessionId: OWNER_ID,
      setup,
      model,
      repository,
      practiceFormat: "single_prompt",
      now: new Date(CREATED_AT),
      idFactory: () => PRACTICE_ID,
    });

    expect(result.planSource).toBe("model_repair");
    expect(model.calls.map((call) => call.repairAttempt)).toEqual([
      false,
      true,
    ]);
    expect(result.state.plan.opening.partnerOpeningText).not.toBe(
      bareQuestionPlan.opening.partnerOpeningText,
    );
    expect(result.state.plan.opening.partnerOpeningText).toMatch(
      /[.!]\s+\S/,
    );
  });

  it("repairs a single prompt that relies on an unintroduced comparison", async () => {
    const repository = await readyRepository();
    const validPlan = buildDeterministicPracticePlan(setup, {
      singlePrompt: true,
      variationSeed: PRACTICE_ID,
    });
    const confusingPlan = {
      ...validPlan,
      opening: {
        ...validPlan.opening,
        partnerOpeningText:
          "I helped assemble a similar shelf last week, and checking the holes helped. Your shelf has one part that will not fit. What should happen next?",
      },
    };
    const model = new QueuedPlanModel([confusingPlan, validPlan]);

    const result = await createPracticeSession({
      anonymousSessionId: OWNER_ID,
      setup,
      model,
      repository,
      practiceFormat: "single_prompt",
      now: new Date(CREATED_AT),
      idFactory: () => PRACTICE_ID,
    });

    expect(result.planSource).toBe("model_repair");
    expect(model.calls.map((call) => call.repairAttempt)).toEqual([
      false,
      true,
    ]);
    expect(result.state.plan.opening.partnerOpeningText).not.toContain(
      "similar shelf",
    );
  });

  it("repairs a prompt that asks the learner to diagnose an invented object problem", async () => {
    const repository = await readyRepository();
    const validPlan = buildDeterministicPracticePlan(setup, {
      singlePrompt: true,
      variationSeed: PRACTICE_ID,
    });
    const diagnosticPlan = {
      ...validPlan,
      opening: {
        ...validPlan.opening,
        partnerOpeningText:
          "One part of this shelf will not fit even though the others do. What do you think caused it?",
      },
    };
    const model = new QueuedPlanModel([diagnosticPlan, validPlan]);

    const result = await createPracticeSession({
      anonymousSessionId: OWNER_ID,
      setup,
      model,
      repository,
      practiceFormat: "single_prompt",
      now: new Date(CREATED_AT),
      idFactory: () => PRACTICE_ID,
    });

    expect(result.planSource).toBe("model_repair");
    expect(model.calls.map((call) => call.repairAttempt)).toEqual([
      false,
      true,
    ]);
    expect(result.state.plan.opening.partnerOpeningText).not.toContain(
      "caused it",
    );
  });

  it("makes one narrow repair attempt after invalid model output", async () => {
    const repository = await readyRepository();
    const repairedPlan = buildDeterministicPracticePlan(setup);
    const model = new QueuedPlanModel([
      { schemaVersion: 1 },
      repairedPlan,
    ]);

    const result = await createPracticeSession({
      anonymousSessionId: OWNER_ID,
      setup,
      model,
      repository,
      now: new Date(CREATED_AT),
      idFactory: () => PRACTICE_ID,
    });

    expect(result.planSource).toBe("model_repair");
    expect(model.calls.map((call) => call.repairAttempt)).toEqual([
      false,
      true,
    ]);
  });

  it("repairs a plan whose facts do not say who owns the experience", async () => {
    const repository = await readyRepository();
    const validPlan = buildDeterministicPracticePlan(setup);
    const ambiguousPlan = {
      ...validPlan,
      partner: {
        ...validPlan.partner,
        knownFacts: ["They visited the market."],
        unknownFacts: ["What they enjoyed most."],
      },
    };
    const model = new QueuedPlanModel([ambiguousPlan, validPlan]);

    const result = await createPracticeSession({
      anonymousSessionId: OWNER_ID,
      setup,
      model,
      repository,
      now: new Date(CREATED_AT),
      idFactory: () => PRACTICE_ID,
    });

    expect(result.planSource).toBe("model_repair");
    expect(model.calls.map((call) => call.repairAttempt)).toEqual([
      false,
      true,
    ]);
  });

  it("repairs a generated situation that calls the user the learner", async () => {
    const repository = await readyRepository();
    const validPlan = buildDeterministicPracticePlan(setup);
    const thirdPersonPlan = {
      ...validPlan,
      situation:
        "You and your coworker disagree about priorities; the learner prefers the client request.",
    };
    const model = new QueuedPlanModel([thirdPersonPlan, validPlan]);

    const result = await createPracticeSession({
      anonymousSessionId: OWNER_ID,
      setup,
      model,
      repository,
      now: new Date(CREATED_AT),
      idFactory: () => PRACTICE_ID,
    });

    expect(result.planSource).toBe("model_repair");
    expect(result.state.plan.situation).toBe(validPlan.situation);
    expect(model.calls.map((call) => call.repairAttempt)).toEqual([
      false,
      true,
    ]);
  });

  it("repairs a generated plan that does not let the partner open naturally", async () => {
    const repository = await readyRepository();
    const validPlan = buildDeterministicPracticePlan(setup);
    const learnerFirstPlan = {
      ...validPlan,
      opening: {
        ...validPlan.opening,
        speaker: "learner" as const,
        partnerOpeningText: null,
      },
    };
    const model = new QueuedPlanModel([learnerFirstPlan, validPlan]);

    const result = await createPracticeSession({
      anonymousSessionId: OWNER_ID,
      setup,
      model,
      repository,
      now: new Date(CREATED_AT),
      idFactory: () => PRACTICE_ID,
    });

    expect(result.planSource).toBe("model_repair");
    expect(result.state.plan.opening.speaker).toBe("partner");
    expect(result.state.plan.opening.partnerOpeningText).toContain("?");
  });

  it("rejects a generated setup mismatch and uses the validated fallback", async () => {
    const repository = await readyRepository();
    const mismatchedPlan = buildDeterministicPracticePlan({
      ...setup,
      practiceArea: "personal_life",
      context: "everyday_situations",
    });
    const model = new QueuedPlanModel([
      mismatchedPlan,
      { still: "invalid" },
    ]);

    const result = await createPracticeSession({
      anonymousSessionId: OWNER_ID,
      setup,
      model,
      repository,
      now: new Date(CREATED_AT),
      idFactory: () => PRACTICE_ID,
    });

    expect(result.planSource).toBe("deterministic_fallback");
    expect(result.state.plan.setup).toEqual(setup);
    expect(result.state.plan.situation).toContain("coworker");
    expect(model.calls).toHaveLength(2);
  });

  it("falls back after bounded provider failures without persisting bad output", async () => {
    const repository = await readyRepository();
    const model = new QueuedPlanModel([
      new Error("provider unavailable"),
      null,
    ]);

    const result = await createPracticeSession({
      anonymousSessionId: OWNER_ID,
      setup,
      model,
      repository,
      now: new Date(CREATED_AT),
      idFactory: () => PRACTICE_ID,
    });
    const persisted = await repository.getPracticeSession({
      anonymousSessionId: OWNER_ID,
      practiceSessionId: PRACTICE_ID,
      now: CREATED_AT,
    });

    expect(result.planSource).toBe("deterministic_fallback");
    expect(result.state.plan.technique.familyId).toBe(
      "observation_impact_request",
    );
    expect(persisted?.state.plan).toEqual(result.state.plan);
  });

  it("rejects a recently used situation and rotates the fallback", async () => {
    const repository = await readyRepository();
    const repeatedPlan = buildDeterministicPracticePlan(setup);
    await createPracticeSession({
      anonymousSessionId: OWNER_ID,
      setup,
      model: new QueuedPlanModel([repeatedPlan]),
      repository,
      now: new Date(CREATED_AT),
      idFactory: () => PRACTICE_ID,
    });
    const model = new QueuedPlanModel([repeatedPlan, repeatedPlan]);

    const second = await createPracticeSession({
      anonymousSessionId: OWNER_ID,
      setup,
      model,
      repository,
      now: new Date("2026-07-27T12:01:00.000Z"),
      idFactory: () => SECOND_PRACTICE_ID,
    });

    expect(second.planSource).toBe("deterministic_fallback");
    expect(second.state.plan.situation).not.toBe(repeatedPlan.situation);
    expect(model.calls[0].scenarioVariation.recentlyUsedSituations).toEqual([
      repeatedPlan.situation,
    ]);
  });
});
