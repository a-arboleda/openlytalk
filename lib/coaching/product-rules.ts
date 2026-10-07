export const COMMUNICATION_SKILL_VALUES = [
  "explaining_clearly",
  "responding_naturally",
  "expressing_yourself",
  "speaking_assertively",
] as const;

export const LEGACY_COMMUNICATION_SKILL_VALUES = [
  "asking_better_questions",
  "handling_difficult_conversation",
] as const;

export const ACCEPTED_COMMUNICATION_SKILL_VALUES = [
  ...COMMUNICATION_SKILL_VALUES,
  ...LEGACY_COMMUNICATION_SKILL_VALUES,
] as const;

export type ActiveCommunicationSkill =
  (typeof COMMUNICATION_SKILL_VALUES)[number];
export type CommunicationSkill =
  (typeof ACCEPTED_COMMUNICATION_SKILL_VALUES)[number];

export const COMMUNICATION_SKILLS = [
  {
    value: COMMUNICATION_SKILL_VALUES[0],
    label: "Explaining something clearly",
    description:
      "Organize an idea, experience, or process so the main point is easy to follow.",
  },
  {
    value: COMMUNICATION_SKILL_VALUES[1],
    label: "Responding naturally",
    description:
      "React in the moment with a genuine comment, feeling, acknowledgment, or question.",
  },
  {
    value: COMMUNICATION_SKILL_VALUES[2],
    label: "Expressing what I think and feel",
    description:
      "Put your opinions, feelings, experiences, preferences, and beliefs into your own words.",
  },
  {
    value: COMMUNICATION_SKILL_VALUES[3],
    label: "Speaking up for myself",
    description:
      "Communicate a need, request, disagreement, problem, or boundary clearly and respectfully.",
  },
] as const satisfies ReadonlyArray<{
  value: ActiveCommunicationSkill;
  label: string;
  description: string;
}>;

const COMMUNICATION_SKILL_LABELS = {
  explaining_clearly: "Explaining something clearly",
  responding_naturally: "Responding naturally",
  expressing_yourself: "Expressing what I think and feel",
  speaking_assertively: "Speaking up for myself",
  asking_better_questions: "Asking better questions",
  handling_difficult_conversation: "Handling a difficult conversation",
} as const satisfies Record<CommunicationSkill, string>;

export const PRACTICE_TOPIC_VALUES = [
  "everyday_life",
  "work",
  "understanding_myself",
] as const;

export type PracticeTopic = (typeof PRACTICE_TOPIC_VALUES)[number];

export const PRACTICE_TOPICS = [
  {
    value: PRACTICE_TOPIC_VALUES[0],
    label: "Everyday life",
    description:
      "Plans, routines, friendships, family, experiences, and ordinary situations.",
  },
  {
    value: PRACTICE_TOPIC_VALUES[1],
    label: "Work",
    description:
      "Coworkers, managers, customers, meetings, responsibilities, and interviews.",
  },
  {
    value: PRACTICE_TOPIC_VALUES[2],
    label: "What matters to me",
    description:
      "Explore who you are, your priorities, relationships, values, boundaries, and future.",
  },
] as const satisfies ReadonlyArray<{
  value: PracticeTopic;
  label: string;
  description: string;
}>;

const PRACTICE_TOPIC_VALUES_BY_SKILL = {
  explaining_clearly: ["everyday_life", "work"],
  responding_naturally: ["everyday_life", "work"],
  expressing_yourself: ["everyday_life", "understanding_myself"],
  speaking_assertively: ["everyday_life", "work"],
} as const satisfies Record<
  ActiveCommunicationSkill,
  readonly PracticeTopic[]
>;

export function isPracticeTopicForSkill(
  skill: ActiveCommunicationSkill,
  topic: PracticeTopic,
): boolean {
  return (PRACTICE_TOPIC_VALUES_BY_SKILL[skill] as readonly PracticeTopic[])
    .includes(topic);
}

export function practiceTopicsForSkill(
  skill: ActiveCommunicationSkill,
) {
  return PRACTICE_TOPICS.filter((topic) =>
    isPracticeTopicForSkill(skill, topic.value),
  );
}

export const PRACTICE_AREA_VALUES = ["work", "personal_life"] as const;
export type PracticeArea = (typeof PRACTICE_AREA_VALUES)[number];

