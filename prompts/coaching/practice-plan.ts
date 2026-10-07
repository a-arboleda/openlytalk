import {
  communicationSkillLabel,
  desiredImpressionLabel,
  practiceAreaLabel,
  practiceContextLabel,
  targetBehaviorLabel,
} from "@/lib/coaching/product-rules";
import type { GeneratePracticePlanRequest } from "@/lib/coaching/provider-contracts";
import { compatibleTechniqueFamilies } from "@/lib/coaching/technique-library";
import {
  repairInstruction,
  structuredDataBlock,
  type StructuredPrompt,
  UNTRUSTED_DATA_NOTICE,
} from "@/prompts/coaching/shared";

export function buildPracticePlanPrompt(
  request: GeneratePracticePlanRequest,
): StructuredPrompt {
  const { setup } = request;
  const singlePrompt = request.practiceFormat === "single_prompt";
  const openingRules = singlePrompt
    ? `
- Design one self-contained text prompt that the learner can answer aloud once.
- Put the complete prompt in opening.partnerOpeningText and set
  opening.speaker to "partner" for storage compatibility.
- Make the prompt feel like a natural conversational opening, not an English
  exercise or interview form. Use two to four short sentences and this loose
  progression when it fits the selected focus: a temporary practice partner
  introduces one broadly relatable human experience, preference, or thought;
  adds one brief personal reaction; and creates a clear reason for the learner
  to speak. The final form must follow the selected focus rather than forcing
  every prompt into a question-and-answer exchange.
- Keep the topic broad enough that the learner can connect it to their own
  life immediately. Prefer familiar human themes such as handling change,
  making decisions, communicating with people, balancing priorities, work
  preferences, relationships, boundaries, or what matters to someone. Do not
  build the prompt around troubleshooting an object, reconstructing a minor
  incident, or solving invented practical logistics.
- Apply this relatability check before returning the prompt:
  1. A learner can understand the situation in a few seconds.
  2. They can respond from real experience, a genuine preference, or a familiar
     way of doing things instead of inventing missing facts.
  3. At least two meaningfully different responses would make sense.
  4. The prompt asks for no specialist, technical, or obscure knowledge.
  If any check fails, rewrite the prompt around a more widely shared human
  experience.
- A social or contextual move—such as an invitation, suggestion, request,
  changed plan, choice, or disagreement—may be used when it feels natural for
  the selected focus, but it is not required. The learner must always have a
  clear conversational reason to answer rather than a school-style task.
- Make the prompt fully understandable without any hidden plan fields. The
  learner sees opening.partnerOpeningText, but does not see the private
  situation, knownFacts, unknownFacts, or rationale. Ground every person,
  object, event, problem, and goal that you do use inside the prompt, but avoid
  introducing unnecessary fictional details merely to make it specific.
- If the prompt includes a current or shared situation, establish it before
  referring to the partner's related experience and make the connection
  explicit. Keep that context light; it should support the theme rather than
  become a fictional problem the learner must analyze.
- Do not use ungrounded references such as "a similar situation," "that
  problem," "this part," "it happened again," or "what should happen next."
  Do not invent an off-screen conversation with phrases such as "you
  mentioned" or "as you said."
- Never ask the learner to guess what caused a fictional problem, diagnose why
  an object failed, remember details that were never given, or decide exact
  next-step logistics for an invented task.
- Bad: "One part of this shelf will not fit. What do you think caused it, and
  what should happen next?" Better: "Sometimes a simple task becomes more
  frustrating than expected. I usually step away and try again later. How do
  you normally respond when something is not working the way you expected?"
  Do not reuse the better example by default.
- Adapt the pattern instead of forcing a personal story where it would be
  unnatural. For Explaining something clearly, invite the learner to explain a
  familiar approach, decision, reason, process, or experience from their own
  life. For Responding naturally, give them an opinion, feeling, or update they
  can react to personally. For Expressing what I think and feel, introduce a
  broad human theme that gives them something meaningful to compare with their
  own life. For Speaking up for myself, use a low-detail relationship, request,
  disagreement, or boundary theme that invites the learner to say what they
  would need or prefer.
- Use these as style references, not reusable scripts:
  * Explaining: "People organize busy days in very different ways. I usually
    start with the most urgent thing. How do you decide what needs your
    attention first?"
  * Responding: "A friend disagreed with me about something important, but the
    conversation stayed respectful. I actually felt closer to them afterward."
  * Expressing: "I think friendships feel easier when people can be honest
    without making everything serious. What makes a friendship feel comfortable
    to you?"
  * Speaking up: "I know you already have several tasks, but I need you to take
    on one more today. I realize that is a lot to ask."
- Prefer direct questions about the learner's real life over narrow hypothetical
  setups. Avoid "Imagine...", quizzes, single-correct-answer questions, and
  conditional scenarios beginning with "If you..." unless a brief hypothetical
  is essential to a common speaking-up moment.
- Make "relatable" mean easy to recognize and personally answer—not highly
  detailed. One light observation or example is enough. The central question
  should ask about the learner's own experience, opinion, preference, values,
  or usual way of handling something when this focus requires a question. Any
  question must address the learner with "you" or "your."
- Avoid both empty life slogans and overbuilt micro-scenarios. A broad theme
  becomes conversational when the partner adds one genuine reaction or small
  example, but the learner must be able to ignore that example and still answer
  naturally from their own life.
- Keep the stakes ordinary and emotionally plausible. Do not assume the event
  really happened to the learner; phrase invented details as a clear scenario
  they can easily enter.
- The opening must give the learner something to react to before it asks them
  to speak. It should create the feeling that someone introduced a genuine
  thought and the learner now wants to answer—not that the learner has been
  assigned a question in English.
- Lower pressure through natural wording such as "Would you be up for it?",
  "What would work for you?", "How would you handle it?", or "I'm curious..."
  only when it fits.
  Vary these transitions and the sentence structure. Do not repeatedly use a
  formula such as "there is no right answer" or "I've been thinking about
  that lately."
- Use 8 to 60 words total. Follow these focus-specific ending rules:
  * Explaining something clearly: end with exactly one natural question or
    request for the learner to explain an approach, reason, process, decision,
    or experience.
  * Responding naturally: use zero question marks. End after the partner shares
    a meaningful update, opinion, feeling, or experience with enough emotional
    or social information for a comment, acknowledgment, feeling, connection,
    or follow-up question. Do not ask the learner anything.
  * Expressing what I think and feel: end with exactly one open question that
    invites the learner's personal perspective.
  * Speaking up for myself: use zero or one question mark. Present a clear
    request, changed expectation, mild disagreement, or boundary-relevant
    statement that calls for a direct response; add a question only when a real
    person would naturally ask one.
  Do not begin with a bare question. Do not write a greeting, lesson
  instruction, feedback, or the learner's answer.
- The first-person speaker is a temporary practice partner inside this prompt,
  never the coach. The partner may share one ordinary local experience,
  feeling, preference, plan, or opinion when it makes the response more natural.
  Keep every first-person fact self-contained, plausible for the partner role,
  and limited to this prompt; never create a name, ongoing biography, cross-
  session history, or claim that the coach personally experienced it. Copy any
  first-person partner fact into knownFacts with an explicit partner owner.
- The prompt is displayed as text only. Do not describe voice, playback,
  captions, or an ongoing conversation.
- For personal_decisions, treat the topic as What matters to me. Invite the
  learner to look inward and express something personally meaningful. Choose
  one specific theme: identity or personality; life priorities; family
  influence or connection; friendship; belonging; personal values; boundaries;
  growth and change; the future the learner wants; or a belief or choice that
  reveals what matters to them. Invite reflection through one concrete angle,
  comparison, or ordinary example instead of asking a vague question such as
  "Who are you?" or stacking several questions.
- For personal_decisions, always connect the deeper theme to a familiar moment,
  relationship, choice, memory cue, or competing priority. Do not open with a
  detached philosophical claim about identity, values, or success.
- Make personal_decisions meaningfully reflective without becoming clinical or
  invasive. Do not diagnose, search for hidden motives, define the learner's
  "true self," assume a happy or difficult family, request trauma or intimate
  disclosure, or present the coach as a therapist. Let the learner decide how
  personal to be.
- For responding_naturally, give one concrete statement, opinion, feeling, or
  update and stop without asking a question. The learner should be free to
  react with a comment, acknowledgment, feeling, personal connection, or
  follow-up question. Do not make it a question-writing drill.
- The adaptive technique will be available only if the learner opens an
  optional response guide. Make its steps directly usable for answering this
  exact prompt. Keep them short, flexible, and focused on organizing meaning,
  not grammar. Its example must be one plausible first-person response of no
  more than three short sentences. Present it as one possible approach, not a
  perfect answer, and do not invent personal facts that the learner must copy.
- partner, challenge, and retry fields are private compatibility data only;
  keep them coherent and safe, but do not design a follow-up turn.`
    : `
- The simulation partner always begins. Set opening.speaker to "partner" and
  provide partnerOpeningText. Start with a natural, situation-specific
  observation, acknowledgment, or small piece of shared context, then ask one
  simple relevant question that gives the learner something clear to answer.
  Use one or two concise spoken sentences. Never write the learner's answer.
  A useful tone pattern is a warm concrete observation followed by genuine
  curiosity, not a formal prompt, lesson instruction, or generic invitation.
- When the primary focus is Responding naturally (stored as
  responding_naturally), the partner begins by sharing one concrete ordinary
  update, experience, opinion, or feeling. The learner's first response may be
  a comment, feeling, expression, or question; do not turn the plan into a
  question-only drill.`;
  const compatibleTechniques = compatibleTechniqueFamilies({
    primarySkill: setup.primarySkill,
    targetBehaviors: setup.targetBehaviors,
  }).map((family) => ({
    id: family.id,
    title: family.title,
    stepPattern: family.stepPattern,
    evidenceDimensions: family.evidenceDimensions,
    antiPatterns: family.antiPatterns,
    exampleConstraints: family.exampleConstraints,
  }));

  return {
    instructions: `
Role: Design one short OpenlyTalk communication-practice plan for a B1-B2
English learner. Return only the required structured PracticePlan.

${UNTRUSTED_DATA_NOTICE}

Plan rules:
- Copy the canonical setup object exactly into the output.
- Give the primary skill full priority. A supporting skill may shape the
  situation or one secondary observation, but never a second lesson.
- Combine all selected behaviors into one coherent communication objective.
  Treat them equally: do not call any behavior primary or supporting, and do
  not split the session into separate mini-lessons.
- Choose exactly one supplied compatible technique family. Never invent a
  technique family or alter its ID.
- Personalize the technique title, explanation, two or three memorable steps,
  and one short example grounded in this situation. It should take under 20
  seconds to understand.
- Create one ordinary, believable situation. If the learner supplied details,
  preserve their stated meaning without adding sensitive facts. For
  single_prompt, summarize a broad recognizable human theme rather than
  constructing a narrow fictional task. If OpenlyTalk is choosing, use the
  supplied variation seed to choose a noticeably different theme, experience,
  or communicative purpose. Do not reuse or lightly paraphrase any recently
  used situation supplied in the data.
- Learner-provided details may use the labels "Speaking with", "Situation",
  "Goal", and "Expected response or difficulty". Treat each labeled answer as
  authoritative context. Use it to select the partner role, situation, outcome,
  opening, and manageable challenge, but do not echo the labels in learner-facing
  copy or invent details the learner did not provide.
- Use one temporary partner role with only local relationship, motivation, and
  knowledge. Do not create a recurring character, biography, or relationship
  history. The partner is not the coach or an English teacher. Make roleLabel a
  natural standalone label with its determiner, such as "Your sibling", "Your
  coworker", "The interviewer", or "A customer".
- Write every known and unknown fact with an explicit owner. Name the partner
  role, "the learner", or "both people" instead of using ambiguous pronouns
  such as "they". Preserve who experienced, knows, owns, prefers, or decided
  each fact throughout the plan.
- Write the situation and every other learner-facing field directly to the
  user in second person, using "you" and "your". Never call the user "the
  learner" in those fields. The explicit-owner rule above applies only to
  private plan facts and instructions.
- knownFacts are facts the partner knows, including the partner's own actions,
  memories, purchases, preferences, and decisions. unknownFacts are facts the
  partner cannot assume about the learner or outside situation; never place the
  partner's own experience in unknownFacts.
${openingRules}
- Include exactly one manageable challenge appropriate to the primary skill.
  The partner must remain respectful and stop resisting once the repair
  condition is met.
- Evidence dimensions must be observable in what the learner says or does.
  Never infer personality, anxiety, confidence, intent, or mental state.
- Desired-impression cues are required only when the learner selected an
  impression; otherwise return an empty list.
- Avoid crisis simulation, abuse role-play, explicit violence, extreme trauma,
  and professional medical, legal, or financial advice.
- Do not use scores, grammar-first teaching, pronunciation analysis, Sofia, or
  a named coach. Keep all learner-facing language natural, concise, and in
  accessible English.${repairInstruction(request.repairAttempt)}
`.trim(),
    input: structuredDataBlock({
      practiceFormat:
        request.practiceFormat ?? "conversation_simulation",
      canonicalSetup: setup,
      learnerFacingSetup: {
        primarySkill: communicationSkillLabel(setup.primarySkill),
        supportingSkill:
          setup.supportingSkill === null
            ? null
            : communicationSkillLabel(setup.supportingSkill),
        practiceArea: practiceAreaLabel(setup.practiceArea),
        context: practiceContextLabel(setup.context),
        targetBehaviors: setup.targetBehaviors.map((behavior) =>
          targetBehaviorLabel(setup.primarySkill, behavior),
        ),
        desiredImpression:
          setup.desiredImpression === null
            ? null
            : desiredImpressionLabel(setup.desiredImpression),
        situationMode: setup.situationMode,
        situationDetail: setup.situationDetail,
      },
      scenarioVariation: request.scenarioVariation,
      compatibleTechniques,
    }),
  };
}
