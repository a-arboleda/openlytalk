import { SESSION_ACCESS_DAYS } from "@/lib/operations/retention-policy";
import { randomUUID } from "node:crypto";

import { hasThirdPersonLearnerReference } from "@/lib/coaching/learner-facing-language";
import { buildDeterministicPracticePlan } from "@/lib/coaching/plan-builder";
import { COACHING_BETA_RULES } from "@/lib/coaching/product-rules";
import type { PracticeModel } from "@/lib/coaching/provider-contracts";
import {
  practicePlanSchema,
  practiceSessionStateSchema,
  practiceSetupSchema,
  type PracticePlan,
  type PracticeSessionState,
  type PracticeSetup,
} from "@/lib/coaching/schemas";
import type { PracticeRepository } from "@/lib/persistence/practice-repository";
import { databaseIdSchema } from "@/lib/validation/persistence";

const DAY_MILLISECONDS = 24 * 60 * 60 * 1_000;

export type PracticePlanSource =
  | "model"
  | "model_repair"
  | "deterministic_fallback";

export interface CreatedPracticeSession {
  state: PracticeSessionState;
  planSource: PracticePlanSource;
}

export class PracticeSessionCreationError extends Error {
  constructor(
    public readonly reason:
      | "invalid_generated_output"
      | "persistence_unavailable",
  ) {
    super(
      reason === "invalid_generated_output"
        ? "No valid practice plan could be created."
        : "The practice session could not be persisted.",
    );
    this.name = "PracticeSessionCreationError";
  }
}

function sameSetup(left: PracticeSetup, right: PracticeSetup): boolean {
  return (
    left.primarySkill === right.primarySkill &&
    left.supportingSkill === right.supportingSkill &&
    left.practiceArea === right.practiceArea &&
    left.context === right.context &&
    left.targetBehaviors.length === right.targetBehaviors.length &&
    left.targetBehaviors.every(
      (behavior, index) => behavior === right.targetBehaviors[index],
    ) &&
    left.desiredImpression === right.desiredImpression &&
    left.situationMode === right.situationMode &&
    left.situationDetail === right.situationDetail
  );
}

const AMBIGUOUS_FACT_OWNER =
  /^(?:(?:what|which|whether|why|how)\s+)?(?:they|them|their|theirs|he|him|his|she|her|hers|it|its)\b/i;

function factsHaveExplicitOwners(plan: PracticePlan): boolean {
  return [
    ...plan.partner.knownFacts,
    ...plan.partner.unknownFacts,
  ].every((fact) => !AMBIGUOUS_FACT_OWNER.test(fact.trim()));
}

function hasNaturalPartnerOpening(
  plan: PracticePlan,
  singlePrompt: boolean,
): boolean {
  const opening = plan.opening.partnerOpeningText;
  if (plan.opening.speaker !== "partner" || opening === null) return false;
  const words = opening.trim().split(/\s+/).filter(Boolean).length;
  const questionCount = opening.match(/\?/g)?.length ?? 0;
  const hasOneQuestion = questionCount === 1;
  if (!singlePrompt) {
    return words >= 4 && words <= 45 && hasOneQuestion;
  }

  const hasMultipleSentences = /[.!?]\s+\S/.test(opening);
  const hasConversationalLeadIn =
    questionCount === 0
      ? hasMultipleSentences
      : /[.!]\s+\S/.test(opening.slice(0, opening.indexOf("?")));
  const hasSkillAppropriateQuestionCount =
    plan.setup.primarySkill === "responding_naturally"
      ? questionCount === 0
      : plan.setup.primarySkill === "speaking_assertively"
        ? questionCount <= 1
        : questionCount === 1;
  return (
    words >= 8 &&
    words <= 60 &&
    hasSkillAppropriateQuestionCount &&
    hasConversationalLeadIn
  );
}

function hasSelfContainedPromptReferences(
  plan: PracticePlan,
  singlePrompt: boolean,
): boolean {
  if (!singlePrompt || plan.opening.partnerOpeningText === null) return true;
  const opening = plan.opening.partnerOpeningText.trim();
  const hasQuestion = opening.includes("?");
  const firstSentence = opening.split(/[.!?]/, 1)[0] ?? opening;
  const questionStart = Math.max(
    opening.lastIndexOf("."),
    opening.lastIndexOf("!"),
  );
  const question = opening.slice(questionStart + 1);
  const inventsOffscreenHistory =
    /\b(?:you mentioned|you said|as you (?:said|mentioned)|as we discussed|we talked about)\b/i.test(
      opening,
    );
  const startsWithUngroundedComparison = /\bsimilar\b/i.test(firstSentence);
  const asksLearnerOwnedQuestion =
    !hasQuestion || /\b(?:you|your)\b/i.test(question);
  const asksToDiagnoseFictionalProblem =
    /\bwhat\s+(?:do\s+you\s+think\s+)?(?:caused|causes|is\s+causing)\s+(?:it|this|that|the\s+(?:problem|issue))\b/i.test(
      question,
    );
  return (
    !inventsOffscreenHistory &&
    !startsWithUngroundedComparison &&
    asksLearnerOwnedQuestion &&
    !asksToDiagnoseFictionalProblem
  );
}

