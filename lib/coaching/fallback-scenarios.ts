import type {
  CommunicationSkill,
  PracticeContext,
} from "@/lib/coaching/product-rules";
import {
  guidedSituationForBrief,
  guidedSituationPartnerRole,
  parseGuidedSituationDetail,
} from "@/lib/coaching/custom-situation";

export type FallbackScenario = {
  id: string;
  situation: string;
  roleLabel: string;
  relationshipToLearner: string;
  immediateGoal: string;
  knownFacts: readonly string[];
  unknownFacts: readonly string[];
  baselineTone: string;
  partnerOpeningText: string;
};

const CONTEXT_SCENARIOS = {
  coworkers_teamwork: [
    {
      id: "coworker_project_handoff",
      situation:
        "You and a coworker are clarifying responsibilities after an important project detail was missed during a handoff.",
      roleLabel: "Your coworker",
      relationshipToLearner:
        "A coworker who shares responsibility for the project handoff.",
      immediateGoal:
        "Understand what was missed and agree on a clearer way to share updates.",
      knownFacts: [
        "An important project detail was missed during a handoff.",
        "Both people need a more reliable process.",
      ],
      unknownFacts: [
        "What the learner communicated.",
        "What change the learner prefers.",
      ],
      baselineTone: "Professional, mildly concerned, and cooperative.",
      partnerOpeningText:
        "I think we lost an important detail during the handoff. How did you understand the plan?",
    },
    {
      id: "coworker_shared_priorities",
      situation:
        "You and a coworker are deciding how to divide several overlapping tasks before a shared deadline.",
      roleLabel: "Your coworker",
      relationshipToLearner:
        "A coworker sharing responsibility for several project tasks.",
      immediateGoal:
        "Understand the learner's priorities and agree on a practical division of work.",
      knownFacts: [
        "Several tasks overlap before one deadline.",
        "The division of work is not yet clear.",
      ],
      unknownFacts: [
        "Which tasks the learner prefers to handle.",
        "What division the learner considers fair.",
      ],
      baselineTone: "Busy, collaborative, and open to a practical plan.",
      partnerOpeningText:
        "We have several things due at the same time. How do you think we should divide them?",
    },
  ],
  managers_feedback: [
    {
      id: "manager_priority_clarification",
      situation:
        "You are speaking with your manager because two urgent assignments have the same deadline and you need clearer priorities.",
      roleLabel: "Your manager",
      relationshipToLearner:
        "A manager responsible for clarifying the learner's work priorities.",
      immediateGoal:
        "Understand the conflict and decide which assignment should come first.",
      knownFacts: [
        "Two assignments currently have the same deadline.",
        "The learner needs a clear priority.",
      ],
      unknownFacts: [
        "Which assignment the learner thinks should come first.",
        "What work the learner has already completed.",
      ],
      baselineTone: "Professional, busy, and willing to clarify.",
      partnerOpeningText:
        "Two urgent assignments have the same deadline. Which conflict do you need me to clarify first?",
    },
    {
      id: "manager_feedback_discussion",
      situation:
        "Your manager has given you brief feedback about a recent task, and you want to understand it and discuss your next step.",
      roleLabel: "Your manager",
      relationshipToLearner:
        "A manager discussing recent work and expectations with the learner.",
      immediateGoal:
        "Clarify the feedback and agree on one useful next step.",
      knownFacts: [
        "The manager gave brief feedback about a recent task.",
        "The next expectation has not been fully clarified.",
      ],
      unknownFacts: [
        "How the learner interpreted the feedback.",
        "What clarification the learner needs.",
      ],
      baselineTone: "Direct, professional, and open to questions.",
      partnerOpeningText:
        "I know my feedback was brief. What would you like me to explain more clearly?",
    },
  ],
  customers_clients: [
    {
      id: "client_request_clarification",
      situation:
        "A client has made an unclear request, and you need to confirm what outcome they expect before continuing.",
      roleLabel: "Your client",
      relationshipToLearner:
        "A client whose request needs one practical clarification.",
      immediateGoal:
        "Explain the request and confirm the expected result.",
      knownFacts: [
        "The client's original request could be understood in more than one way.",
        "Work should not continue until the expected result is clear.",
      ],
      unknownFacts: [
        "How the learner interpreted the request.",
        "Which clarification the learner will ask for.",
      ],
      baselineTone: "Professional, slightly impatient, and willing to clarify.",
      partnerOpeningText:
        "I thought my request was clear, but it sounds like you need more information. What do you need to confirm?",
    },
    {
      id: "customer_service_problem",
      situation:
        "A customer is disappointed with a service delay, and you need to acknowledge the concern and explain what can happen next.",
      roleLabel: "A customer",
      relationshipToLearner:
        "A customer asking for help with an ordinary service delay.",
      immediateGoal:
        "Understand the available solution and what will happen next.",
      knownFacts: [
        "The customer's service has been delayed.",
        "The customer wants a clear next step.",
      ],
      unknownFacts: [
        "What solution the learner can offer.",
        "What caused the delay.",
      ],
      baselineTone: "Disappointed but respectful and willing to listen.",
      partnerOpeningText:
        "I’ve been waiting longer than expected, and I’m not sure what is happening. Can you explain?",
    },
  ],
  everyday_situations: [
    {
      id: "everyday_shared_plan",
      situation:
        "You and a friend are making a weekend plan, but the timing and responsibilities are still unclear.",
      roleLabel: "Your friend",
      relationshipToLearner: "A friend making an ordinary plan with the learner.",
      immediateGoal: "Understand the learner's preference and agree on a practical plan.",
      knownFacts: ["Both people want to make a plan.", "The details have not been decided."],
      unknownFacts: ["What the learner prefers.", "Which part of the plan matters most."],
      baselineTone: "Friendly, informal, and willing to cooperate.",
      partnerOpeningText: "I’m still free this weekend, but we haven’t decided what to do. What sounds good to you?",
    },
    {
      id: "everyday_package_mixup",
      situation:
        "You are talking with a neighbor after a delivery was left at the wrong apartment, and you want to sort out what happened.",
      roleLabel: "Your neighbor",
      relationshipToLearner: "A neighbor involved in an ordinary delivery mix-up.",
      immediateGoal: "Understand what happened and agree on a simple way to handle future deliveries.",
      knownFacts: ["A package was left at the wrong apartment.", "Neither person wants the problem to repeat."],
      unknownFacts: ["What the learner saw or did.", "What solution the learner prefers."],
      baselineTone: "Casual, slightly confused, and cooperative.",
      partnerOpeningText: "Hey, I think one of your packages ended up outside my door yesterday. Do you know what happened?",
    },
    {
      id: "everyday_class_routine",
      situation:
        "A classmate missed a community class and asks you to explain the routine and what they need to bring next time.",
      roleLabel: "Your classmate",
      relationshipToLearner: "A classmate who missed one ordinary session.",
      immediateGoal: "Understand the routine well enough to join the next class.",
      knownFacts: ["The classmate missed the last class.", "There is a simple routine to explain."],
      unknownFacts: ["Which details the learner considers important.", "What the learner remembers about the class."],
      baselineTone: "Relaxed, interested, and appreciative.",
      partnerOpeningText: "I missed the class this week. Can you walk me through what usually happens?",
    },
    {
      id: "everyday_cafe_choice",
      situation:
        "You and a friend are choosing somewhere to meet, but you want different things from the place.",
      roleLabel: "Your friend",
      relationshipToLearner: "A friend choosing an ordinary place to meet.",
      immediateGoal: "Understand both preferences and choose a place that works.",
      knownFacts: ["Both people want to meet.", "Their preferences are different."],
      unknownFacts: ["Why the learner prefers one option.", "What compromise would work."],
      baselineTone: "Friendly, spontaneous, and open to suggestions.",
      partnerOpeningText: "I was thinking of that busy café downtown, but you didn’t sound convinced. What kind of place did you have in mind?",
    },
  ],
  work: [
    {
      id: "work_project_priorities",
      situation: "You and a coworker are discussing an upcoming project with overlapping tasks and unclear priorities.",
      roleLabel: "Your coworker",
      relationshipToLearner: "A coworker who shares responsibility for part of the project.",
      immediateGoal: "Understand the learner's view and agree on the next project priority.",
      knownFacts: ["Several project tasks overlap.", "The order of the tasks has not been agreed."],
      unknownFacts: ["Which task the learner considers most urgent.", "What solution the learner wants to raise."],
      baselineTone: "Professional, busy, and open to a practical discussion.",
      partnerOpeningText: "We’ve got a few things competing for attention. Which one do you think needs to happen first?",
    },
    {
      id: "work_shift_handoff",
      situation: "You are discussing a confusing handoff with a coworker after important information was missed between shifts.",
      roleLabel: "Your coworker",
      relationshipToLearner: "A coworker involved in the same shift handoff.",
      immediateGoal: "Clarify what was missed and agree on a better handoff next time.",
      knownFacts: ["Some information was missed during a handoff.", "The issue can be fixed with a clearer process."],
      unknownFacts: ["What the learner communicated.", "What change the learner wants."],
      baselineTone: "Professional, mildly concerned, and solution-focused.",
      partnerOpeningText: "I think we missed an important detail during yesterday’s handoff. How did you understand the plan?",
    },
    {
      id: "work_meeting_proposal",
      situation: "You want to propose a small change to how your team runs a regular meeting.",
      roleLabel: "Your team lead",
      relationshipToLearner: "A team lead listening to a practical process suggestion.",
      immediateGoal: "Understand the proposed change, its reason, and whether it is workable.",
      knownFacts: ["The team has a regular meeting.", "The learner wants to suggest one change."],
      unknownFacts: ["What change the learner wants.", "What benefit the learner expects."],
      baselineTone: "Attentive, practical, and willing to consider a useful idea.",
      partnerOpeningText: "Our weekly meeting has not been working as well as it could. What change would you suggest?",
    },
    {
      id: "work_client_request",
      situation: "You and a coworker interpreted a client request differently and need to decide what to clarify before continuing.",
      roleLabel: "Your coworker",
      relationshipToLearner: "A coworker working on the same client request.",
      immediateGoal: "Compare interpretations and agree on one useful clarification.",
      knownFacts: ["The client request is ambiguous.", "Continuing without clarification could waste work."],
      unknownFacts: ["How the learner interpreted the request.", "What question the learner wants to ask."],
      baselineTone: "Focused, collaborative, and slightly uncertain.",
      partnerOpeningText: "I’m not sure we understood the client’s request the same way. What do you think they’re asking for?",
    },
  ],
  family_relationships: [
    {
      id: "family_visit_plans",
      situation: "You and a family member are discussing an upcoming family visit, and you have different preferences about the plan.",
      roleLabel: "Your family member",
      relationshipToLearner: "A family member involved in planning an upcoming visit.",
      immediateGoal: "Understand the learner's preference and reach a respectful plan.",
      knownFacts: ["A family visit is being planned.", "The two people have different preferences."],
      unknownFacts: ["Why the learner prefers a different plan.", "What compromise the learner would consider."],
      baselineTone: "Familiar and caring, with mild disagreement.",
      partnerOpeningText: "I know we don’t completely agree about the visit. What would work better for you?",
    },
    {
      id: "family_shared_responsibility",
      situation: "You want to discuss an everyday family responsibility that has recently felt uneven.",
      roleLabel: "Your family member",
      relationshipToLearner: "A family member who shares an ordinary responsibility.",
      immediateGoal: "Understand the concern and agree on a fair practical change.",
      knownFacts: ["A responsibility is shared.", "The current arrangement is not working well for the learner."],
      unknownFacts: ["What feels uneven.", "What change the learner wants."],
      baselineTone: "Familiar, initially surprised, and open to discussion.",
      partnerOpeningText: "You said you wanted to talk about how we’ve been dividing things. What’s been bothering you?",
    },
    {
      id: "family_celebration_choice",
      situation: "You and a family member are deciding how to celebrate an important occasion with limited time and different preferences.",
      roleLabel: "Your family member",
      relationshipToLearner: "A family member helping plan a celebration.",
      immediateGoal: "Understand what matters to each person and choose a realistic plan.",
      knownFacts: ["There is an occasion to celebrate.", "Time is limited."],
      unknownFacts: ["What the learner values about the occasion.", "Which plan the learner prefers."],
      baselineTone: "Warm, interested, and mildly opinionated.",
      partnerOpeningText: "We don’t have much time for the celebration, so I think we should keep it simple. What matters most to you?",
    },
    {
      id: "family_misunderstood_message",
      situation: "A family member misunderstood a recent message from you, and you want to explain what you meant without creating more tension.",
      roleLabel: "Your family member",
      relationshipToLearner: "A family member involved in a small misunderstanding.",
      immediateGoal: "Understand the original meaning and repair the misunderstanding.",
      knownFacts: ["A recent message was misunderstood.", "The issue is still manageable."],
      unknownFacts: ["What the learner intended.", "What part caused the misunderstanding."],
      baselineTone: "Familiar, slightly guarded, and willing to listen.",
      partnerOpeningText: "Your message sounded a little dismissive to me. Is that what you meant?",
    },
  ],
  job_interviews: [
    {
      id: "interview_experience_fit",
      situation: "You are in a job interview discussing your experience, working preferences, and fit for the role.",
      roleLabel: "The interviewer",
      relationshipToLearner: "An interviewer assessing whether the learner and the role are a good fit.",
      immediateGoal: "Understand the learner's experience, reasoning, and expectations.",
      knownFacts: ["The learner is being considered for a role.", "The interviewer wants relevant examples."],
      unknownFacts: ["Which experiences the learner will discuss.", "What the learner values in the role."],
      baselineTone: "Professional, attentive, and appropriately curious.",
      partnerOpeningText: "Thanks for meeting with me. Could you tell me about an experience that shows how you approach your work?",
    },
    {
      id: "interview_difficult_example",
      situation: "An interviewer asks you about a difficult work situation and what you learned from it.",
      roleLabel: "The interviewer",
      relationshipToLearner: "An interviewer looking for a clear, relevant example.",
      immediateGoal: "Understand the situation, the learner's actions, and the result.",
      knownFacts: ["The interviewer wants one specific example.", "The answer should connect to learning or growth."],
      unknownFacts: ["Which experience the learner will choose.", "What the learner learned."],
      baselineTone: "Professional, curious, and neutral.",
      partnerOpeningText: "Tell me about a difficult situation at work. What made it challenging, and what did you do?",
    },
    {
      id: "interview_working_style",
      situation: "An interviewer wants to understand how you organize your work when several things need attention.",
      roleLabel: "The interviewer",
      relationshipToLearner: "An interviewer assessing the learner's working approach.",
      immediateGoal: "Understand how the learner prioritizes and communicates decisions.",
      knownFacts: ["The role involves competing priorities.", "The interviewer wants a practical explanation."],
      unknownFacts: ["How the learner organizes work.", "Which example the learner will use."],
      baselineTone: "Professional, engaged, and practical.",
      partnerOpeningText: "Several tasks can feel urgent at the same time. How do you decide what to do first?",
    },
    {
      id: "interview_role_motivation",
      situation: "An interviewer asks why this role interests you and what you hope to contribute.",
      roleLabel: "The interviewer",
      relationshipToLearner: "An interviewer exploring motivation and fit.",
      immediateGoal: "Understand the learner's reasons and the value they hope to bring.",
      knownFacts: ["The learner applied for the role.", "The interviewer wants a genuine, relevant answer."],
      unknownFacts: ["What interests the learner.", "What contribution the learner wants to make."],
      baselineTone: "Professional, receptive, and attentive.",
      partnerOpeningText: "This role needs someone who can contribute to the team from the start. What attracted you to it, and what could you bring?",
    },
  ],
  personal_decisions: [
    {
      id: "personal_possible_change",
      situation: "You are talking with a trusted friend about a possible change in your work or daily routine.",
      roleLabel: "A trusted friend",
      relationshipToLearner: "A trusted friend helping the learner think through a personal decision.",
      immediateGoal: "Understand the learner's reasons and help identify a realistic next step.",
      knownFacts: ["The learner is considering a change.", "The decision has benefits and tradeoffs."],
      unknownFacts: ["What change the learner is considering.", "Which concern matters most."],
      baselineTone: "Supportive, honest, and willing to offer another perspective.",
      partnerOpeningText: "You’ve been thinking about making a change. What feels most important about the decision right now?",
    },
    {
      id: "personal_learning_commitment",
      situation: "You are deciding whether to commit time and money to learning a new skill.",
      roleLabel: "A trusted friend",
      relationshipToLearner: "A trusted friend helping compare a personal opportunity and its cost.",
      immediateGoal: "Understand why the skill matters and whether the commitment is realistic.",
      knownFacts: ["Learning the skill requires regular time and some money.", "The learner sees a possible benefit."],
      unknownFacts: ["Which skill interests the learner.", "What concern could prevent the commitment."],
      baselineTone: "Curious, practical, and supportive without automatic agreement.",
      partnerOpeningText: "You seem interested in learning it, but it’s a real commitment. What makes it feel worth considering?",
    },
    {
      id: "personal_free_time",
      situation: "You are talking with a friend about protecting more personal time without neglecting your responsibilities.",
      roleLabel: "A trusted friend",
      relationshipToLearner: "A trusted friend discussing an ordinary life-balance decision.",
      immediateGoal: "Understand what the learner wants to change and what boundary might help.",
      knownFacts: ["The learner wants more personal time.", "Some responsibilities still need attention."],
      unknownFacts: ["What currently takes the learner's time.", "What boundary feels realistic."],
      baselineTone: "Warm, realistic, and gently challenging.",
      partnerOpeningText: "You’ve said you want more time for yourself, but your week is already full. What would you change first?",
    },
    {
      id: "personal_small_project",
      situation: "You are deciding whether to begin a small personal project now or wait until life feels less busy.",
      roleLabel: "A trusted friend",
      relationshipToLearner: "A trusted friend helping think through timing and motivation.",
      immediateGoal: "Understand the project's importance and choose a manageable next step.",
      knownFacts: ["The learner is interested in a personal project.", "Current time and energy are limited."],
      unknownFacts: ["What the project is.", "What a small first step could be."],
      baselineTone: "Encouraging, honest, and practical.",
      partnerOpeningText: "You keep coming back to this project, even though you’re busy. What makes you want to start it now?",
    },
  ],
} as const satisfies Record<
  PracticeContext,
  readonly FallbackScenario[]
