import {
  desiredImpressionLabel,
  practiceContextLabel,
  targetBehaviorsLabel,
  type ActiveCommunicationSkill,
  type CommunicationSkill,
  type DesiredImpression,
  type EvidenceDimension,
  type PracticeContext,
  type TargetBehavior,
} from "@/lib/coaching/product-rules";
import {
  fallbackScenarioFor,
  type FallbackScenario,
} from "@/lib/coaching/fallback-scenarios";
import { guidedSituationSummary } from "@/lib/coaching/custom-situation";
import {
  compatibleTechniqueFamilies,
  getTechniqueFamily,
  type TechniqueFamily,
  type TechniqueFamilyId,
} from "@/lib/coaching/technique-library";
import {
  practicePlanSchema,
  practiceSetupSchema,
  type PracticePlan,
  type PracticeSetup,
} from "@/lib/coaching/schemas";

const TECHNIQUE_FOR_BEHAVIOR = {
  tell_in_logical_order: "situation_action_result",
  explain_how_it_works: "sequence_signposts",
  describe_problem_and_causes: "context_problem_impact_attempt_need",
  give_reasons_for_decision_or_opinion: "opinion_reason_example",
  give_natural_first_reaction: "notice_react_continue",
  show_empathy_or_enthusiasm: "notice_react_continue",
  add_short_comment_or_related_thought: "notice_react_continue",
  ask_natural_follow_up: "echo_explore_connect",
  ask_open_ended_question: "open_followup_clarify",
  ask_useful_follow_up: "echo_explore_connect",
  ask_for_clarification_or_example: "open_followup_clarify",
  understand_another_perspective: "echo_explore_connect",
  share_opinion_and_reason: "opinion_reason_example",
  describe_feeling_and_cause: "feeling_cause_need",
  share_experience_and_meaning: "situation_action_result",
  explain_preference_plan_or_decision: "opinion_reason_example",
  state_opinion_confidently: "acknowledge_position_suggestion",
  make_clear_request: "observation_impact_request",
  disagree_respectfully: "acknowledge_position_suggestion",
  set_boundary_or_say_no: "observation_impact_request",
  raise_problem_without_blaming: "observation_impact_request",
  repair_tension_and_next_step: "echo_explore_connect",
  respond_to_defensiveness: "echo_explore_connect",
  apologize_or_repair: "echo_explore_connect",
  work_toward_practical_agreement: "main_point_reason_next_step",
} as const satisfies Record<TargetBehavior, TechniqueFamilyId>;

const SUPPORTING_EVIDENCE_BY_SKILL = {
  explaining_clearly: [
    "main_point_clarity",
    "logical_order",
    "relevant_context",
  ],
  responding_naturally: [
    "listening_acknowledgment",
    "personal_meaning",
    "follow_up_question",
  ],
  asking_better_questions: [
    "open_question",
    "follow_up_question",
    "clarification",
  ],
  expressing_yourself: [
    "opinion_reasoning",
    "emotional_expression",
    "personal_meaning",
  ],
  speaking_assertively: [
    "direct_request",
    "respectful_disagreement",
    "boundary_clarity",
  ],
  handling_difficult_conversation: [
    "issue_description",
    "listening_acknowledgment",
    "solution_movement",
  ],
} as const satisfies Record<
  CommunicationSkill,
  readonly EvidenceDimension[]
>;

const IMPRESSION_CUES = {
  calm_confident: [
    "The learner uses a steady structure instead of rushing.",
    "The learner avoids unnecessary apologies.",
  ],
  warm_approachable: [
    "The learner acknowledges the other person's point.",
    "The learner uses considerate, interested wording.",
  ],
  natural_relaxed: [
    "The learner uses conversational transitions.",
    "The response sounds flexible rather than memorized.",
  ],
  direct_respectful: [
    "The main point appears early.",
    "The wording stays clear and neutral.",
  ],
  thoughtful_composed: [
    "The learner takes time to organize the response.",
    "The learner gives a useful qualification without losing the main point.",
  ],
  professional_prepared: [
    "The learner gives relevant context or an example.",
    "The response uses appropriate formality and a clear outcome.",
  ],
} as const satisfies Record<DesiredImpression, readonly string[]>;

type Challenge = PracticePlan["challenge"];

