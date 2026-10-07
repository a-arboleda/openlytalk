import type {
  CommunicationSkill,
  PracticeContext,
} from "@/lib/coaching/product-rules";

export const GUIDED_SITUATION_LIMITS = {
  partner: 80,
  background: 280,
  goal: 180,
  difficulty: 120,
} as const;

export interface GuidedSituationAnswers {
  partner: string;
  background: string;
  goal: string;
  difficulty: string;
}

interface GuidedSituationGuidance {
  backgroundPlaceholder: string;
  goalPlaceholder: string;
}

const PERSON_FOR_CONTEXT = {
  coworkers_teamwork: "my coworker",
  managers_feedback: "my manager",
  customers_clients: "my client",
  everyday_situations: "my friend",
  work: "my manager",
  family_relationships: "my sister",
  job_interviews: "the interviewer",
  personal_decisions: "my friend",
} as const satisfies Record<PracticeContext, string>;

const BACKGROUND_PLACEHOLDER = {
  coworkers_teamwork:
    "For example: My coworker and I misunderstood who was responsible for an important task.",
  managers_feedback:
    "For example: My manager wants me to work extra hours this weekend.",
  customers_clients:
    "For example: My client requested a change that may delay the project.",
  everyday_situations:
    "For example: My friend needs to decide how to spend the weekend.",
  work:
    "For example: My manager assigned me two urgent projects with the same deadline.",
  family_relationships:
    "For example: My sister and I disagreed about how to share a family responsibility.",
  job_interviews:
    "For example: The interviewer will ask me about a difficult customer I helped.",
  personal_decisions:
    "For example: My friend thinks I should stay in my current job, but I am considering leaving.",
} as const satisfies Record<PracticeContext, string>;

function goalPlaceholder(
  primarySkill: CommunicationSkill,
  person: string,
): string {
  switch (primarySkill) {
    case "explaining_clearly":
      return `For example: I want to explain the situation clearly so ${person} understands what happened.`;
    case "responding_naturally":
      return `For example: I want to react to what ${person} says and keep the conversation moving.`;
    case "asking_better_questions":
      return `For example: I want to ask ${person} useful questions before we decide what to do.`;
    case "expressing_yourself":
      return `For example: I want to tell ${person} what I think and explain why it matters to me.`;
    case "speaking_assertively":
      return `For example: I want to tell ${person} what I need and agree on a respectful next step.`;
    case "handling_difficult_conversation":
      return `For example: I want to discuss the problem with ${person} and agree on a practical next step.`;
  }
}

const LABELS = {
  partner: "Speaking with:",
  background: "Situation:",
  goal: "Goal:",
  difficulty: "Expected response or difficulty:",
} as const;

function oneLine(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function valueAfterLabel(line: string, label: string): string | null {
  if (!line.startsWith(label)) return null;
  const value = line.slice(label.length).trim();
  return value.length > 0 ? value : null;
}

export function customSituationGuidance(input: {
  context: PracticeContext;
  primarySkill: CommunicationSkill;
}): GuidedSituationGuidance {
  const person = PERSON_FOR_CONTEXT[input.context];

  return {
    backgroundPlaceholder: BACKGROUND_PLACEHOLDER[input.context],
    goalPlaceholder: goalPlaceholder(input.primarySkill, person),
  };
}

export function guidedSituationIsComplete(
  answers: GuidedSituationAnswers,
): boolean {
  return (
    answers.background.trim().length > 0 &&
    answers.goal.trim().length > 0
  );
}

export function composeGuidedSituationDetail(
  answers: GuidedSituationAnswers,
): string {
  const lines = [
    `${LABELS.background} ${oneLine(answers.background)}`,
    `${LABELS.goal} ${oneLine(answers.goal)}`,
  ];
  const partner = oneLine(answers.partner);
  if (partner.length > 0) {
    lines.unshift(`${LABELS.partner} ${partner}`);
  }
  const difficulty = oneLine(answers.difficulty);
  if (difficulty.length > 0) {
    lines.push(`${LABELS.difficulty} ${difficulty}`);
  }
  return lines.join("\n");
}

export function parseGuidedSituationDetail(
  value: string,
): GuidedSituationAnswers | null {
  const lines = value.split("\n");
  const valueFor = (label: string) =>
    lines
      .map((line) => valueAfterLabel(line, label))
      .find((line): line is string => line !== null) ?? null;
  const partner = valueFor(LABELS.partner) ?? "";
  const background = valueFor(LABELS.background);
  const goal = valueFor(LABELS.goal);
  if (background === null || goal === null) return null;

  return {
    partner,
    background,
    goal,
    difficulty: valueFor(LABELS.difficulty) ?? "",
  };
}

function learnerFacingPartner(value: string): string {
  return oneLine(value).replace(/^my\b/i, "your");
}

export function guidedSituationSummary(value: string): string {
  const answers = parseGuidedSituationDetail(value);
  if (answers === null) return value;
  return answers.partner.length > 0
    ? `With ${learnerFacingPartner(answers.partner)}: ${answers.background}`
    : answers.background;
}

export function guidedSituationForBrief(value: string): string {
  const answers = parseGuidedSituationDetail(value);
  if (answers === null) return value;

  return [
    answers.partner.length > 0
      ? `You are preparing for a conversation with ${learnerFacingPartner(answers.partner)}.`
      : null,
    answers.background,
    `Your desired outcome: ${answers.goal}`,
    answers.difficulty.length > 0
      ? `You expect this possible difficulty: ${answers.difficulty}`
      : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" ");
}

export function guidedSituationPartnerRole(value: string): string | null {
  const answers = parseGuidedSituationDetail(value);
  return answers === null || answers.partner.length === 0
    ? null
    : learnerFacingPartner(answers.partner);
}
