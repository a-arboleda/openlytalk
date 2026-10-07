import { z } from "zod";

import { addressLearnerDirectly } from "@/lib/coaching/learner-facing-language";
import {
  COACHING_BETA_RULES,
  desiredImpressionLabel,
} from "@/lib/coaching/product-rules";
import {
  canAcceptLearnerResponse,
  canRequestHelp,
  remainingLearnerResponses,
} from "@/lib/coaching/transitions";
import {
  activePracticeSetupSchema,
  describedSituationRequestSchema,
  helpTypeSchema,
  practiceSetupSchema,
  quickPracticeSelectionSchema,
  sessionPhaseSchema,
  sessionStatusSchema,
  situationModeSchema,
  type CoachingBreak,
  type FinalSessionTakeaway,
  type PracticeMessage,
  type PracticeSessionState,
  type RetryOutcome,
  type RetryTarget,
} from "@/lib/coaching/schemas";
import {
  databaseIdSchema,
  idempotencyKeySchema,
} from "@/lib/validation/persistence";

export const publicPracticeMessageSchema = z.object({
  id: databaseIdSchema,
  role: z.enum(["learner", "partner"]),
  speakerLabel: z.string().trim().min(1).max(80),
  phase: z.enum(["initial_simulation", "targeted_retry"]),
  learnerResponseNumber: z.number().int().min(1).max(5).nullable(),
  sequence: z.number().int().min(0),
  text: z.string().trim().min(1).max(4_000),
  speechUrl: z.string().trim().min(1).nullable(),
  createdAt: z.string().datetime(),
});

export const publicPracticeTechniqueSchema = z.object({
  title: z.string().trim().min(1).max(120),
  whyItFits: z.string().trim().min(1).max(300),
  steps: z.array(z.string().trim().min(1).max(160)).min(2).max(3),
  example: z.string().trim().min(1).max(500),
});

export const publicPracticeBriefSchema = z.object({
  coachLabel: z.literal("Your coach"),
  partnerRole: z.string().trim().min(1).max(80),
  situation: z.string().trim().min(1).max(800),
  goal: z.string().trim().min(1).max(400),
  technique: publicPracticeTechniqueSchema,
  desiredImpression: z.string().trim().min(1).max(80).nullable(),
  opening: z.object({
    speaker: z.enum(["learner", "partner"]),
    learnerCue: z.string().trim().min(1).max(400),
  }),
  promptText: z.string().trim().min(1).max(700).nullable(),
});

const publicEvidenceObservationSchema = z.object({
  title: z.string().trim().min(1).max(120),
  observation: z.string().trim().min(1).max(600),
});

export const publicCoachingBreakSchema = z.object({
  whatWorked: publicEvidenceObservationSchema.nullable(),
  oneImprovement: publicEvidenceObservationSchema,
  tryItThisWay: z.object({
    originalMeaning: z.string().trim().min(1).max(500),
    naturalExample: z.string().trim().min(1).max(500),
  }),
  retryGoal: z.string().trim().min(1).max(300),
  retryPrompt: z.string().trim().min(1).max(500),
});

export const publicRetryTargetSchema = z.object({
  prompt: z.string().trim().min(1).max(500),
  goal: z.string().trim().min(1).max(300),
});

export const publicRetryOutcomeSchema = z.object({
  application: z.enum(["applied", "partly_applied", "not_yet_applied"]),
  observation: z.string().trim().min(1).max(500),
});

const publicEnglishPolishSchema = z.object({
  originalMeaningOrWords: z.string().trim().min(1).max(500),
  naturalAlternative: z.string().trim().min(1).max(500),
  briefExplanation: z.string().trim().min(1).max(400),
});

const publicRetryFinalTakeawaySchema = z.object({
  flow: z.literal("retry"),
  kind: z.enum(["full", "partial"]),
  whatYouPracticed: z.string().trim().min(1).max(500),
  whatChanged: z.object({
    initialObservation: z.string().trim().min(1).max(600),
    retryObservation: z.string().trim().min(1).max(600).nullable(),
  }),
  strongestMoment: publicEvidenceObservationSchema.nullable(),
  keepUsingTechnique: z.object({
    title: z.string().trim().min(1).max(120),
    reminder: z.string().trim().min(1).max(400),
    personalizedExample: z.string().trim().min(1).max(500),
  }),
  englishPolish: z.array(publicEnglishPolishSchema).max(2),
  tryItInRealLife: z.string().trim().min(1).max(500),
  optionalRetell: z.string().trim().min(1).max(500).nullable(),
});

