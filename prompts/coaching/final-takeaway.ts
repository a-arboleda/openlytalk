import {
  communicationSkillLabel,
  COACHING_BETA_RULES,
  desiredImpressionLabel,
  targetBehaviorLabel,
} from "@/lib/coaching/product-rules";
import type { GeneratePracticeTakeawayRequest } from "@/lib/coaching/provider-contracts";
import {
  promptTranscriptMessage,
  repairInstruction,
  structuredDataBlock,
  type StructuredPrompt,
  UNTRUSTED_DATA_NOTICE,
} from "@/prompts/coaching/shared";

const RETELL_SUPPORTING_SKILLS = new Set([
  "explaining_clearly",
  "expressing_yourself",
]);

export function buildFinalTakeawayPrompt(
  request: GeneratePracticeTakeawayRequest,
): StructuredPrompt {
  const { state } = request;
  const { plan, setup } = state;
  const continuousFlow =
    state.responseLimit < COACHING_BETA_RULES.maxAcceptedResponses;
  const singlePromptFlow = state.schemaVersion === 6;
  const singlePromptRules = singlePromptFlow
    ? `
- This practice contains one text prompt and one spoken learner response. Base
  the feedback directly on that response; never imply there was a dialogue,
  follow-up turn, retry, or improvement across attempts.
- Make the feedback useful even when the response is brief. Identify one clear
  idea that came through when evidence supports it, then choose only one
  communication improvement.
- optionalRetell must be null.
- When the context is Personal decisions, the practice may be about
  What matters to me. Reflect only identity, priorities, relationships, ideas,
  values, boundaries, beliefs, opinions, preferences, future hopes, or choices
  the learner explicitly stated. Never infer personality traits, diagnose,
  psychoanalyze, search for hidden motives, or claim to know who the learner
  truly is or what the learner truly believes.
  Try it in real life may offer one gentle question the learner can continue
  exploring.`
    : "";

  const flowRules = continuousFlow
    ? `
- Return flow "continuous".
- Preserve this learner-visible order through the structured fields:
  What you practiced; What worked; One improvement for next time; A natural
  example; English polish; Try it in real life.
- What worked is nullable and must appear only when concrete evidence supports
  it. Never use generic praise.
- Choose exactly one highest-value communication improvement grounded in one to
  three learner message IDs. Do not compare attempts or imply that the learner
  retried anything.
- The natural example must preserve the learner's intended meaning and voice.
  Give one short alternative, not a complete script or a new opinion.
- A full takeaway means the planned short conversation finished. A partial
  takeaway means the learner ended after at least two responses. Neither kind
  implies a before-and-after comparison.`
    : `
- Return flow "retry".
- Preserve this learner-visible order through the structured fields:
  What you practiced; What changed; Your strongest moment; Keep using this
  technique; English polish; Try it in real life.
- For a full takeaway, compare the selected initial attempt with the retry.
  Describe improvement only when comparative evidence supports it. If the retry
  did not improve the target behavior, say honestly what changed and what still
  needs practice without shaming the learner.
- For a partial takeaway, retryObservation must be null and no comparison may
  be invented.
- Include Your strongest moment only when there is specific supporting evidence;
  otherwise return null. Never use generic praise.
- Keep using this technique should give one memorable reminder and one short
  example personalized to the situation without changing the learner's meaning.`;

  return {
    instructions: `
Role: Act as the unnamed OpenlyTalk communication coach and create the Final
Session Takeaway. Return only the required structured FinalSessionTakeaway.

${UNTRUSTED_DATA_NOTICE}

Takeaway rules:
- Return the requested kind exactly.
${flowRules}
- Communication insight always comes before English polish.
- Base every performance observation on supplied evidence and exact learner
  message IDs. Never cite partner messages or invent evidence.
- English polish contains zero to two high-value, meaning-preserving natural
  alternatives. Ignore minor mistakes that did not affect communication. Each
  item must cite the exact learner message ID it comes from; zero items is
  completely valid.
- Try it in real life must be one realistic, low-pressure next use of the same
  communication skill.
- Include optionalRetell only when the input explicitly allows it and retelling
  directly supports the selected skill. It is optional practice, not another
  evaluation.
- Use warm, concise, natural B1-B2 English. Do not use scores, grades,
  exhaustive correction, diagnoses, confidence claims, a biography, personal
  stories, Sofia, or simulation-partner speech.${singlePromptRules}${repairInstruction(
    request.repairAttempt,
  )}
`.trim(),
    input: structuredDataBlock({
      requestedKind: request.kind,
      practiceFormat:
        singlePromptFlow ? "single_prompt" : "conversation_simulation",
      feedbackFlow: continuousFlow ? "continuous" : "retry",
      communicationFocus: {
        primarySkill: communicationSkillLabel(setup.primarySkill),
        supportingSkill:
          setup.supportingSkill === null
            ? null
            : communicationSkillLabel(setup.supportingSkill),
        targetBehaviors: setup.targetBehaviors.map((behavior) =>
          targetBehaviorLabel(setup.primarySkill, behavior),
        ),
        desiredImpression:
          setup.desiredImpression === null
            ? null
            : desiredImpressionLabel(setup.desiredImpression),
      },
      situation: plan.situation,
      practicePrompt:
        singlePromptFlow ? plan.opening.partnerOpeningText : null,
      sessionGoal: plan.sessionGoal,
      technique: plan.technique,
      learnerMessages: state.messages
        .filter((message) => message.role === "learner")
        .map(promptTranscriptMessage),
      evidenceEvents: state.evidenceEvents,
      coachingBreak: state.coachingBreak,
      retryTarget: state.retryTarget,
      retryOutcome: state.retryOutcome,
      retellAllowed:
        !singlePromptFlow &&
        RETELL_SUPPORTING_SKILLS.has(setup.primarySkill),
    }),
  };
}