export const PRACTICE_AREAS = [
  {
    value: PRACTICE_AREA_VALUES[0],
    label: "Work",
    description:
      "Practice communication with coworkers, managers, customers, clients, or interviewers.",
  },
  {
    value: PRACTICE_AREA_VALUES[1],
    label: "Personal life",
    description:
      "Practice everyday communication or talk through a personal decision.",
  },
] as const satisfies ReadonlyArray<{
  value: PracticeArea;
  label: string;
  description: string;
}>;

export const PRACTICE_CONTEXT_VALUES = [
  "coworkers_teamwork",
  "managers_feedback",
  "customers_clients",
  "job_interviews",
  "everyday_situations",
  "personal_decisions",
] as const;

export const LEGACY_PRACTICE_CONTEXT_VALUES = [
  "work",
  "family_relationships",
] as const;

export const ACCEPTED_PRACTICE_CONTEXT_VALUES = [
  ...PRACTICE_CONTEXT_VALUES,
  ...LEGACY_PRACTICE_CONTEXT_VALUES,
] as const;

export type ActivePracticeContext = (typeof PRACTICE_CONTEXT_VALUES)[number];
export type PracticeContext =
  (typeof ACCEPTED_PRACTICE_CONTEXT_VALUES)[number];

export const PRACTICE_CONTEXTS = [
  {
    value: "coworkers_teamwork",
    area: "work",
    label: "Coworkers and teamwork",
    description:
      "Projects, collaboration, handoffs, meetings, priorities, and shared responsibilities.",
  },
  {
    value: "managers_feedback",
    area: "work",
    label: "Managers and feedback",
    description:
      "Updates, expectations, feedback, requests, mistakes, workload, and priorities.",
  },
  {
    value: "customers_clients",
    area: "work",
    label: "Customers and clients",
    description:
      "Questions, explanations, requests, complaints, expectations, and solutions.",
  },
  {
    value: "job_interviews",
    area: "work",
    label: "Job interviews",
    description:
      "Experience, examples, strengths, challenges, motivation, and follow-up questions.",
  },
  {
    value: "everyday_situations",
    area: "personal_life",
    label: "Everyday situations",
    description:
      "Routines, errands, plans, services, friends, neighbors, and ordinary explanations.",
  },
  {
    value: "personal_decisions",
    area: "personal_life",
    label: "Personal decisions",
    description:
      "Choices, goals, uncertainty, reasons, advice, tradeoffs, and plans.",
  },
] as const satisfies ReadonlyArray<{
  value: ActivePracticeContext;
  area: PracticeArea;
  label: string;
  description: string;
}>;

const LEGACY_PRACTICE_CONTEXT_LABELS = {
  work: "Work",
  family_relationships: "Family and relationships",
} as const satisfies Record<
  (typeof LEGACY_PRACTICE_CONTEXT_VALUES)[number],
  string
>;

export function practiceContextsForArea(
  area: PracticeArea,
): typeof PRACTICE_CONTEXTS[number][] {
  return PRACTICE_CONTEXTS.filter((context) => context.area === area);
}

export function practiceAreaForContext(
  context: PracticeContext,
): PracticeArea {
  if (
    context === "coworkers_teamwork" ||
    context === "managers_feedback" ||
    context === "customers_clients" ||
    context === "job_interviews" ||
    context === "work"
  ) {
    return "work";
  }
  return "personal_life";
}

export function practiceAreaLabel(value: PracticeArea): string {
  return PRACTICE_AREAS.find((option) => option.value === value)?.label ?? value;
}

export const DESIRED_IMPRESSION_VALUES = [
  "calm_confident",
  "warm_approachable",
  "natural_relaxed",
  "direct_respectful",
  "thoughtful_composed",
  "professional_prepared",
] as const;

export type DesiredImpression = (typeof DESIRED_IMPRESSION_VALUES)[number];

export const DESIRED_IMPRESSIONS = [
  {
    value: DESIRED_IMPRESSION_VALUES[0],
    label: "Calm and confident",
    description:
      "Organize your ideas steadily without unnecessary apologies or rushed explanations.",
  },
  {
    value: DESIRED_IMPRESSION_VALUES[1],
    label: "Warm and approachable",
    description:
      "Acknowledge the other person and use considerate, interested language.",
  },
  {
    value: DESIRED_IMPRESSION_VALUES[2],
    label: "Natural and relaxed",
    description:
      "Use conversational wording and transitions without sounding rehearsed.",
  },
  {
    value: DESIRED_IMPRESSION_VALUES[3],
    label: "Direct but respectful",
    description:
      "State the point or request clearly while keeping the wording neutral.",
  },
  {
    value: DESIRED_IMPRESSION_VALUES[4],
    label: "Thoughtful and composed",
    description:
      "Take time to organize, qualify, and respond without rushing to a conclusion.",
  },
  {
    value: DESIRED_IMPRESSION_VALUES[5],
    label: "Professional and prepared",
    description:
      "Use relevant examples, appropriate formality, and clear outcomes.",
  },
] as const satisfies ReadonlyArray<{
  value: DesiredImpression;
  label: string;
  description: string;
}>;