const publicContinuousFinalTakeawaySchema = z.object({
  flow: z.literal("continuous"),
  kind: z.enum(["full", "partial"]),
  whatYouPracticed: z.string().trim().min(1).max(500),
  whatWorked: publicEvidenceObservationSchema.nullable(),
  oneImprovement: publicEvidenceObservationSchema,
  naturalExample: z.object({
    originalMeaning: z.string().trim().min(1).max(500),
    naturalExample: z.string().trim().min(1).max(500),
  }),
  englishPolish: z.array(publicEnglishPolishSchema).max(2),
  tryItInRealLife: z.string().trim().min(1).max(500),
  optionalRetell: z.string().trim().min(1).max(500).nullable(),
});

export const publicFinalTakeawaySchema = z.discriminatedUnion("flow", [
  publicRetryFinalTakeawaySchema,
  publicContinuousFinalTakeawaySchema,
]);

export const publicPracticeSessionSchema = z.object({
  schemaVersion: z.literal(1),
  experienceMode: z.enum(["single_prompt", "conversation_simulation"]),
  practiceSessionId: databaseIdSchema,
  status: sessionStatusSchema,
  phase: sessionPhaseSchema,
  setup: practiceSetupSchema,
  brief: publicPracticeBriefSchema,
  acceptedResponseCount: z
    .number()
    .int()
    .min(0)
    .max(COACHING_BETA_RULES.maxAcceptedResponses),
  responseLimit: z
    .number()
    .int()
    .min(COACHING_BETA_RULES.currentPracticeResponseLimit)
    .max(COACHING_BETA_RULES.maxAcceptedResponses),
  remainingResponseCount: z
    .number()
    .int()
    .min(0)
    .max(COACHING_BETA_RULES.maxAcceptedResponses),
  expectedLearnerSequence: z.number().int().min(0),
  situationReplacementsRemaining: z.number().int().min(0).max(2),
  messages: z.array(publicPracticeMessageSchema),
  coachingBreak: publicCoachingBreakSchema.nullable(),
  retryTarget: publicRetryTargetSchema.nullable(),
  retryOutcome: publicRetryOutcomeSchema.nullable(),
  takeaway: publicFinalTakeawaySchema.nullable(),
  actions: z.object({
    canStart: z.boolean(),
    canReplaceSituation: z.boolean(),
    canRecord: z.boolean(),
    canRequestHelp: z.boolean(),
    canEnd: z.boolean(),
    canResumeFinalization: z.boolean(),
    canDelete: z.literal(true),
  }),
  updatedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});

function messageSpeechUrl(
  practiceSessionId: string,
  message: PracticeMessage,
  experienceMode: "single_prompt" | "conversation_simulation",
): string | null {
  if (experienceMode === "single_prompt" || message.role !== "partner") {
    return null;
  }
  return `/api/practice-sessions/${encodeURIComponent(
    practiceSessionId,
  )}/messages/${encodeURIComponent(message.id)}/speech`;
}

function publicCoachingBreak(
  coachingBreak: CoachingBreak | null,
) {
  if (coachingBreak === null) return null;
  return {
    whatWorked:
      coachingBreak.whatWorked === null
        ? null
        : {
            title: coachingBreak.whatWorked.title,
            observation: coachingBreak.whatWorked.observation,
          },
    oneImprovement: {
      title: coachingBreak.oneImprovement.title,
      observation: coachingBreak.oneImprovement.observation,
    },
    tryItThisWay: coachingBreak.tryItThisWay,
    retryGoal: coachingBreak.retryGoal,
    retryPrompt: coachingBreak.retryPrompt,
  };
}