const CHALLENGE_BY_SKILL = {
  explaining_clearly: {
    kind: "clarification_request",
    triggerCondition:
      "The learner leaves one important part of the explanation unclear.",
    behavior:
      "Ask one concise clarification question about the missing point.",
    repairCondition:
      "The learner adds the missing context, order, reason, or example.",
  },
  responding_naturally: {
    kind: "shared_update",
    triggerCondition:
      "The learner has responded to one meaningful detail from the partner.",
    behavior:
      "Share one additional ordinary detail with a clear positive, difficult, or surprising tone.",
    repairCondition:
      "The learner acknowledges the new detail with a proportionate reaction, comment, or natural follow-up.",
  },
  asking_better_questions: {
    kind: "brief_answer",
    triggerCondition:
      "The learner asks a relevant question that the partner can answer briefly.",
    behavior:
      "Give a short but meaningful answer with one detail available to explore.",
    repairCondition:
      "The learner follows the detail with a relevant question or clarification.",
  },
  expressing_yourself: {
    kind: "alternative_perspective",
    triggerCondition:
      "The learner has shared an understandable opinion, feeling, or preference.",
    behavior:
      "Offer one mild alternative perspective without dismissing the learner.",
    repairCondition:
      "The learner explains their meaning, reason, or personal perspective.",
  },
  speaking_assertively: {
    kind: "mild_resistance",
    triggerCondition:
      "The learner states a need, request, disagreement, problem, boundary, or repair attempt.",
    behavior:
      "Raise one realistic concern instead of immediately agreeing.",
    repairCondition:
      "The learner restates the point respectfully or proposes a practical option.",
  },
  handling_difficult_conversation: {
    kind: "mild_defensiveness",
    triggerCondition:
      "The learner raises the issue or asks to repair it.",
    behavior:
      "Respond with mild defensiveness while remaining willing to listen.",
    repairCondition:
      "The learner acknowledges the concern and moves the conversation toward repair or agreement.",
  },
} as const satisfies Record<CommunicationSkill, Challenge>;