export const TARGET_BEHAVIORS = {
  explaining_clearly: [
    {
      value: "tell_in_logical_order",
      label: "Tell something in a logical order",
    },
    {
      value: "explain_how_it_works",
      label: "Explain how something works",
    },
    {
      value: "describe_problem_and_causes",
      label: "Describe a problem and its causes",
    },
    {
      value: "give_reasons_for_decision_or_opinion",
      label: "Give clear reasons for a decision or opinion",
    },
  ],
  responding_naturally: [
    {
      value: "give_natural_first_reaction",
      label: "Give a natural first reaction",
    },
    {
      value: "show_empathy_or_enthusiasm",
      label: "Show empathy or enthusiasm appropriately",
    },
    {
      value: "add_short_comment_or_related_thought",
      label: "Add a short comment or related thought",
    },
    {
      value: "ask_natural_follow_up",
      label: "Ask a natural follow-up",
    },
  ],
  expressing_yourself: [
    {
      value: "share_opinion_and_reason",
      label: "State an opinion confidently and explain why",
    },
    {
      value: "describe_feeling_and_cause",
      label: "Describe a feeling and what caused it",
    },
    {
      value: "share_experience_and_meaning",
      label: "Talk about an experience and what it meant",
    },
    {
      value: "explain_preference_plan_or_decision",
      label: "Explain a preference, plan, or personal decision",
    },
  ],
  speaking_assertively: [
    {
      value: "make_clear_request",
      label: "State a need or make a clear request",
    },
    {
      value: "disagree_respectfully",
      label: "Disagree respectfully",
    },
    {
      value: "set_boundary_or_say_no",
      label: "Set a boundary or say no",
    },
    {
      value: "raise_problem_without_blaming",
      label: "Raise a problem without blaming",
    },
    {
      value: "repair_tension_and_next_step",
      label: "Repair tension and work toward a next step",
    },
  ],
} as const satisfies Record<
  ActiveCommunicationSkill,
  ReadonlyArray<{ value: string; label: string }>
>;

const LEGACY_TARGET_BEHAVIORS = {
  asking_better_questions: [
    { value: "ask_open_ended_question", label: "Ask an open-ended question" },
    { value: "ask_useful_follow_up", label: "Ask a useful follow-up" },
    {
      value: "ask_for_clarification_or_example",
      label: "Ask for clarification or an example",
    },
    {
      value: "understand_another_perspective",
      label: "Understand another person's perspective",
    },
  ],
  handling_difficult_conversation: [
    {
      value: "raise_problem_without_blaming",
      label: "Raise a problem without blaming",
    },
    {
      value: "respond_to_defensiveness",
      label: "Respond when the other person becomes defensive",
    },
    {
      value: "apologize_or_repair",
      label: "Apologize or repair a misunderstanding",
    },
    {
      value: "work_toward_practical_agreement",
      label: "Work toward a practical agreement",
    },
  ],
  speaking_assertively: [
    {
      value: "state_opinion_confidently",
      label: "State an opinion confidently",
    },
  ],
} as const;

type TargetBehaviorMap = typeof TARGET_BEHAVIORS;
type LegacyTargetBehaviorMap = typeof LEGACY_TARGET_BEHAVIORS;

export type TargetBehavior =
  | TargetBehaviorMap[keyof TargetBehaviorMap][number]["value"]
  | LegacyTargetBehaviorMap[keyof LegacyTargetBehaviorMap][number]["value"];

export const TARGET_BEHAVIOR_VALUES = Array.from(
  new Set<TargetBehavior>([
    ...Object.values(TARGET_BEHAVIORS).flatMap((options) =>
      options.map((option) => option.value),
    ),
    ...Object.values(LEGACY_TARGET_BEHAVIORS).flatMap((options) =>
      options.map((option) => option.value),
    ),
  ]),
) as [TargetBehavior, ...TargetBehavior[]];

