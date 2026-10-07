import {
  PRACTICE_CONTEXT_VALUES,
  targetBehaviorsForSkill,
  type ActivePracticeContext,
} from "@/lib/coaching/product-rules";
import {
  practiceSetupSchema,
  quickPracticeSelectionSchema,
  type PracticeSetup,
  type QuickPracticeSelection,
} from "@/lib/coaching/schemas";

const WORK_CONTEXTS = PRACTICE_CONTEXT_VALUES.slice(0, 4);

function seedNumber(seed: string): number {
  let value = 2166136261;
  for (const character of seed) {
    value ^= character.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function contextFor(
  selection: QuickPracticeSelection,
  seed: number,
): ActivePracticeContext {
  if (selection.topic === "everyday_life") {
    return "everyday_situations";
  }
  if (selection.topic === "understanding_myself") {
    return "personal_decisions";
  }
  return WORK_CONTEXTS[seed % WORK_CONTEXTS.length];
}

export function buildQuickPracticeSetup(input: {
  selection: unknown;
  variationSeed: string;
}): PracticeSetup {
  const selection = quickPracticeSelectionSchema.parse(input.selection);
  const seed = seedNumber(input.variationSeed);
  const context = contextFor(selection, seed);
  const behaviors = targetBehaviorsForSkill(selection.primarySkill);
  const behavior = behaviors[(seed >>> 3) % behaviors.length].value;

  return practiceSetupSchema.parse({
    primarySkill: selection.primarySkill,
    supportingSkill: null,
    practiceArea:
      selection.topic === "work" ? "work" : "personal_life",
    context,
    targetBehavior: behavior,
    targetBehaviors: [behavior],
    desiredImpression: null,
    situationMode: "choose_for_me",
    situationDetail: null,
  });
}