const CONTEXT_EXAMPLES = {
  everyday_situations: {
    main_point_reason_next_step:
      "I’d prefer to meet in the afternoon because my morning is busy. Could we choose a time after two?",
    opinion_reason_example:
      "I think a simple plan would be better because we’ll have more time to relax. For example, we could meet for coffee and then take a walk.",
    situation_action_result:
      "Last weekend, we changed our plan at the last minute. I checked which times worked for everyone, and we found an easier option.",
    context_problem_impact_attempt_need:
      "We still haven’t decided the time, so it’s difficult for me to plan my day. I checked my schedule, and I need us to choose a time today.",
    observation_impact_request:
      "The plan has changed twice, and it makes my schedule difficult to organize. Could we confirm one time today?",
    acknowledge_position_suggestion:
      "I understand that you prefer the morning. The afternoon works better for me, so could we meet at two?",
    notice_react_continue:
      "Oh, that sounds frustrating. I can see why the last-minute change bothered you. What happened after that?",
    open_followup_clarify:
      "What would make the plan enjoyable for you? You mentioned being outdoors—what kind of place did you have in mind?",
    echo_explore_connect:
      "You said you want something relaxing. What does a relaxing day look like for you, and how could we include that?",
    sequence_signposts:
      "First, we choose the place. Then, we agree on a time. Finally, we confirm how we’re getting there.",
    feeling_cause_need:
      "I feel a little frustrated because the plan keeps changing. I need us to decide so I can organize the rest of my day.",
    circumlocution_category_purpose_example:
      "It’s a small device you use to charge your phone when there isn’t an electrical outlet nearby—like a portable battery.",
  },
  work: {
    main_point_reason_next_step:
      "I think we should handle the client update first because it affects tomorrow’s meeting. Could we move the internal notes to the afternoon?",
    opinion_reason_example:
      "I think the client update should come first because it affects the rest of the project. For example, the design team needs that decision before continuing.",
    situation_action_result:
      "Last month, two deadlines overlapped. I listed the dependencies, spoke with the team, and we agreed on a new order.",
    context_problem_impact_attempt_need:
      "Three tasks are due at the same time, which makes the priority unclear. I reviewed the deadlines, and I need us to agree on which task comes first.",
    observation_impact_request:
      "The priorities changed twice this week, and that is delaying my work. Could we confirm the first task before the meeting?",
    acknowledge_position_suggestion:
      "I understand why the report feels urgent. I think the client update has a bigger immediate impact, so I suggest we finish that first.",
    notice_react_continue:
      "That’s a lot to manage at once. It makes sense that the changing priorities are frustrating. Has your manager clarified what comes first?",
    open_followup_clarify:
      "Which deadline has the greatest impact on the client? You mentioned the Friday meeting—what needs to be ready for it?",
    echo_explore_connect:
      "You said the client update is urgent. What could happen if it is late, and how should that affect our priorities?",
    sequence_signposts:
      "First, I check the deadlines. Then, I identify the tasks that depend on others. Finally, I confirm the priority with the team.",
    feeling_cause_need:
      "I feel concerned because the priorities are still changing. I need a clear order so I can focus on the right task.",
    circumlocution_category_purpose_example:
      "It’s a project document that shows when each task should begin and finish—similar to a visual schedule.",
  },
  family_relationships: {
    main_point_reason_next_step:
      "I’d like a shorter visit because I need some time to rest this weekend. Could we have lunch together instead of spending the whole day?",
    opinion_reason_example:
      "I think a shorter visit would work better because everyone has a busy weekend. For example, we could have lunch and still spend meaningful time together.",
    situation_action_result:
      "The last time we planned a visit, our schedules were different. I suggested a shorter meal, and everyone was able to come.",
    context_problem_impact_attempt_need:
      "We have different ideas about the visit, and the uncertainty is making it hard to plan. I checked my schedule, and I need us to choose a shorter time.",
    observation_impact_request:
      "The plan has become much longer than we first discussed, and I need time for my other responsibilities. Could we keep the visit to a few hours?",
    acknowledge_position_suggestion:
      "I understand that you want everyone to stay longer. I need a shorter visit this time, so I suggest we have lunch together.",
    notice_react_continue:
      "Oh, I’m sorry the message came across that way. I can understand why it felt dismissive. What part bothered you most?",
    open_followup_clarify:
      "What matters most to you about the visit? You mentioned having more time together—what would you most like us to do?",
    echo_explore_connect:
      "You said the visit feels too short. What are you worried we might miss, and how could we make the time feel meaningful?",
    sequence_signposts:
      "First, we agree on the day. Then, we decide how long the visit will be. Finally, we tell everyone the plan.",
    feeling_cause_need:
      "I feel a little pressured because the plan is becoming bigger than I expected. I need a simpler visit this time.",
    circumlocution_category_purpose_example:
      "It’s a dish that everyone brings food to share in, so one person does not have to prepare the whole meal.",
  },
  job_interviews: {
    main_point_reason_next_step:
      "My strongest experience is coordinating busy projects because I’m good at making priorities clear. I’d be happy to explain a recent example.",
    opinion_reason_example:
      "I prefer collaborative teams because people can solve problems earlier. For example, a short weekly check-in helped my last team avoid delays.",
    situation_action_result:
      "In my previous role, two deadlines changed unexpectedly. I reorganized the priorities with my manager, and we completed the client work on time.",
    context_problem_impact_attempt_need:
      "Our team had two urgent deadlines, and the overlap was causing delays. I mapped the dependencies, asked my manager to confirm the priority, and then reorganized the work.",
    observation_impact_request:
      "I noticed that the role includes several competing priorities. Could you explain how the team normally decides which one comes first?",
    acknowledge_position_suggestion:
      "I understand that the role requires independence. I also believe early clarification prevents mistakes, so I would confirm priorities when the impact is significant.",
    notice_react_continue:
      "That sounds like an exciting period of growth for the team. I’d be interested to hear what has changed most in the role.",
    open_followup_clarify:
      "How does the team define success in the first three months? You mentioned improving a process—which process needs the most attention?",
    echo_explore_connect:
      "You mentioned that the team is growing quickly. What communication challenge has that created, and how could this role help?",
    sequence_signposts:
      "First, I review the goal. Then, I organize the most important tasks. Finally, I confirm the outcome with the people involved.",
    feeling_cause_need:
      "I felt proud of that project because the team trusted me with more responsibility. It showed me that I want a role where I can keep developing.",
    circumlocution_category_purpose_example:
      "It was a system the team used to organize customer requests and track what still needed a response.",
  },
  personal_decisions: {
    main_point_reason_next_step:
      "I’m considering changing my routine because I want more time for an important goal. My next step is to test the new schedule for one week.",
    opinion_reason_example:
      "I think the change could be good for me because my current routine leaves little time for my goals. For example, I keep postponing the same personal project.",
    situation_action_result:
      "A few months ago, I tried changing my morning routine. I prepared everything the night before, and I had more focused time the next day.",
    context_problem_impact_attempt_need:
      "My current routine leaves very little personal time, and I keep postponing an important goal. I tried small changes, and now I need a more consistent plan.",
    observation_impact_request:
      "I’ve noticed that I keep postponing this decision, and the uncertainty is making me feel stuck. Could you help me compare the two options?",
    acknowledge_position_suggestion:
      "I understand why staying with the familiar option feels safer. I think the change could help me grow, so I want to test it gradually.",
    notice_react_continue:
      "That sounds like a difficult choice. I can see why stability matters to you, but the new option also sounds meaningful. What feels most uncertain?",
    open_followup_clarify:
      "What would improve most if I made this change? You mentioned having more time—how would I want to use it?",
    echo_explore_connect:
      "You said stability matters to you. What part of the change feels least stable, and what could make it more manageable?",
    sequence_signposts:
      "First, I compare the two options. Then, I choose one small experiment. Finally, I review what worked before making a final decision.",
    feeling_cause_need:
      "I feel uncertain because both options have real benefits. I need a little time and a small experiment before I decide.",
    circumlocution_category_purpose_example:
      "It’s a method for comparing choices by writing the advantages and disadvantages of each one.",
  },
} as const satisfies Record<
  Exclude<
    PracticeContext,
    "coworkers_teamwork" | "managers_feedback" | "customers_clients"
  >,
  Record<TechniqueFamilyId, string>
