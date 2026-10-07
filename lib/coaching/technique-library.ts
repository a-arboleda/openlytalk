import {
  type CommunicationSkill,
  type EvidenceDimension,
  type TargetBehavior,
} from "@/lib/coaching/product-rules";

export const TECHNIQUE_FAMILY_IDS = [
  "main_point_reason_next_step",
  "opinion_reason_example",
  "situation_action_result",
  "context_problem_impact_attempt_need",
  "observation_impact_request",
  "acknowledge_position_suggestion",
  "notice_react_continue",
  "open_followup_clarify",
  "echo_explore_connect",
  "sequence_signposts",
  "feeling_cause_need",
  "circumlocution_category_purpose_example",
] as const;

export type TechniqueFamilyId = (typeof TECHNIQUE_FAMILY_IDS)[number];

export type TechniqueFamily = {
  id: TechniqueFamilyId;
  title: string;
  applicableSkills: readonly CommunicationSkill[];
  applicableBehaviors: readonly TargetBehavior[];
  stepPattern: readonly [string, string, ...string[]];
  evidenceDimensions: readonly EvidenceDimension[];
  antiPatterns: readonly string[];
  exampleConstraints: readonly string[];
};

export const TECHNIQUE_FAMILIES = [
  {
    id: "main_point_reason_next_step",
    title: "Main point → Reason → Next step",
    applicableSkills: [
      "explaining_clearly",
      "speaking_assertively",
      "handling_difficult_conversation",
    ],
    applicableBehaviors: [
      "describe_problem_and_causes",
      "give_reasons_for_decision_or_opinion",
      "make_clear_request",
      "raise_problem_without_blaming",
      "work_toward_practical_agreement",
    ],
    stepPattern: ["State the main point", "Give the reason", "Name the next step"],
    evidenceDimensions: [
      "main_point_clarity",
      "relevant_context",
      "solution_movement",
    ],
    antiPatterns: [
      "Do not hide the main point behind a long introduction.",
      "Do not propose an unrelated next step.",
    ],
    exampleConstraints: [
      "Use the learner's selected situation.",
      "Keep the example to three short sentences or fewer.",
    ],
  },
  {
    id: "opinion_reason_example",
    title: "Opinion → Reason → Example",
    applicableSkills: ["explaining_clearly", "expressing_yourself"],
    applicableBehaviors: [
      "give_reasons_for_decision_or_opinion",
      "share_opinion_and_reason",
      "explain_preference_plan_or_decision",
    ],
    stepPattern: ["State the opinion", "Explain the main reason", "Add one example"],
    evidenceDimensions: [
      "main_point_clarity",
      "opinion_reasoning",
      "useful_example",
    ],
    antiPatterns: [
      "Do not turn one opinion into a list of unrelated reasons.",
      "Do not present an example as universal proof.",
    ],
    exampleConstraints: [
      "Preserve room for reasonable disagreement.",
      "Use one concrete example.",
    ],
  },
  {
    id: "situation_action_result",
    title: "Situation → Action → Result",
    applicableSkills: ["explaining_clearly", "expressing_yourself"],
    applicableBehaviors: [
      "tell_in_logical_order",
      "share_experience_and_meaning",
    ],
    stepPattern: ["Set the situation", "Explain what you did", "Describe the result"],
    evidenceDimensions: ["relevant_context", "logical_order", "personal_meaning"],
    antiPatterns: [
      "Do not add background that does not help the listener understand the action.",
      "Do not stop before explaining the result.",
    ],
    exampleConstraints: [
      "Use a specific moment.",
      "Keep time order unambiguous.",
    ],
  },
  {
    id: "context_problem_impact_attempt_need",
    title: "Context → Problem → Impact → Attempt → Need",
    applicableSkills: [
      "explaining_clearly",
      "speaking_assertively",
      "handling_difficult_conversation",
    ],
    applicableBehaviors: [
      "describe_problem_and_causes",
      "make_clear_request",
      "raise_problem_without_blaming",
      "work_toward_practical_agreement",
    ],
    stepPattern: [
      "Give only the necessary context",
      "Explain the problem and impact",
      "Say what you tried and what you need",
    ],
    evidenceDimensions: [
      "relevant_context",
      "issue_description",
      "direct_request",
      "solution_movement",
    ],
    antiPatterns: [
      "Do not blame a person's character.",
      "Do not leave the listener guessing what help or change is needed.",
    ],
    exampleConstraints: [
      "Describe observable facts.",
      "End with a practical need or request.",
    ],
  },
  {
    id: "observation_impact_request",
    title: "Observation → Impact → Request",
    applicableSkills: [
      "speaking_assertively",
      "handling_difficult_conversation",
    ],
    applicableBehaviors: [
      "make_clear_request",
      "set_boundary_or_say_no",
      "raise_problem_without_blaming",
    ],
    stepPattern: [
      "Describe what happened",
      "Explain the impact",
      "Make a clear request",
    ],
    evidenceDimensions: [
      "issue_description",
      "direct_request",
      "boundary_clarity",
    ],
    antiPatterns: [
      "Do not describe the other person with a negative label.",
      "Do not disguise the request as a vague hint.",
    ],
    exampleConstraints: [
      "Use neutral observable language.",
      "Make the request realistic and specific.",
    ],
  },
  {
    id: "acknowledge_position_suggestion",
    title: "Acknowledge → Position → Suggestion",
    applicableSkills: [
      "expressing_yourself",
      "speaking_assertively",
      "handling_difficult_conversation",
    ],
    applicableBehaviors: [
      "share_opinion_and_reason",
      "state_opinion_confidently",
      "disagree_respectfully",
      "respond_to_defensiveness",
      "work_toward_practical_agreement",
      "repair_tension_and_next_step",
    ],
    stepPattern: [
      "Acknowledge the other perspective",
      "State your position",
      "Suggest a useful next step",
    ],
    evidenceDimensions: [
      "listening_acknowledgment",
      "respectful_disagreement",
      "solution_movement",
    ],
    antiPatterns: [
      "Do not use acknowledgment to pretend you agree.",
      "Do not abandon your position after acknowledging the other person.",
    ],
    exampleConstraints: [
      "Keep acknowledgment proportionate.",
      "Use a concrete next step when the situation allows it.",
    ],
  },
  {
    id: "notice_react_continue",
    title: "Notice → React → Continue",
    applicableSkills: ["responding_naturally"],
    applicableBehaviors: [
      "give_natural_first_reaction",
      "show_empathy_or_enthusiasm",
      "add_short_comment_or_related_thought",
    ],
    stepPattern: [
      "Notice the key detail or feeling",
      "Give one short, genuine reaction",
      "Add a comment or invite the person to continue",
    ],
    evidenceDimensions: [
      "listening_acknowledgment",
      "emotional_expression",
      "personal_meaning",
    ],
    antiPatterns: [
      "Do not use the same generic reaction for every kind of news.",
      "Do not turn the response into an interview with several questions.",
    ],
    exampleConstraints: [
      "Match the reaction to the emotional tone of the partner's message.",
      "Keep the first reaction brief and conversational.",
    ],
  },
  {
    id: "open_followup_clarify",
    title: "Open question → Follow-up → Clarify",
    applicableSkills: ["asking_better_questions"],
    applicableBehaviors: [
      "ask_open_ended_question",
      "ask_useful_follow_up",
      "ask_for_clarification_or_example",
    ],
    stepPattern: [
      "Begin with an open question",
      "Follow one detail",
      "Clarify only what remains unclear",
    ],
    evidenceDimensions: [
      "open_question",
      "follow_up_question",
      "clarification",
    ],
    antiPatterns: [
      "Do not ask several unrelated questions at once.",
      "Do not repeat a question the other person already answered.",
    ],
    exampleConstraints: [
      "Make the follow-up depend on the partner's answer.",
      "Use one question at a time.",
    ],
  },
  {
    id: "echo_explore_connect",
    title: "Echo → Explore → Connect",
    applicableSkills: [
      "responding_naturally",
      "speaking_assertively",
      "asking_better_questions",
      "handling_difficult_conversation",
    ],
    applicableBehaviors: [
      "ask_natural_follow_up",
      "repair_tension_and_next_step",
      "ask_useful_follow_up",
      "understand_another_perspective",
      "respond_to_defensiveness",
      "apologize_or_repair",
    ],
    stepPattern: [
      "Acknowledge one detail",
      "Explore what it means",
      "Connect it to the conversation",
    ],
    evidenceDimensions: [
      "listening_acknowledgment",
      "perspective_exploration",
      "repair_behavior",
    ],
    antiPatterns: [
      "Do not imitate the other person's exact words mechanically.",
      "Do not turn curiosity into an interrogation.",
    ],
    exampleConstraints: [
      "Use a detail the partner actually provided.",
      "Keep the connection relevant to the current goal.",
    ],
  },
  {
    id: "sequence_signposts",
    title: "First → Then → After that → Finally",
    applicableSkills: ["explaining_clearly", "expressing_yourself"],
    applicableBehaviors: [
      "tell_in_logical_order",
      "explain_how_it_works",
      "share_experience_and_meaning",
    ],
    stepPattern: [
      "Name the starting point",
      "Use transitions for the important steps",
      "Finish with the result",
    ],
    evidenceDimensions: ["logical_order", "relevant_context", "main_point_clarity"],
    antiPatterns: [
      "Do not label every minor detail as a separate step.",
      "Do not omit the result or final state.",
    ],
    exampleConstraints: [
      "Use only the transitions needed for clarity.",
      "Keep the sequence short enough to remember while speaking.",
    ],
  },
  {
    id: "feeling_cause_need",
    title: "Feeling → Cause → Need or reflection",
    applicableSkills: ["expressing_yourself"],
    applicableBehaviors: ["describe_feeling_and_cause"],
    stepPattern: [
      "Name the feeling",
      "Explain what contributed to it",
      "Say what you need or what you have realized",
    ],
    evidenceDimensions: [
      "emotional_expression",
      "relevant_context",
      "personal_meaning",
    ],
    antiPatterns: [
      "Do not present an assumption about another person's intention as a fact.",
      "Do not pressure the learner to disclose more than they want to share.",
    ],
    exampleConstraints: [
      "Use ordinary emotional language accessible to B1-B2 learners.",
      "Keep the need or reflection personal and non-diagnostic.",
    ],
  },
  {
    id: "circumlocution_category_purpose_example",
    title: "Category → Purpose → Appearance or example",
    applicableSkills: ["explaining_clearly", "expressing_yourself"],
    applicableBehaviors: [
      "explain_how_it_works",
      "describe_problem_and_causes",
      "share_experience_and_meaning",
    ],
    stepPattern: [
      "Name the general category",
      "Explain what it does",
      "Describe it or give an example",
    ],
    evidenceDimensions: [
      "main_point_clarity",
      "relevant_context",
      "useful_example",
    ],
    antiPatterns: [
      "Do not stop the whole explanation to search for one perfect word.",
      "Do not add descriptions that cannot help identify the idea.",
    ],
    exampleConstraints: [
      "Demonstrate communication without the missing exact word.",
      "Use familiar descriptive language.",
    ],
  },
] as const satisfies readonly TechniqueFamily[];

