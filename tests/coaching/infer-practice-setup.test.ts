import { describe, expect, it } from "vitest";

import { inferPracticeSetup } from "@/lib/coaching/infer-practice-setup";
import type { InferPracticeSetupRequest } from "@/lib/coaching/provider-contracts";

class SetupModel {
  readonly calls: InferPracticeSetupRequest[] = [];

  constructor(private readonly outputs: unknown[]) {}

  async inferSetup(request: InferPracticeSetupRequest): Promise<unknown> {
    this.calls.push(request);
    const output = this.outputs.shift();
    if (output instanceof Error) throw output;
    return output;
  }
}

describe("practice setup inference", () => {
  it("turns a valid interpretation into a canonical learner-provided setup", async () => {
    const model = new SetupModel([
      {
        primarySkill: "speaking_assertively",
        practiceArea: "work",
        context: "managers_feedback",
        targetBehaviors: ["make_clear_request"],
        desiredImpression: "direct_respectful",
      },
    ]);

    const setup = await inferPracticeSetup({
      background: "My manager gave me two urgent projects with the same deadline.",
      goal: "I want my manager to help me choose which project comes first.",
      model,
    });

    expect(setup).toMatchObject({
      primarySkill: "speaking_assertively",
      supportingSkill: null,
      practiceArea: "work",
      context: "managers_feedback",
      targetBehavior: "make_clear_request",
      targetBehaviors: ["make_clear_request"],
      desiredImpression: "direct_respectful",
      situationMode: "learner_provided",
    });
    expect(setup.situationDetail).toContain(
      "Situation: My manager gave me two urgent projects",
    );
    expect(setup.situationDetail).toContain(
      "Goal: I want my manager to help me choose",
    );
    expect(model.calls).toHaveLength(1);
  });

  it("falls back to keeping the conversation moving after two invalid outputs", async () => {
    const model = new SetupModel([{ invalid: true }, new Error("unavailable")]);

    const setup = await inferPracticeSetup({
      background: "A friend tells me about something that happened at work.",
      goal: "I want to respond with a comment and ask a natural follow-up to keep the conversation moving.",
      model,
    });

    expect(setup.primarySkill).toBe("responding_naturally");
    expect(setup.targetBehaviors).toEqual([
      "give_natural_first_reaction",
      "add_short_comment_or_related_thought",
      "ask_natural_follow_up",
    ]);
    expect(model.calls.map((call) => call.repairAttempt)).toEqual([false, true]);
  });
});