function validatedGeneratedPlan(
  output: unknown,
  setup: PracticeSetup,
  recentlyUsedSituations: readonly string[],
  singlePrompt: boolean,
): PracticePlan | null {
  const parsed = practicePlanSchema.safeParse(output);
  if (
    !parsed.success ||
    !sameSetup(parsed.data.setup, setup) ||
    !hasNaturalPartnerOpening(parsed.data, singlePrompt) ||
    !hasSelfContainedPromptReferences(parsed.data, singlePrompt) ||
    !factsHaveExplicitOwners(parsed.data) ||
    (setup.situationMode === "choose_for_me" &&
      hasThirdPersonLearnerReference(parsed.data.situation)) ||
    recentlyUsedSituations.some((situation) =>
      substantiallySameSituation(parsed.data.situation, situation),
    )
  ) {
    return null;
  }
  return parsed.data;
}

const SCENARIO_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "about",
  "but",
  "for",
  "in",
  "is",
  "of",
  "on",
  "the",
  "to",
  "with",
  "you",
  "your",
]);

function situationTokens(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .map((token) =>
        token.length > 4 && token.endsWith("s") && !token.endsWith("ss")
          ? token.slice(0, -1)
          : token,
      )
      .filter(
        (token) => token.length > 2 && !SCENARIO_STOP_WORDS.has(token),
      ),
  );
}

export function substantiallySameSituation(
  left: string,
  right: string,
): boolean {
  const leftTokens = situationTokens(left);
  const rightTokens = situationTokens(right);
  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return left.trim().toLowerCase() === right.trim().toLowerCase();
  }
  const shared = [...leftTokens].filter((token) => rightTokens.has(token));
  const union = new Set([...leftTokens, ...rightTokens]);
  const overlap = shared.length / Math.min(leftTokens.size, rightTokens.size);
  return shared.length / union.size >= 0.5 || overlap >= 0.6;
}

export async function generatePracticePlan(input: {
  setup: PracticeSetup;
  model: Pick<PracticeModel, "generatePlan">;
  variationSeed: string;
  recentlyUsedSituations: string[];
  practiceFormat?: "single_prompt" | "conversation_simulation";
}): Promise<{
  plan: PracticePlan;
  source: PracticePlanSource;
}> {
  for (const repairAttempt of [false, true]) {
    try {
      const output = await input.model.generatePlan({
        setup: input.setup,
        repairAttempt,
        ...(input.practiceFormat
          ? { practiceFormat: input.practiceFormat }
          : {}),
        scenarioVariation: {
          seed: input.variationSeed,
          recentlyUsedSituations: input.recentlyUsedSituations,
        },
      });
      const plan = validatedGeneratedPlan(
        output,
        input.setup,
        input.recentlyUsedSituations,
        input.practiceFormat === "single_prompt",
      );
      if (plan !== null) {
        return {
          plan,
          source: repairAttempt ? "model_repair" : "model",
        };
      }
    } catch {
      // One bounded retry is allowed; provider details are not logged here.
    }
  }

  try {
    return {
      plan: buildDeterministicPracticePlan(input.setup, {
        variationSeed: input.variationSeed,
        avoidSituations: input.recentlyUsedSituations,
        singlePrompt: input.practiceFormat === "single_prompt",
      }),
      source: "deterministic_fallback",
    };
  } catch {
    throw new PracticeSessionCreationError("invalid_generated_output");
  }
}

export async function createPracticeSession(input: {
  anonymousSessionId: string;
  setup: unknown;
  model: Pick<PracticeModel, "generatePlan">;
  repository: Pick<
    PracticeRepository,
    "createPracticeSession" | "listRecentPracticeSituations"
  >;
  now?: Date;
  idFactory?: () => string;
  practiceFormat?: "single_prompt" | "conversation_simulation";
}): Promise<CreatedPracticeSession> {
  const setup = practiceSetupSchema.parse(input.setup);
  const anonymousSessionId = databaseIdSchema.parse(
    input.anonymousSessionId,
  );
  const now = input.now ?? new Date();
  if (Number.isNaN(now.getTime())) {
    throw new Error("Practice creation requires a valid current time.");
  }

  const practiceSessionId = databaseIdSchema.parse(
    (input.idFactory ?? randomUUID)(),
  );
  const createdAt = now.toISOString();
  const expiresAt = new Date(
    now.getTime() +
      SESSION_ACCESS_DAYS * DAY_MILLISECONDS,
  ).toISOString();
  let recentlyUsedSituations: string[];
  try {
    recentlyUsedSituations =
      setup.situationMode === "choose_for_me"
        ? await input.repository.listRecentPracticeSituations({
            anonymousSessionId,
            setup,
            now: createdAt,
            limit: 5,
          })
        : [];
  } catch {
    throw new PracticeSessionCreationError("persistence_unavailable");
  }
  const { plan, source } = await generatePracticePlan({
    setup,
    model: input.model,
    variationSeed: practiceSessionId,
    recentlyUsedSituations,
    practiceFormat: input.practiceFormat,
  });
  const singlePrompt = input.practiceFormat === "single_prompt";
  const state = practiceSessionStateSchema.parse({
    schemaVersion: singlePrompt ? 6 : 5,
    practiceSessionId,
    anonymousSessionId,
    status: "active",
    phase: "briefing",
    setup,
    plan,
    situationReplacementCount: 0,
    lastSituationReplacementKey: null,
    acceptedResponseCount: 0,
    responseLimit: singlePrompt
      ? COACHING_BETA_RULES.currentPracticeResponseLimit
      : COACHING_BETA_RULES.previousTwoResponsePracticeLimit,
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
    createdAt,
    updatedAt: createdAt,
    expiresAt,
  });

  try {
    const snapshot = await input.repository.createPracticeSession({
      anonymousSessionId,
      state,
    });
    return {
      state: practiceSessionStateSchema.parse(snapshot.state),
      planSource: source,
    };
  } catch {
    throw new PracticeSessionCreationError("persistence_unavailable");
  }
}
