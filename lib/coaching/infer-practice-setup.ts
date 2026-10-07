import { composeGuidedSituationDetail } from "@/lib/coaching/custom-situation";
import type { PracticeModel } from "@/lib/coaching/provider-contracts";
import {
  describedSituationRequestSchema,
  inferredPracticeSetupSchema,
  practiceSetupSchema,
  type PracticeSetup,
} from "@/lib/coaching/schemas";

type InferenceModel = Pick<PracticeModel, "inferSetup">;

function includesAny(value: string, terms: readonly string[]): boolean {
  return terms.some((term) => value.includes(term));
}

function deterministicSelection(background: string, goal: string) {
  const text = `${background} ${goal}`.toLowerCase();
  const isInterview = includesAny(text, ["interview", "interviewer", "job application"]);
  const isManager = includesAny(text, ["manager", "boss", "supervisor", "feedback", "deadline", "workload"]);
  const isClient = includesAny(text, ["client", "customer", "customer service"]);
  const isCoworker = includesAny(text, ["coworker", "colleague", "team", "project", "meeting", "work"]);
  const isWork = isInterview || isManager || isClient || isCoworker;
  const practiceArea = isWork ? "work" : "personal_life";
  const context = isInterview
    ? "job_interviews"
    : isManager
      ? "managers_feedback"
      : isClient
        ? "customers_clients"
        : isCoworker
          ? "coworkers_teamwork"
          : includesAny(text, ["decision", "choice", "choose", "plan", "considering"])
            ? "personal_decisions"
            : "everyday_situations";

  if (
    includesAny(text, [
      "request",
      "ask for",
      "say no",
      "boundary",
      "disagree",
      "problem",
      "conflict",
      "deadline",
      "respectfully",
    ])
  ) {
    return {
      primarySkill: "speaking_assertively",
      practiceArea,
      context,
      targetBehaviors: includesAny(text, ["disagree", "different opinion"])
        ? ["disagree_respectfully"]
        : includesAny(text, ["boundary", "say no"])
          ? ["set_boundary_or_say_no"]
          : ["make_clear_request", "repair_tension_and_next_step"],
      desiredImpression: null,
    } as const;
  }

  if (
    includesAny(text, [
      "follow-up",
      "follow up",
      "keep the conversation",
      "respond",
      "react",
      "listen",
      "ask questions",
      "small talk",
    ])
  ) {
    return {
      primarySkill: "responding_naturally",
      practiceArea,
      context,
      targetBehaviors: [
        "give_natural_first_reaction",
        "add_short_comment_or_related_thought",
        "ask_natural_follow_up",
      ],
      desiredImpression: null,
    } as const;
  }

  if (
    includesAny(text, [
      "explain",
      "describe",
      "present",
      "update",
      "tell what happened",
      "how it works",
    ])
  ) {
    return {
      primarySkill: "explaining_clearly",
      practiceArea,
      context,
      targetBehaviors: includesAny(text, ["problem", "cause", "issue"])
        ? ["describe_problem_and_causes"]
        : ["tell_in_logical_order"],
      desiredImpression: null,
    } as const;
  }

  return {
    primarySkill: "expressing_yourself",
    practiceArea,
    context,
    targetBehaviors: includesAny(text, ["feel", "feeling", "felt"])
      ? ["describe_feeling_and_cause"]
      : includesAny(text, ["experience", "happened to me"])
        ? ["share_experience_and_meaning"]
        : ["share_opinion_and_reason"],
    desiredImpression: null,
  } as const;
}

export async function inferPracticeSetup(input: {
  background: unknown;
  goal: unknown;
  model: InferenceModel;
}): Promise<PracticeSetup> {
  const answers = describedSituationRequestSchema.parse({
    background: input.background,
    goal: input.goal,
  });

  let selection: unknown = null;
  for (const repairAttempt of [false, true]) {
    try {
      const output = await input.model.inferSetup({
        ...answers,
        repairAttempt,
      });
      const parsed = inferredPracticeSetupSchema.safeParse(output);
      if (parsed.success) {
        selection = parsed.data;
        break;
      }
    } catch {
      // Use one bounded repair attempt, then the validated deterministic fallback.
    }
  }

  const inferred =
    inferredPracticeSetupSchema.safeParse(selection).success
      ? inferredPracticeSetupSchema.parse(selection)
      : inferredPracticeSetupSchema.parse(
          deterministicSelection(answers.background, answers.goal),
        );
  const situationDetail = composeGuidedSituationDetail({
    partner: "",
    background: answers.background,
    goal: answers.goal,
    difficulty: "",
  });

  return practiceSetupSchema.parse({
    ...inferred,
    supportingSkill: null,
    situationMode: "learner_provided",
    situationDetail,
  });
}