>;

function chooseSupportingDimension(
  supportingSkill: CommunicationSkill | null,
  primaryDimensions: readonly EvidenceDimension[],
): EvidenceDimension | null {
  if (supportingSkill === null) {
    return null;
  }

  return (
    SUPPORTING_EVIDENCE_BY_SKILL[supportingSkill].find(
      (dimension) => !primaryDimensions.includes(dimension),
    ) ?? null
  );
}

function techniqueExample(input: {
  setup: PracticeSetup;
  family: TechniqueFamily;
}): string {
  const exampleContext =
    input.setup.context === "coworkers_teamwork" ||
    input.setup.context === "managers_feedback" ||
    input.setup.context === "customers_clients"
      ? "work"
      : input.setup.context;
  const fallback = CONTEXT_EXAMPLES[exampleContext][input.family.id];

  if (input.setup.situationMode === "choose_for_me") {
    return fallback;
  }

  const situationSummary = input.setup.situationDetail
    ? guidedSituationSummary(input.setup.situationDetail).slice(0, 110)
    : "your situation";
  return `For “${situationSummary},” adapt this pattern: ${fallback}`;
}

function sessionGoal(setup: PracticeSetup): string {
  const behaviors = targetBehaviorsLabel(
    setup.primarySkill,
    setup.targetBehaviors,
  ).toLowerCase();
  const context = practiceContextLabel(setup.context).toLowerCase();
  const impression =
    setup.desiredImpression === null
      ? ""
      : ` while coming across as ${desiredImpressionLabel(
          setup.desiredImpression,
        ).toLowerCase()}`;

  return `Practice how to ${behaviors} in ${context}${impression}.`;
}

function learnerCue(input: {
  setup: PracticeSetup;
  scenario: FallbackScenario;
}): string {
  const behaviors = targetBehaviorsLabel(
    input.setup.primarySkill,
    input.setup.targetBehaviors,
  ).toLowerCase();
  const situation =
    input.scenario.situation.length > 210
      ? `${input.scenario.situation.slice(0, 207)}...`
      : input.scenario.situation;

  return `Speak with ${input.scenario.roleLabel.toLowerCase()} and practice these goals: ${behaviors}. Situation: ${situation}`;
}

function retryCriteria(
  family: TechniqueFamily,
): [string, string] {
  return [
    `Use the technique's first step: ${family.stepPattern[0].toLowerCase()}.`,
    `Connect it clearly to the next step: ${family.stepPattern[1].toLowerCase()}.`,
  ];
}

