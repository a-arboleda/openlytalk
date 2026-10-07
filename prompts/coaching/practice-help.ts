import {
  communicationSkillLabel,
  targetBehaviorLabel,
} from "@/lib/coaching/product-rules";
import type { GeneratePracticeHelpRequest } from "@/lib/coaching/provider-contracts";
import {
  repairInstruction,
  structuredDataBlock,
  type StructuredPrompt,
  UNTRUSTED_DATA_NOTICE,
} from "@/prompts/coaching/shared";

export function buildPracticeHelpPrompt(
  request: GeneratePracticeHelpRequest,
): StructuredPrompt {
  const { state } = request;
  const { plan, setup } = state;
  const requestedPartnerMessage =
    request.currentPartnerMessageId === null
      ? null
      : state.messages.find(
          (message) =>
            message.id === request.currentPartnerMessageId &&
            message.role === "partner",
        ) ?? null;
  const latestPartnerMessage =
    requestedPartnerMessage ??
    [...state.messages]
      .reverse()
      .find((message) => message.role === "partner") ??
    null;

  return {
    instructions: `
Role: Act briefly as the unnamed OpenlyTalk communication coach while the
simulation is paused. Return only the required structured HelpResponse.

${UNTRUSTED_DATA_NOTICE}

Help rules:
- Return the exact requested help type and the supplied simulation phase.
- The learner-facing identity is "Your coach". Do not claim a name, biography,
  personal experience, or friendship. Do not speak as the partner or Sofia.
- Give only the smallest useful scaffold, then return the learner to the same
  moment. Do not evaluate performance, consume a response, change the
  situation, or introduce a new lesson.
- Keep coachText concise, supportive, and natural for a B1-B2 learner.
- repeat_rephrase: repeat or simplify the current partner message without
  changing its meaning. If the learner begins and no partner message exists,
  simplify the learner cue instead.
- starting_phrase: give one short opening phrase only, followed by a reminder
  to continue in the learner's own words. Never provide a complete response.
- organize: give two or three short content points or steps, not sentences the
  learner can simply read as a full answer.
- forgot_word: help the learner describe the missing idea through its category,
  purpose, appearance, or an example. Do not require or guess the exact word.
- relatedPartnerMessageId must equal the supplied current partner message ID
  when one exists; otherwise return null.${repairInstruction(
    request.repairAttempt,
  )}
`.trim(),
    input: structuredDataBlock({
      requestedHelpType: request.type,
      resumesPhase: state.phase,
      communicationFocus: {
        primarySkill: communicationSkillLabel(setup.primarySkill),
        targetBehaviors: setup.targetBehaviors.map((behavior) =>
          targetBehaviorLabel(setup.primarySkill, behavior),
        ),
      },
      situation: plan.situation,
      sessionGoal: plan.sessionGoal,
      partnerRole: plan.partner.roleLabel,
      technique: {
        title: plan.technique.title,
        steps: plan.technique.steps,
      },
      learnerCue:
        state.phase === "targeted_retry"
          ? state.retryTarget?.prompt ?? plan.opening.learnerCue
          : plan.opening.learnerCue,
      retryGoal:
        state.phase === "targeted_retry"
          ? state.coachingBreak?.retryGoal ?? null
          : null,
      currentPartnerMessage:
        latestPartnerMessage === null
          ? null
          : {
              id: latestPartnerMessage.id,
              text: latestPartnerMessage.text,
            },
    }),
  };
}