>;

const ROLE_FOR_CUSTOM_SITUATION = {
  coworkers_teamwork: "Your coworker",
  managers_feedback: "Your manager",
  customers_clients: "Your customer or client",
  everyday_situations: "The other person",
  work: "Your workplace conversation partner",
  family_relationships: "The person involved",
  job_interviews: "The interviewer",
  personal_decisions: "A trusted conversation partner",
} as const satisfies Record<PracticeContext, string>;

const CUSTOM_PARTNER_OPENING = {
  coworkers_teamwork:
    "Thanks for bringing this up. What would you like us to clarify first?",
  managers_feedback:
    "I’m listening. What would you like to discuss or clarify?",
  customers_clients:
    "Thanks for explaining the context. What would you like to address first?",
  everyday_situations:
    "Okay, I’m ready to talk about it. What would you like to ask or explain first?",
  work:
    "Thanks for bringing this up. What would you like us to discuss first?",
  family_relationships:
    "I’m listening. What feels most important for us to talk about?",
  job_interviews:
    "Thanks for the context. Could you begin with the point you most want me to understand?",
  personal_decisions:
    "I’m listening. What part of this decision would you like to think through first?",
} as const satisfies Record<PracticeContext, string>;

export function fallbackScenarioFor(input: {
  context: PracticeContext;
  primarySkill: CommunicationSkill;
  customSituation: string | null;
  variationSeed?: string;
  avoidSituations?: readonly string[];
}): FallbackScenario {
  const candidates = CONTEXT_SCENARIOS[input.context];
  const seed = input.variationSeed ?? "";
  const startIndex = [...seed].reduce(
    (total, character) => (total + character.charCodeAt(0)) % candidates.length,
    0,
  );
  const avoided = new Set(
    (input.avoidSituations ?? []).map((situation) =>
      situation.trim().toLowerCase(),
    ),
  );
  const boundedScenario =
    Array.from(
      { length: candidates.length },
      (_, offset) => candidates[(startIndex + offset) % candidates.length],
    ).find(
      (scenario) =>
        !avoided.has(scenario.situation.trim().toLowerCase()),
    ) ?? candidates[startIndex];

  if (input.customSituation === null) {
    return boundedScenario;
  }

  const guidedAnswers = parseGuidedSituationDetail(input.customSituation);
  const guidedRole = guidedSituationPartnerRole(input.customSituation);

  return {
    id: `${input.context}_${input.primarySkill}_learner_provided`,
    situation: guidedSituationForBrief(input.customSituation),
    roleLabel: guidedRole ?? ROLE_FOR_CUSTOM_SITUATION[input.context],
    relationshipToLearner: guidedRole
      ? `The learner identified the simulation partner as ${guidedRole}. No additional relationship is assumed.`
      : "The person involved in the learner-provided situation. No additional relationship is assumed.",
    immediateGoal: guidedAnswers
      ? `Understand what the learner wants to communicate and support this outcome: ${guidedAnswers.goal}`.slice(
          0,
          300,
        )
      : "Respond naturally and help the learner practice the selected communication behavior.",
    knownFacts: guidedAnswers
      ? [
          `The learner described this situation: ${guidedAnswers.background}`.slice(
            0,
            240,
          ),
          `The learner wants this outcome: ${guidedAnswers.goal}`.slice(
            0,
            240,
          ),
          ...(guidedAnswers.difficulty.length > 0
            ? [
                `The learner expects this possible difficulty: ${guidedAnswers.difficulty}`.slice(
                  0,
                  240,
                ),
              ]
            : []),
        ]
      : [
          `The learner described this situation: ${input.customSituation.slice(0, 190)}`,
        ],
    unknownFacts: [
      "Any background, motivation, relationship detail, or desired outcome the learner has not stated.",
    ],
    baselineTone:
      "Calm, realistic, and open to a respectful conversation.",
    partnerOpeningText: CUSTOM_PARTNER_OPENING[input.context],
  };
}