const SELF_DISCOVERY_PROMPTS = {
  explaining_clearly: [
    "Small choices can say a lot about what matters to us. What influenced a decision you made recently, and why did it matter to you?",
    "Changing a habit can be difficult, especially when it is part of everyday life. Is there one habit you would like to change, and what makes that change important to you?",
  ],
  responding_naturally: [
    "People often connect success with always being busy, but I’m not sure I agree anymore. Rest has started to feel just as important to me.",
    "I used to think changing my mind meant I had been wrong. Now I see it as a sign that I learned something new.",
  ],
  expressing_yourself: [
    "I’ve noticed that free time feels better when I choose how to use it instead of filling it with more tasks. How do you like to spend time that is completely your own?",
    "People who know us well sometimes notice changes before we do. Looking at the last few years, what change in yourself feels most noticeable?",
    "I sometimes wonder whether other people see my personality the same way I do. How would you like the people close to you to describe you?",
    "My calendar was full last week, but none of the things on it felt especially important to me. I decided to protect one evening for myself. Looking at your own priorities, what would you make more time for?",
    "My family has a tradition that I enjoy, although I would change parts of it. Keeping some of it still makes me feel connected. Is there a family tradition or value you would want to keep, change, or create?",
    "Supporting someone can feel difficult when you also need time or rest for yourself. How do you try to balance caring for others with caring for yourself?",
    "I spent time with people who let me be quiet without asking what was wrong. I felt completely comfortable around them. What helps you feel that you can be yourself with someone?",
    "I’ve realized that my idea of success has more to do with time, freedom, and close relationships than job titles. What does a successful life mean to you?",
    "I sometimes agree to help before thinking about the time or energy I have available. What kind of boundary helps you protect your time?",
    "Looking back can make personal growth easier to notice than it feels day to day. What change in yourself are you most aware of now?",
    "A friend shared an opinion I used to agree with, and I noticed my view had changed. I could finally explain why it no longer felt right to me. Is there an opinion or belief you see differently now?",
    "I watched someone stay patient with a frustrated customer when everyone else was becoming impatient. I immediately respected the way she handled it. What quality in another person tends to earn your respect?",
  ],
  speaking_assertively: [
    "Boundaries can make relationships clearer, even when they feel awkward to express. What is one boundary that matters to you, and how would you communicate it?",
    "Sometimes we say yes before thinking about what we really want. What could you say next time you would rather decline?",
  ],
} as const satisfies Record<ActiveCommunicationSkill, readonly string[]>;

const RELATABLE_SINGLE_PROMPTS = {
  everyday_situations: {
    explaining_clearly: [
      "I’ve noticed that people organize busy days in very different ways. I usually start with the most urgent thing. How do you decide what needs your attention first?",
      "When I learn something new, it helps when someone explains it in a simple order. How do you usually learn or explain a new task?",
    ],
    responding_naturally: [
      "I decided to turn down a plan this weekend because I really needed time to rest. I felt a little guilty at first, but I’m glad I did.",
      "A friend recently disagreed with me about something important, but the conversation stayed respectful. I actually felt closer to them afterward.",
    ],
    expressing_yourself: [
      "I’ve noticed that a quiet weekend can feel better than a busy one, even when nothing exciting happens. What kind of weekend leaves you feeling good?",
      "I think friendships feel easier when people can be honest without making everything serious. What makes a friendship feel comfortable to you?",
    ],
    speaking_assertively: [
      "I know we already made plans, but I need to change the time again. I hope that still works for you.",
      "I know you said you needed some time to yourself. I’d really like you to come with us anyway.",
    ],
  },
  work: {
    explaining_clearly: [
      "People organize busy workdays in very different ways. I usually begin with the task that affects others first. How do you decide what to prioritize at work?",
      "I sometimes find it difficult to explain a decision when several options seem reasonable. How do you usually explain why you chose one approach?",
    ],
    responding_naturally: [
      "I finally told my manager that my workload was becoming difficult to manage. I expected an awkward conversation, but they listened and helped me reprioritize.",
      "A coworker gave me feedback I wasn’t expecting. My first reaction was defensive, but later I realized that part of it was useful.",
    ],
    expressing_yourself: [
      "I think work feels more satisfying when people understand why their effort matters. What makes work feel meaningful to you?",
      "I’ve noticed that the people around us can change how we feel about a job. What kind of work environment helps you feel comfortable?",
    ],
    speaking_assertively: [
      "I know you already have several tasks, but I need you to take on one more today. I realize that is a lot to ask.",
      "I don’t agree with your suggestion. I think we should keep doing things the way we do now.",
    ],
  },
} as const satisfies Record<
  "everyday_situations" | "work",
  Record<ActiveCommunicationSkill, readonly string[]>
>;