function publicRetryTarget(retryTarget: RetryTarget | null) {
  return retryTarget === null
    ? null
    : {
        prompt: retryTarget.prompt,
        goal: retryTarget.goal,
      };
}

function publicRetryOutcome(retryOutcome: RetryOutcome | null) {
  return retryOutcome === null
    ? null
    : {
        application: retryOutcome.application,
        observation: retryOutcome.observation,
      };
}

function publicTakeaway(takeaway: FinalSessionTakeaway | null) {
  if (takeaway === null) return null;
  const common = {
    flow: takeaway.flow,
    kind: takeaway.kind,
    whatYouPracticed: takeaway.whatYouPracticed,
    englishPolish: takeaway.englishPolish.map((item) => ({
      originalMeaningOrWords: item.originalMeaningOrWords,
      naturalAlternative: item.naturalAlternative,
      briefExplanation: item.briefExplanation,
    })),
    tryItInRealLife: takeaway.tryItInRealLife,
    optionalRetell: takeaway.optionalRetell,
  };
  if (takeaway.flow === "continuous") {
    return {
      ...common,
      whatWorked:
        takeaway.whatWorked === null
          ? null
          : {
              title: takeaway.whatWorked.title,
              observation: takeaway.whatWorked.observation,
            },
      oneImprovement: {
        title: takeaway.oneImprovement.title,
        observation: takeaway.oneImprovement.observation,
      },
      naturalExample: takeaway.naturalExample,
    };
  }
  return {
    ...common,
    whatChanged: {
      initialObservation: takeaway.whatChanged.initialObservation,
      retryObservation: takeaway.whatChanged.retryObservation,
    },
    strongestMoment:
      takeaway.strongestMoment === null
        ? null
        : {
            title: takeaway.strongestMoment.title,
            observation: takeaway.strongestMoment.observation,
          },
    keepUsingTechnique: takeaway.keepUsingTechnique,
  };
}

export function toPublicPracticeSession(
  state: PracticeSessionState,
) {
  const experienceMode =
    state.schemaVersion === 6
      ? "single_prompt" as const
      : "conversation_simulation" as const;
  return publicPracticeSessionSchema.parse({
    schemaVersion: 1,
    experienceMode,
    practiceSessionId: state.practiceSessionId,
    status: state.status,
    phase: state.phase,
    setup: state.setup,
    brief: {
      coachLabel: "Your coach",
      partnerRole: state.plan.partner.roleLabel,
      situation:
        state.setup.situationMode === "choose_for_me"
          ? addressLearnerDirectly(state.plan.situation)
          : state.plan.situation,
      goal: state.plan.sessionGoal,
      technique: {
        title: state.plan.technique.title,
        whyItFits: state.plan.technique.whyItFits,
        steps: state.plan.technique.steps,
        example: state.plan.technique.example,
      },
      desiredImpression:
        state.setup.desiredImpression === null
          ? null
          : desiredImpressionLabel(state.setup.desiredImpression),
      opening: {
        speaker: state.plan.opening.speaker,
        learnerCue: state.plan.opening.learnerCue,
      },
      promptText:
        experienceMode === "single_prompt"
          ? state.plan.opening.partnerOpeningText
          : null,
    },
    acceptedResponseCount: state.acceptedResponseCount,
    responseLimit: state.responseLimit,
    remainingResponseCount: remainingLearnerResponses(
      state.acceptedResponseCount,
      state.responseLimit,
    ),
    expectedLearnerSequence: state.expectedLearnerSequence,
    situationReplacementsRemaining: Math.max(
      0,
      2 - state.situationReplacementCount,
    ),
    messages: state.messages.map((message) => ({
      ...message,
      speakerLabel:
        message.role === "learner"
          ? "You"
          : state.plan.partner.roleLabel,
      speechUrl: messageSpeechUrl(
        state.practiceSessionId,
        message,
        experienceMode,
      ),
    })),
    coachingBreak: publicCoachingBreak(state.coachingBreak),
    retryTarget: publicRetryTarget(state.retryTarget),
    retryOutcome: publicRetryOutcome(state.retryOutcome),
    takeaway: publicTakeaway(state.takeaway),
    actions: {
      canStart: state.status === "active" && state.phase === "briefing",
      canReplaceSituation:
        state.status === "active" &&
        state.phase === "briefing" &&
        state.setup.situationMode === "choose_for_me" &&
        state.situationReplacementCount < 2,
      canRecord: canAcceptLearnerResponse(state),
      canRequestHelp: canRequestHelp(state),
      canEnd: state.status === "active",
      canResumeFinalization:
        state.status === "active" &&
        state.phase === "finalizing" &&
        state.terminationReason === "user_exit",
      canDelete: true,
    },
    updatedAt: state.updatedAt,
    expiresAt: state.expiresAt,
  });
}