const TECHNIQUE_FAMILY_BY_ID = new Map(
  TECHNIQUE_FAMILIES.map((family) => [family.id, family]),
);

export function getTechniqueFamily(
  id: TechniqueFamilyId,
): TechniqueFamily {
  const family = TECHNIQUE_FAMILY_BY_ID.get(id);
  if (!family) {
    throw new Error(`Unknown communication technique family: ${id}`);
  }
  return family;
}

export function isTechniqueCompatible(input: {
  familyId: TechniqueFamilyId;
  primarySkill: CommunicationSkill;
  targetBehavior?: TargetBehavior;
  targetBehaviors?: readonly TargetBehavior[];
}): boolean {
  const family = getTechniqueFamily(input.familyId);
  const targetBehaviors =
    input.targetBehaviors ??
    (input.targetBehavior === undefined ? [] : [input.targetBehavior]);
  return (
    family.applicableSkills.includes(input.primarySkill) &&
    targetBehaviors.some((behavior) =>
      family.applicableBehaviors.includes(behavior),
    )
  );
}

export function compatibleTechniqueFamilies(input: {
  primarySkill: CommunicationSkill;
  targetBehavior?: TargetBehavior;
  targetBehaviors?: readonly TargetBehavior[];
}): TechniqueFamily[] {
  const targetBehaviors =
    input.targetBehaviors ??
    (input.targetBehavior === undefined ? [] : [input.targetBehavior]);

  return TECHNIQUE_FAMILIES.filter((family) =>
    isTechniqueCompatible({
      familyId: family.id,
      primarySkill: input.primarySkill,
      targetBehaviors,
    }),
  ).sort((left, right) => {
    const coverage = (family: TechniqueFamily) =>
      targetBehaviors.filter((behavior) =>
        family.applicableBehaviors.includes(behavior),
      ).length;
    return coverage(right) - coverage(left);
  });
}