export const EVIDENCE_DIMENSION_VALUES = [
  "main_point_clarity",
  "logical_order",
  "relevant_context",
  "useful_example",
  "open_question",
  "follow_up_question",
  "clarification",
  "perspective_exploration",
  "opinion_reasoning",
  "emotional_expression",
  "personal_meaning",
  "direct_request",
  "respectful_disagreement",
  "boundary_clarity",
  "issue_description",
  "listening_acknowledgment",
  "repair_behavior",
  "solution_movement",
] as const;

export type EvidenceDimension =
  (typeof EVIDENCE_DIMENSION_VALUES)[number];

export const PRACTICE_HELP_VALUES = [
  "repeat_rephrase",
  "starting_phrase",
  "organize",
  "forgot_word",
] as const;

export type PracticeHelpType =
  (typeof PRACTICE_HELP_VALUES)[number];

export const PRACTICE_HELP_OPTIONS = [
  {
    value: PRACTICE_HELP_VALUES[0],
    label: "Repeat or rephrase that",
    description:
      "Hear the partner’s last message again in simpler words.",
  },
  {
    value: PRACTICE_HELP_VALUES[1],
    label: "Give me a starting phrase",
    description:
      "Get one short opening, then continue in your own words.",
  },
  {
    value: PRACTICE_HELP_VALUES[2],
    label: "Help me organize my response",
    description:
      "Get two or three points to help arrange your idea.",
  },
  {
    value: PRACTICE_HELP_VALUES[3],
    label: "I forgot a word",
    description:
      "Describe the idea by its purpose, category, appearance, or an example.",
  },
] as const satisfies ReadonlyArray<{
  value: PracticeHelpType;
  label: string;
  description: string;
}>;

export const COACHING_BETA_RULES = {
  captionsDefaultOn: false,
  language: "English",
  learnerLevel: "B1-B2",
  currentPracticeResponseLimit: 1,
  previousTwoResponsePracticeLimit: 2,
  previousContinuousPracticeResponseLimit: 3,
  // Five remains the read-compatible ceiling for anonymous sessions created
  // before the continuous short-conversation flows.
  maxAcceptedResponses: 5,
  maxRecordingSeconds: 60,
  maxSituationCharacters: 800,
  persistAudio: false,
  retentionDays: 7,
  textResponseFallback: false,
} as const;

export function targetBehaviorsForSkill(
  skill: CommunicationSkill,
): ReadonlyArray<{ value: TargetBehavior; label: string }> {
  if (skill === "asking_better_questions") {
    return LEGACY_TARGET_BEHAVIORS.asking_better_questions;
  }
  if (skill === "handling_difficult_conversation") {
    return LEGACY_TARGET_BEHAVIORS.handling_difficult_conversation;
  }
  return TARGET_BEHAVIORS[skill];
}

export function isTargetBehaviorForSkill(
  skill: CommunicationSkill,
  behavior: TargetBehavior,
): boolean {
  const selectable = targetBehaviorsForSkill(skill);
  const legacyForActiveSkill =
    skill === "speaking_assertively"
      ? LEGACY_TARGET_BEHAVIORS.speaking_assertively
      : [];
  return [...selectable, ...legacyForActiveSkill].some(
    (option) => option.value === behavior,
  );
}

export function communicationSkillLabel(
  value: CommunicationSkill,
): string {
  return COMMUNICATION_SKILL_LABELS[value];
}

export function practiceContextLabel(value: PracticeContext): string {
  const activeLabel = PRACTICE_CONTEXTS.find(
    (option) => option.value === value,
  )?.label;
  if (activeLabel !== undefined) return activeLabel;
  return LEGACY_PRACTICE_CONTEXT_LABELS[
    value as keyof typeof LEGACY_PRACTICE_CONTEXT_LABELS
  ];
}

export function desiredImpressionLabel(
  value: DesiredImpression,
): string {
  return (
    DESIRED_IMPRESSIONS.find((option) => option.value === value)?.label ??
    value
  );
}

export function targetBehaviorLabel(
  skill: CommunicationSkill,
  value: TargetBehavior,
): string {
  const selectable = targetBehaviorsForSkill(skill);
  const legacyForActiveSkill =
    skill === "speaking_assertively"
      ? LEGACY_TARGET_BEHAVIORS.speaking_assertively
      : [];
  return (
    [...selectable, ...legacyForActiveSkill].find(
      (option) => option.value === value,
    )?.label ?? value
  );
}

export function targetBehaviorsLabel(
  skill: CommunicationSkill,
  values: readonly TargetBehavior[],
): string {
  const labels = values.map((value) => targetBehaviorLabel(skill, value));
  if (labels.length <= 1) return labels[0] ?? "";
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}`;
}