export type PublicPracticeSession = z.infer<
  typeof publicPracticeSessionSchema
>;

export const createPracticeSessionRequestSchema = activePracticeSetupSchema;
export const quickPracticeSessionRequestSchema = quickPracticeSelectionSchema;
export { describedSituationRequestSchema };

export const practiceSessionResponseSchema = z.object({
  session: publicPracticeSessionSchema,
});

export const startPracticeRequestSchema = z.object({
  expectedUpdatedAt: z.string().datetime(),
});

export const replacePracticeSituationRequestSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  expectedUpdatedAt: z.string().datetime(),
});

export const replacePracticeSituationResponseSchema =
  practiceSessionResponseSchema;

export const startPracticeResponseSchema = practiceSessionResponseSchema.extend({
  autoplaySpeechUrl: z.string().trim().min(1).nullable(),
});

export const practiceTurnFieldsSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  expectedLearnerSequence: z.coerce.number().int().min(0),
  previewTranscript: z.string().trim().min(1).max(4_000).optional(),
});

export const practiceTranscriptionPreviewResponseSchema = z.object({
  transcript: z.string().trim().min(1).max(4_000),
});

export const practiceTurnResponseSchema = practiceSessionResponseSchema.extend({
  acceptedMessages: z.array(publicPracticeMessageSchema).min(1).max(2),
  autoplaySpeechUrl: z.string().trim().min(1).nullable(),
});

export type PracticeTurnResponse = z.infer<
  typeof practiceTurnResponseSchema
>;

export const practiceHelpRequestSchema = z.object({
  type: helpTypeSchema,
  currentPartnerMessageId: databaseIdSchema.nullable().default(null),
  expectedLearnerSequence: z.number().int().min(0),
  expectedUpdatedAt: z.string().datetime(),
});

export const practiceHelpResponseSchema = practiceSessionResponseSchema.extend({
  help: z.object({
    type: helpTypeSchema,
    coachLabel: z.literal("Your coach"),
    coachText: z.string().trim().min(1).max(500),
  }),
});

export type PracticeHelpResponse = z.infer<
  typeof practiceHelpResponseSchema
>;

export const retryPracticeRequestSchema = z.object({
  expectedUpdatedAt: z.string().datetime(),
});

export const retryPracticeResponseSchema = practiceSessionResponseSchema;

export const endPracticeRequestSchema = z.object({
  expectedUpdatedAt: z.string().datetime(),
});

export const endPracticeResponseSchema = practiceSessionResponseSchema;

export const deletePracticeResponseSchema = z.object({
  deleted: z.literal(true),
});

export const coachSpeechRequestSchema = z.object({
  content: z.enum(["coaching_break", "final_takeaway"]),
});

export const practiceApiErrorSchema = z.object({
  error: z.object({
    code: z.enum([
      "invalid_request",
      "not_found",
      "expired",
      "stale_state",
      "operation_in_progress",
      "allowance_exhausted",
      "invalid_audio",
      "unclear_audio",
      "non_english",
      "provider_unavailable",
      "persistence_unavailable",
      "invalid_generated_output",
      "practice_not_active",
      "phase_not_available",
      "replacement_limit",
    ]),
    message: z.string().trim().min(1).max(300),
    retryable: z.boolean(),
    fieldErrors: z
      .record(z.string(), z.array(z.string().trim().min(1).max(200)))
      .optional(),
  }),
});

export const practiceSituationSelectionSchema = z.object({
  mode: situationModeSchema,
  detail: z.string().trim().min(1).max(800).nullable(),
});
