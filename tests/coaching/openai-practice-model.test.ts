import OpenAI from "openai";
import { describe, expect, it } from "vitest";

import { buildDeterministicPracticePlan } from "@/lib/coaching/plan-builder";
import { getPracticeProviderConfig } from "@/lib/coaching/provider-config";
import { practiceSetupSchema } from "@/lib/coaching/schemas";
import { OpenAIPracticeModel } from "@/lib/openai/openai-practice-model";

describe("OpenAI practice model", () => {
  it("uses parsed structured Responses with the configured fast plan model", async () => {
    const setup = practiceSetupSchema.parse({
      primarySkill: "responding_naturally",
      context: "job_interviews",
      targetBehavior: "ask_natural_follow_up",
      targetBehaviors: ["ask_natural_follow_up"],
      situationMode: "choose_for_me",
    });
    const plan = buildDeterministicPracticePlan(setup);
    const requests: unknown[] = [];
    const client = {
      responses: {
        parse: async (request: unknown) => {
          requests.push(request);
          return { output_parsed: plan };
        },
      },
    } as unknown as OpenAI;
    const config = getPracticeProviderConfig({ NODE_ENV: "test" });
    const model = new OpenAIPracticeModel(client, config);

    await expect(
      model.generatePlan({
        setup,
        repairAttempt: false,
        scenarioVariation: {
          seed: "practice-seed",
          recentlyUsedSituations: [],
        },
      }),
    ).resolves.toEqual(plan);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      model: "gpt-5.6-luna",
      reasoning: { effort: "none" },
      store: false,
      text: {
        verbosity: "low",
      },
    });
  });
});