function singlePromptOpening(input: {
  setup: PracticeSetup;
  scenario: FallbackScenario;
  variationSeed?: string;
}): string {
  const seed = [...(input.variationSeed ?? input.scenario.id)].reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );
  if (
    input.setup.context === "everyday_situations" ||
    input.setup.context === "work"
  ) {
    const prompts =
      RELATABLE_SINGLE_PROMPTS[input.setup.context][
        input.setup.primarySkill as ActiveCommunicationSkill
      ];
    return prompts[seed % prompts.length];
  }
  if (input.setup.context !== "personal_decisions") {
    return input.scenario.partnerOpeningText;
  }
  const prompts =
    SELF_DISCOVERY_PROMPTS[
      input.setup.primarySkill as ActiveCommunicationSkill
    ];
  return prompts[seed % prompts.length];
}

export function buildDeterministicPracticePlan(
  input: unknown,
  options: {
    variationSeed?: string;
    avoidSituations?: readonly string[];
    singlePrompt?: boolean;
  } = {},
): PracticePlan {
  const setup = practiceSetupSchema.parse(input);
  const family =
    setup.targetBehaviors.length === 1
      ? getTechniqueFamily(TECHNIQUE_FOR_BEHAVIOR[setup.targetBehavior])
      : (compatibleTechniqueFamilies({
          primarySkill: setup.primarySkill,
          targetBehaviors: setup.targetBehaviors,
        })[0] ?? getTechniqueFamily(TECHNIQUE_FOR_BEHAVIOR[setup.targetBehavior]));
  const scenario = fallbackScenarioFor({
    context: setup.context,
    primarySkill: setup.primarySkill,
    customSituation: setup.situationDetail,
    variationSeed: options.variationSeed,
    avoidSituations: options.avoidSituations,
  });
  const primaryDimensions = family.evidenceDimensions.slice(0, 3);
  const promptText = options.singlePrompt
    ? singlePromptOpening({
        setup,
        scenario,
        variationSeed: options.variationSeed,
      })
    : scenario.partnerOpeningText;

  return practicePlanSchema.parse({
    schemaVersion: 1,
    setup,
    situation: scenario.situation,
    sessionGoal: sessionGoal(setup),
    partner: {
      roleLabel: scenario.roleLabel,
      relationshipToLearner: scenario.relationshipToLearner,
      immediateGoal: scenario.immediateGoal,
      knownFacts: [
        ...scenario.knownFacts,
        ...(options.singlePrompt && /\b(?:I|my|me)\b/i.test(promptText)
          ? [
              "The temporary practice partner owns the first-person experience and reaction stated in the opening; those facts exist only for this prompt.",
            ]
          : []),
      ],
      unknownFacts: [...scenario.unknownFacts],
      baselineTone: scenario.baselineTone,
      prohibitedBehavior: [
        "Do not teach, evaluate, or correct the learner while acting as the simulation partner.",
        "Do not invent personal facts, sensitive history, or unstated motives for the learner.",
        "Do not introduce more than one challenge or keep resisting after the learner repairs the moment.",
      ],
    },
    opening: {
      speaker: "partner",
      learnerCue: learnerCue({ setup, scenario }),
      partnerOpeningText: promptText,
      rationale:
        options.singlePrompt
          ? "The text prompt gives the learner one clear conversational moment to answer aloud."
          : "The partner starts with clear conversational context so the learner has something natural to respond to.",
    },
    technique: {
      familyId: family.id,
      title: family.title,
      whyItFits: `This structure helps you ${targetBehaviorsLabel(
        setup.primarySkill,
        setup.targetBehaviors,
      ).toLowerCase()} without trying to plan every sentence.`,
      steps: family.stepPattern.slice(0, 3),
      example: techniqueExample({ setup, family }),
    },
    challenge: CHALLENGE_BY_SKILL[setup.primarySkill],
    evidenceRubric: {
      primaryDimensions,
      supportingDimension: chooseSupportingDimension(
        setup.supportingSkill,
        primaryDimensions,
      ),
      desiredImpressionCues:
        setup.desiredImpression === null
          ? []
          : [...IMPRESSION_CUES[setup.desiredImpression]],
    },
    retryCriteria: retryCriteria(family),
    safetyConstraints: [
      "Keep the scenario low stakes and suitable for ordinary communication practice.",
      "Keep disagreement mild, respectful, and possible to repair.",
      "Do not introduce crisis, violence, medical, legal, or financial advice.",
    ],
    prohibitedAssumptions: [
      "Do not infer the learner's identity, personality, confidence, relationships, or work history.",
      "Use only the setup and facts the learner states during the simulation.",
    ],
  });
}

export function deterministicTechniqueFor(
  behavior: TargetBehavior,
): TechniqueFamilyId {
  return TECHNIQUE_FOR_BEHAVIOR[behavior];
}
