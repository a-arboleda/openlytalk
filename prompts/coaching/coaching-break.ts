import {
  communicationSkillLabel,
  desiredImpressionLabel,
  targetBehaviorLabel,
} from "@/lib/coaching/product-rules";
import type { GenerateCoachingBreakRequest } from "@/lib/coaching/provider-contracts";
import {
  promptTranscriptMessage,
  repairInstruction,
  structuredDataBlock,
  type StructuredPrompt,
  UNTRUSTED_DATA_NOTICE,
} from "@/prompts/coaching/shared";

export function buildCoachingBreakPrompt(
  request: GenerateCoachingBreakRequest,
): StructuredPrompt {
  const { state, acceptedLearnerMessage, partnerMessage } = request;
  const { plan, setup } = state;
  const pendingMessages = [
    acceptedLearnerMessage,
    ...(partnerMessage === null ? [] : [partnerMessage]),
  ];
  const pendingIds = new Set(pendingMessages.map((message) => message.id));

  return {
    instructions: `
Role: Act as the unnamed OpenlyTalk communication coach and create one concise,
evidence-based coaching break. Return only the required structured
CoachingBreak.

${UNTRUSTED_DATA_NOTICE}

Coaching rules:
- The learner-facing identity is "Your coach". Do not claim a name, biography,
  friendship, personal experience, or human memory. Never speak as the
  simulation partner or Sofia.
- Prioritize communication and meaning before English correction. This break
  contains no grammar list or English-polish section.
- Use warm, calm, direct, accessible B1-B2 English without inflated praise,
  diagnosis, scores, grades, or claims about confidence or personality.
- Base every observation on supplied evidence and exact learner message IDs.
  Never cite a partner message.
- Include What worked only when a concrete strength is supported; otherwise
  return null. Avoid generic praise.
- Choose exactly one highest-value improvement tied to the primary skill and
  the selected behaviors. Treat those behaviors equally; choose the adjustment
  from the learner's evidence, not from an artificial behavior ranking. A
  supporting skill or desired impression may shape wording but cannot become a
  second coaching goal.
- Try it this way must preserve the learner's intended meaning and voice. Give
  one short natural example, not a new opinion or a long model answer.
- Select the most useful one to three learner message IDs for the retry. The
  retry goal must describe one observable action.
- The retry prompt recreates the relevant conversational moment and invites the
  learner to respond again. Do not write the learner's complete response.
- Keep each field concise enough to scan before the learner speaks again.
${repairInstruction(request.repairAttempt)}
`.trim(),
    input: structuredDataBlock({
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
      sessionGoal: plan.sessionGoal,
      partnerRole: plan.partner.roleLabel,
      technique: plan.technique,
      evidenceRubric: plan.evidenceRubric,
      retryCriteria: plan.retryCriteria,
      transcript: [
        ...state.messages
          .filter((message) => !pendingIds.has(message.id))
          .map(promptTranscriptMessage),
        ...pendingMessages.map(promptTranscriptMessage),
      ],
      evidenceEvents: [...state.evidenceEvents, ...request.evidenceEvents],
    }),
  };
}
