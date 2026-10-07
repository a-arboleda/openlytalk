import { z } from "zod";

import {
  ACCEPTED_COMMUNICATION_SKILL_VALUES,
  ACCEPTED_PRACTICE_CONTEXT_VALUES,
  COACHING_BETA_RULES,
  COMMUNICATION_SKILL_VALUES,
  DESIRED_IMPRESSION_VALUES,
  EVIDENCE_DIMENSION_VALUES,
  isPracticeTopicForSkill,
  isTargetBehaviorForSkill,
  PRACTICE_HELP_VALUES,
  PRACTICE_AREA_VALUES,
  PRACTICE_CONTEXT_VALUES,
  PRACTICE_TOPIC_VALUES,
  TARGET_BEHAVIOR_VALUES,
  targetBehaviorsForSkill,
  practiceAreaForContext,
} from "@/lib/coaching/product-rules";
import {
  isTechniqueCompatible,
  TECHNIQUE_FAMILY_IDS,
} from "@/lib/coaching/technique-library";

export const communicationSkillSchema = z.enum(
  ACCEPTED_COMMUNICATION_SKILL_VALUES,
);
export const practiceAreaSchema = z.enum(PRACTICE_AREA_VALUES);
export const practiceContextSchema = z.enum(ACCEPTED_PRACTICE_CONTEXT_VALUES);
export const desiredImpressionSchema = z.enum(DESIRED_IMPRESSION_VALUES);
export const targetBehaviorSchema = z.enum(TARGET_BEHAVIOR_VALUES);
export const evidenceDimensionSchema = z.enum(EVIDENCE_DIMENSION_VALUES);
export const techniqueFamilyIdSchema = z.enum(TECHNIQUE_FAMILY_IDS);

export const situationModeSchema = z.enum([
  "learner_provided",
  "choose_for_me",
]);

export const quickPracticeSelectionSchema = z
  .object({
    primarySkill: z.enum(COMMUNICATION_SKILL_VALUES),
    topic: z.enum(PRACTICE_TOPIC_VALUES),
  })
  .superRefine((selection, context) => {
    if (!isPracticeTopicForSkill(selection.primarySkill, selection.topic)) {
      context.addIssue({
        code: "custom",
        path: ["topic"],
        message: "Choose a topic that fits the selected communication skill.",
      });
    }
  });

export const describedSituationRequestSchema = z.object({
  background: z
    .string()
    .trim()
    .min(1, "Describe what is happening or what you are preparing for.")
    .max(280),
  goal: z
    .string()
    .trim()
    .min(1, "Describe what you would like to happen.")
    .max(180),
});

const situationDetailSchema = z
  .string()
  .trim()
  .min(1)
  .max(COACHING_BETA_RULES.maxSituationCharacters)
  .refine((value) => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value), {
    message: "Situation details cannot contain control characters.",
  });

const canonicalTargetBehaviorsSchema = z
  .array(targetBehaviorSchema)
  .min(1)
  .max(6)
  .refine((values) => new Set(values).size === values.length, {
    message: "Choose each behavior only once.",
  });

export const inferredPracticeSetupSchema = z
  .object({
    primarySkill: z.enum(COMMUNICATION_SKILL_VALUES),
    practiceArea: practiceAreaSchema,
    context: z.enum(PRACTICE_CONTEXT_VALUES),
    targetBehaviors: canonicalTargetBehaviorsSchema.max(3),
    desiredImpression: desiredImpressionSchema.nullable(),
  })
  .superRefine((setup, context) => {
    if (practiceAreaForContext(setup.context) !== setup.practiceArea) {
      context.addIssue({
        code: "custom",
        message: "Choose a context from the inferred part of life.",
        path: ["context"],
      });
    }
    if (
      setup.targetBehaviors.some(
        (behavior) => !isTargetBehaviorForSkill(setup.primarySkill, behavior),
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "Choose behaviors that belong to the inferred focus.",
        path: ["targetBehaviors"],
      });
    }
  });

function validatePracticeSetup(
  setup: {
    primarySkill: z.infer<typeof communicationSkillSchema>;
    supportingSkill: z.infer<typeof communicationSkillSchema> | null;
    practiceArea: z.infer<typeof practiceAreaSchema>;
    context: z.infer<typeof practiceContextSchema>;
    targetBehavior: z.infer<typeof targetBehaviorSchema>;
    targetBehaviors: z.infer<typeof targetBehaviorSchema>[];
    situationMode: z.infer<typeof situationModeSchema>;
    situationDetail: string | null;
  },
  context: z.RefinementCtx,
) {
  if (setup.supportingSkill === setup.primarySkill) {
    context.addIssue({
      code: "custom",
      message: "The supporting skill must differ from the main skill.",
      path: ["supportingSkill"],
    });
  }

  if (practiceAreaForContext(setup.context) !== setup.practiceArea) {
    context.addIssue({
      code: "custom",
      message: "Choose a context from the selected part of your life.",
      path: ["context"],
    });
  }

  if (setup.targetBehavior !== setup.targetBehaviors[0]) {
    context.addIssue({
      code: "custom",
      message: "The compatibility behavior must match the selected behaviors.",
      path: ["targetBehavior"],
    });
  }

  for (const behavior of setup.targetBehaviors) {
    if (!isTargetBehaviorForSkill(setup.primarySkill, behavior)) {
      context.addIssue({
        code: "custom",
        message: "Choose behaviors that belong to the main skill.",
        path: ["targetBehaviors"],
      });
      break;
    }
  }

  if (
    setup.situationMode === "learner_provided" &&
    setup.situationDetail === null
  ) {
    context.addIssue({
      code: "custom",
      message: "Describe the situation you want to practice.",
      path: ["situationDetail"],
    });
  }

  if (
    setup.situationMode === "choose_for_me" &&
    setup.situationDetail !== null
  ) {
    context.addIssue({
      code: "custom",
      message:
        "Remove the custom situation when OpenlyTalk is choosing one for you.",
      path: ["situationDetail"],
    });
  }
}

export const canonicalPracticeSetupSchema = z
  .object({
    primarySkill: communicationSkillSchema,
    supportingSkill: communicationSkillSchema.nullable().default(null),
    practiceArea: practiceAreaSchema,
    context: practiceContextSchema,
    targetBehavior: targetBehaviorSchema,
    targetBehaviors: canonicalTargetBehaviorsSchema,
    desiredImpression: desiredImpressionSchema.nullable().default(null),
    situationMode: situationModeSchema,
    situationDetail: situationDetailSchema.nullable().default(null),
  })
  .superRefine(validatePracticeSetup);

const targetBehaviorOrder = new Map(
  TARGET_BEHAVIOR_VALUES.map((value, index) => [value, index]),
);

function normalizePracticeSetup(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return value;
  }

  const setup = value as Record<string, unknown>;
  const suppliedBehaviors = Array.isArray(setup.targetBehaviors)
    ? setup.targetBehaviors
    : typeof setup.targetBehavior === "string"
      ? [setup.targetBehavior]
      : [];
  const targetBehaviors = [...suppliedBehaviors].sort((left, right) => {
    const leftIndex =
      typeof left === "string"
        ? (targetBehaviorOrder.get(left as z.infer<typeof targetBehaviorSchema>) ??
          Number.MAX_SAFE_INTEGER)
        : Number.MAX_SAFE_INTEGER;
    const rightIndex =
      typeof right === "string"
        ? (targetBehaviorOrder.get(right as z.infer<typeof targetBehaviorSchema>) ??
          Number.MAX_SAFE_INTEGER)
        : Number.MAX_SAFE_INTEGER;
    return leftIndex - rightIndex;
  });

  return {
    ...setup,
    practiceArea:
      setup.practiceArea ??
      (typeof setup.context === "string" &&
      ACCEPTED_PRACTICE_CONTEXT_VALUES.includes(
        setup.context as z.infer<typeof practiceContextSchema>,
      )
        ? practiceAreaForContext(
            setup.context as z.infer<typeof practiceContextSchema>,
          )
        : setup.practiceArea),
    targetBehavior: targetBehaviors[0] ?? setup.targetBehavior,
    targetBehaviors,
  };
}

export const practiceSetupSchema = z.preprocess(
  normalizePracticeSetup,
  canonicalPracticeSetupSchema,
);

export const activePracticeSetupSchema = practiceSetupSchema.superRefine(
  (setup, context) => {
    const activeSkills: readonly string[] = COMMUNICATION_SKILL_VALUES;
    if (!activeSkills.includes(setup.primarySkill)) {
      context.addIssue({
        code: "custom",
        message: "Choose one of the current communication skills.",
        path: ["primarySkill"],
      });
    }
    if (
      setup.supportingSkill !== null &&
      !activeSkills.includes(setup.supportingSkill)
    ) {
      context.addIssue({
        code: "custom",
        message: "Choose one of the current supporting skills.",
        path: ["supportingSkill"],
      });
    }
    if (setup.supportingSkill !== null) {
      context.addIssue({
        code: "custom",
        message: "Choose one communication skill for this practice.",
        path: ["supportingSkill"],
      });
    }
    const activeContexts: readonly string[] = PRACTICE_CONTEXT_VALUES;
    if (!activeContexts.includes(setup.context)) {
      context.addIssue({
        code: "custom",
        message: "Choose one of the current practice contexts.",
        path: ["context"],
      });
    }
    if (
      activeSkills.includes(setup.primarySkill) &&
      setup.targetBehaviors.some(
        (behavior) =>
          !targetBehaviorsForSkill(setup.primarySkill).some(
            (option) => option.value === behavior,
          ),
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "Choose one of the current behaviors for this skill.",
        path: ["targetBehaviors"],
      });
    }
  },
);

export const challengeKindSchema = z.enum([
  "clarification_request",
  "brief_answer",
  "shared_update",
  "alternative_perspective",
  "mild_resistance",
  "mild_defensiveness",
]);

const planTechniqueSchema = z.object({
  familyId: techniqueFamilyIdSchema,
  title: z.string().trim().min(1).max(120),
  whyItFits: z.string().trim().min(1).max(300),
  steps: z.array(z.string().trim().min(1).max(160)).min(2).max(3),
  example: z.string().trim().min(1).max(500),
});

export const generatedPracticePlanSchema = z
  .object({
    schemaVersion: z.literal(1),
    setup: canonicalPracticeSetupSchema,
    situation: z.string().trim().min(1).max(800),
    sessionGoal: z.string().trim().min(1).max(400),
    partner: z.object({
      roleLabel: z.string().trim().min(1).max(80),
      relationshipToLearner: z.string().trim().min(1).max(240),
      immediateGoal: z.string().trim().min(1).max(300),
      knownFacts: z.array(z.string().trim().min(1).max(240)).max(8),
      unknownFacts: z.array(z.string().trim().min(1).max(240)).max(8),
      baselineTone: z.string().trim().min(1).max(160),
      prohibitedBehavior: z
        .array(z.string().trim().min(1).max(240))
        .min(1)
        .max(8),
    }),
    opening: z.object({
      speaker: z.enum(["learner", "partner"]),
      learnerCue: z.string().trim().min(1).max(400),
      partnerOpeningText: z.string().trim().min(1).max(700).nullable(),
      rationale: z.string().trim().min(1).max(300),
    }),
    technique: planTechniqueSchema,
    challenge: z.object({
      kind: challengeKindSchema,
      triggerCondition: z.string().trim().min(1).max(300),
      behavior: z.string().trim().min(1).max(300),
      repairCondition: z.string().trim().min(1).max(300),
    }),
    evidenceRubric: z.object({
      primaryDimensions: z.array(evidenceDimensionSchema).min(1).max(3),
      supportingDimension: evidenceDimensionSchema.nullable(),
      desiredImpressionCues: z
        .array(z.string().trim().min(1).max(180))
        .max(3),
    }),
    retryCriteria: z.array(z.string().trim().min(1).max(240)).min(1).max(3),
    safetyConstraints: z
      .array(z.string().trim().min(1).max(240))
      .min(1)
      .max(10),
    prohibitedAssumptions: z
      .array(z.string().trim().min(1).max(240))
      .min(1)
      .max(10),
  })
  .superRefine((plan, context) => {
    const partnerStarts = plan.opening.speaker === "partner";
    if (partnerStarts !== (plan.opening.partnerOpeningText !== null)) {
      context.addIssue({
        code: "custom",
        message:
          "A partner opening is required only when the simulation partner begins.",
        path: ["opening", "partnerOpeningText"],
      });
    }

    if (
      !isTechniqueCompatible({
        familyId: plan.technique.familyId,
        primarySkill: plan.setup.primarySkill,
        targetBehaviors: plan.setup.targetBehaviors,
      })
    ) {
      context.addIssue({
        code: "custom",
        message:
          "The selected technique must support the main skill and at least one selected behavior.",
        path: ["technique", "familyId"],
      });
    }

    const primaryDimensions = plan.evidenceRubric.primaryDimensions;
    if (new Set(primaryDimensions).size !== primaryDimensions.length) {
      context.addIssue({
        code: "custom",
        message: "Primary evidence dimensions must be distinct.",
        path: ["evidenceRubric", "primaryDimensions"],
      });
    }

    if (
      plan.evidenceRubric.supportingDimension !== null &&
      primaryDimensions.includes(plan.evidenceRubric.supportingDimension)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "The supporting evidence dimension must differ from the primary dimensions.",
        path: ["evidenceRubric", "supportingDimension"],
      });
    }

    const hasDesiredImpression = plan.setup.desiredImpression !== null;
    const hasImpressionCues =
      plan.evidenceRubric.desiredImpressionCues.length > 0;
    if (hasDesiredImpression !== hasImpressionCues) {
      context.addIssue({
        code: "custom",
        message:
          "Desired-impression cues must be present exactly when an impression is selected.",
        path: ["evidenceRubric", "desiredImpressionCues"],
      });
    }
  });

function normalizePracticePlan(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return value;
  }
  const plan = value as Record<string, unknown>;
  return {
    ...plan,
    setup: normalizePracticeSetup(plan.setup),
  };
}

export const practicePlanSchema = z.preprocess(
  normalizePracticePlan,
  generatedPracticePlanSchema,
);

export const sessionStatusSchema = z.enum(["active", "completed", "ended"]);

export const sessionPhaseSchema = z.enum([
  "briefing",
  "initial_simulation",
  "coaching_break",
  "targeted_retry",
  "finalizing",
  "final_takeaway",
]);

export const terminationReasonSchema = z.enum([
  "practice_completed",
  "response_limit",
  "user_exit",
  "boundary_repeat",
  "safety_override",
  "state_error",
]);

export const messagePhaseSchema = z.enum([
  "initial_simulation",
  "targeted_retry",
]);

export const practiceMessageSchema = z
  .object({
    id: z.string().trim().min(1),
    role: z.enum(["learner", "partner"]),
    phase: messagePhaseSchema,
    learnerResponseNumber: z
      .number()
      .int()
      .min(1)
      .max(COACHING_BETA_RULES.maxAcceptedResponses)
      .nullable(),
    sequence: z.number().int().min(0),
    text: z.string().trim().min(1).max(4_000),
    createdAt: z.string().datetime(),
  })
  .superRefine((message, context) => {
    const learnerHasNumber =
      message.role === "learner" &&
      message.learnerResponseNumber !== null;
    const partnerHasNoNumber =
      message.role === "partner" &&
      message.learnerResponseNumber === null;
    if (!learnerHasNumber && !partnerHasNoNumber) {
      context.addIssue({
        code: "custom",
        message:
          "Only learner messages have a learner response number.",
        path: ["learnerResponseNumber"],
      });
    }
  });

export const evidenceClassificationSchema = z.enum([
  "strength",
  "opportunity",
  "mixed",
  "not_observed",
]);

export const practiceEvidenceEventSchema = z
  .object({
    id: z.string().trim().min(1),
    learnerMessageIds: z.array(z.string().trim().min(1)).min(1).max(3),
    dimension: evidenceDimensionSchema,
    classification: evidenceClassificationSchema,
    observation: z.string().trim().min(1).max(500),
    setupRelevance: z.string().trim().min(1).max(300),
  })
  .refine(
    (event) =>
      new Set(event.learnerMessageIds).size === event.learnerMessageIds.length,
    {
      message: "Evidence message references must be distinct.",
      path: ["learnerMessageIds"],
    },
  );

export const helpTypeSchema = z.enum(PRACTICE_HELP_VALUES);

export const helpEventSchema = z.object({
  id: z.string().trim().min(1),
  type: helpTypeSchema,
  phase: z.enum(["initial_simulation", "targeted_retry"]),
  relatedPartnerMessageId: z.string().trim().min(1).nullable(),
  createdAt: z.string().datetime(),
});

const evidenceObservationSchema = z.object({
  title: z.string().trim().min(1).max(120),
  observation: z.string().trim().min(1).max(600),
  evidenceMessageIds: z.array(z.string().trim().min(1)).min(1).max(3),
});

export const coachingBreakSchema = z.object({
  whatWorked: evidenceObservationSchema.nullable(),
  oneImprovement: evidenceObservationSchema,
  tryItThisWay: z.object({
    originalMeaning: z.string().trim().min(1).max(500),
    naturalExample: z.string().trim().min(1).max(500),
  }),
  retryGoal: z.string().trim().min(1).max(300),
  retryPrompt: z.string().trim().min(1).max(500),
  retryTargetMessageIds: z
    .array(z.string().trim().min(1))
    .min(1)
    .max(3),
});

export const retryTargetSchema = z.object({
  learnerMessageIds: z.array(z.string().trim().min(1)).min(1).max(3),
  partnerMessageId: z.string().trim().min(1).nullable(),
  prompt: z.string().trim().min(1).max(500),
  goal: z.string().trim().min(1).max(300),
});

export const retryOutcomeSchema = z.object({
  learnerMessageId: z.string().trim().min(1),
  application: z.enum(["applied", "partly_applied", "not_yet_applied"]),
  observation: z.string().trim().min(1).max(500),
});

const englishPolishSchema = z.object({
  originalMeaningOrWords: z.string().trim().min(1).max(500),
  naturalAlternative: z.string().trim().min(1).max(500),
  briefExplanation: z.string().trim().min(1).max(400),
  learnerMessageId: z.string().trim().min(1),
});

export const retryFinalSessionTakeawaySchema = z
  .object({
    flow: z.literal("retry"),
    kind: z.enum(["full", "partial"]),
    whatYouPracticed: z.string().trim().min(1).max(500),
    whatChanged: z.object({
      initialObservation: z.string().trim().min(1).max(600),
      retryObservation: z.string().trim().min(1).max(600).nullable(),
      evidenceMessageIds: z.array(z.string().trim().min(1)).min(1).max(4),
    }),
    strongestMoment: evidenceObservationSchema.nullable(),
    keepUsingTechnique: z.object({
      title: z.string().trim().min(1).max(120),
      reminder: z.string().trim().min(1).max(400),
      personalizedExample: z.string().trim().min(1).max(500),
    }),
    englishPolish: z.array(englishPolishSchema).max(2),
    tryItInRealLife: z.string().trim().min(1).max(500),
    optionalRetell: z.string().trim().min(1).max(500).nullable(),
  })
  .superRefine((takeaway, context) => {
    const hasRetryComparison = takeaway.whatChanged.retryObservation !== null;
    if ((takeaway.kind === "full") !== hasRetryComparison) {
      context.addIssue({
        code: "custom",
        message:
          "A full takeaway requires a retry comparison; a partial takeaway must not invent one.",
        path: ["whatChanged", "retryObservation"],
      });
    }
  });

export const continuousFinalSessionTakeawaySchema = z.object({
  flow: z.literal("continuous"),
  kind: z.enum(["full", "partial"]),
  whatYouPracticed: z.string().trim().min(1).max(500),
  whatWorked: evidenceObservationSchema.nullable(),
  oneImprovement: evidenceObservationSchema,
  naturalExample: z.object({
    originalMeaning: z.string().trim().min(1).max(500),
    naturalExample: z.string().trim().min(1).max(500),
  }),
  englishPolish: z.array(englishPolishSchema).max(2),
  tryItInRealLife: z.string().trim().min(1).max(500),
  optionalRetell: z.string().trim().min(1).max(500).nullable(),
});

function normalizeFinalTakeaway(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return value;
  }
  const takeaway = value as Record<string, unknown>;
  return takeaway.flow === undefined
    ? { ...takeaway, flow: "retry" }
    : takeaway;
}

export const finalSessionTakeawaySchema = z.preprocess(
  normalizeFinalTakeaway,
  z.discriminatedUnion("flow", [
    retryFinalSessionTakeawaySchema,
    continuousFinalSessionTakeawaySchema,
  ]),
);

export const challengeStateSchema = z
  .object({
    introduced: z.boolean(),
    resolved: z.boolean(),
    evidenceMessageIds: z.array(z.string().trim().min(1)).max(4),
    conductWarningActive: z.boolean().default(false),
    conductWarningEvidenceMessageId: z
      .string()
      .trim()
      .min(1)
      .nullable()
      .default(null),
  })
  .superRefine((state, context) => {
    if (
      state.conductWarningActive !==
      (state.conductWarningEvidenceMessageId !== null)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "An active conduct warning requires its learner-message evidence.",
        path: ["conductWarningEvidenceMessageId"],
      });
    }
  });

function normalizePracticeSessionState(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return value;
  }
  const state = value as Record<string, unknown>;
  if (state.responseLimit !== undefined) return state;
  return {
    ...state,
    responseLimit:
      state.schemaVersion === 6
        ? COACHING_BETA_RULES.currentPracticeResponseLimit
        : state.schemaVersion === 5
          ? COACHING_BETA_RULES.previousTwoResponsePracticeLimit
        : state.schemaVersion === 4
          ? COACHING_BETA_RULES.previousContinuousPracticeResponseLimit
          : COACHING_BETA_RULES.maxAcceptedResponses,
  };
}

export const practiceSessionStateSchema = z.preprocess(
  normalizePracticeSessionState,
  z
  .object({
    schemaVersion: z.union([
      z.literal(3),
      z.literal(4),
      z.literal(5),
      z.literal(6),
    ]),
    practiceSessionId: z.string().trim().min(1),
    anonymousSessionId: z.string().trim().min(1),
    status: sessionStatusSchema,
    phase: sessionPhaseSchema,
    setup: practiceSetupSchema,
    plan: practicePlanSchema,
    situationReplacementCount: z.number().int().min(0).max(2).default(0),
    lastSituationReplacementKey: z
      .string()
      .trim()
      .min(16)
      .max(128)
      .nullable()
      .default(null),
    acceptedResponseCount: z
      .number()
      .int()
      .min(0)
      .max(COACHING_BETA_RULES.maxAcceptedResponses),
    responseLimit: z
      .number()
      .int()
      .min(1)
      .max(COACHING_BETA_RULES.maxAcceptedResponses),
    expectedLearnerSequence: z.number().int().min(0),
    messages: z.array(practiceMessageSchema),
    evidenceEvents: z.array(practiceEvidenceEventSchema),
    helpEvents: z.array(helpEventSchema),
    challengeState: challengeStateSchema,
    coachingBreak: coachingBreakSchema.nullable(),
    retryTarget: retryTargetSchema.nullable(),
    retryOutcome: retryOutcomeSchema.nullable(),
    takeaway: finalSessionTakeawaySchema.nullable(),
    terminationReason: terminationReasonSchema.nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
  })
  .superRefine((state, context) => {
    const messageSequences = state.messages.map((message) => message.sequence);
    if (new Set(messageSequences).size !== messageSequences.length) {
      context.addIssue({
        code: "custom",
        message: "Transcript message sequences must be unique.",
        path: ["messages"],
      });
    }

    const learnerMessages = state.messages.filter(
      (message) => message.role === "learner",
    );
    if (learnerMessages.length !== state.acceptedResponseCount) {
      context.addIssue({
        code: "custom",
        message:
          "The accepted response count must equal the number of learner transcript messages.",
        path: ["acceptedResponseCount"],
      });
    }

    const learnerResponseNumbers = learnerMessages
      .map((message) => message.learnerResponseNumber)
      .sort((left, right) => (left ?? 0) - (right ?? 0));
    const expectedResponseNumbers = Array.from(
      { length: state.acceptedResponseCount },
      (_, index) => index + 1,
    );
    if (
      JSON.stringify(learnerResponseNumbers) !==
      JSON.stringify(expectedResponseNumbers)
    ) {
      context.addIssue({
        code: "custom",
        message: "Learner response numbers must be contiguous from one.",
        path: ["messages"],
      });
    }

    if (state.phase === "briefing" && state.acceptedResponseCount !== 0) {
      context.addIssue({
        code: "custom",
        message: "The briefing cannot contain accepted learner responses.",
        path: ["acceptedResponseCount"],
      });
    }

    if (
      state.phase === "initial_simulation" &&
      state.acceptedResponseCount >= Math.min(3, state.responseLimit)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "The final accepted response must transition out of the simulation.",
        path: ["phase"],
      });
    }

    if (
      state.phase === "coaching_break" &&
      (state.responseLimit !== COACHING_BETA_RULES.maxAcceptedResponses ||
        state.acceptedResponseCount !== 3 ||
        state.coachingBreak === null ||
        state.retryTarget === null)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "The coaching break requires three responses, feedback, and a retry target.",
        path: ["phase"],
      });
    }

    if (
      state.phase === "targeted_retry" &&
      (state.responseLimit !== COACHING_BETA_RULES.maxAcceptedResponses ||
        state.acceptedResponseCount < 3 ||
        state.acceptedResponseCount > 4 ||
        state.coachingBreak === null ||
        state.retryTarget === null)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "The targeted retry requires coaching and accepts responses four or five.",
        path: ["phase"],
      });
    }

    if (
      state.phase === "final_takeaway" &&
      (state.status !== "completed" || state.takeaway === null)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "The final takeaway phase requires a completed session and takeaway.",
        path: ["phase"],
      });
    }

    if (
      state.status === "completed" &&
      (state.phase !== "final_takeaway" ||
        state.takeaway === null ||
        state.terminationReason === null)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "A completed session requires its final takeaway and termination reason.",
        path: ["status"],
      });
    }

    if (state.status === "ended" && state.terminationReason === null) {
      context.addIssue({
        code: "custom",
        message: "An ended session requires a termination reason.",
        path: ["terminationReason"],
      });
    }

    if (state.acceptedResponseCount > state.responseLimit) {
      context.addIssue({
        code: "custom",
        message: "Accepted responses cannot exceed this session's response limit.",
        path: ["acceptedResponseCount"],
      });
    }

    const expectedResponseLimit =
      state.schemaVersion === 6
        ? COACHING_BETA_RULES.currentPracticeResponseLimit
        : state.schemaVersion === 5
          ? COACHING_BETA_RULES.previousTwoResponsePracticeLimit
          : state.schemaVersion === 4
            ? COACHING_BETA_RULES.previousContinuousPracticeResponseLimit
            : COACHING_BETA_RULES.maxAcceptedResponses;
    if (state.responseLimit !== expectedResponseLimit) {
      context.addIssue({
        code: "custom",
        message: "The response limit must match the practice schema version.",
        path: ["responseLimit"],
      });
    }

    if (
      state.schemaVersion >= 4 &&
      (state.coachingBreak !== null ||
        state.retryTarget !== null ||
        state.retryOutcome !== null)
    ) {
      context.addIssue({
        code: "custom",
        message: "Continuous practices cannot contain coaching-break or retry state.",
        path: ["coachingBreak"],
      });
    }

    if (
      state.takeaway !== null &&
      ((state.schemaVersion >= 4 && state.takeaway.flow !== "continuous") ||
        (state.schemaVersion === 3 && state.takeaway.flow !== "retry"))
    ) {
      context.addIssue({
        code: "custom",
        message: "The takeaway flow must match the practice schema version.",
        path: ["takeaway", "flow"],
      });
    }

    const learnerMessageIds = new Set(
      learnerMessages.map((message) => message.id),
    );
    if (
      state.challengeState.conductWarningEvidenceMessageId !== null &&
      !learnerMessageIds.has(
        state.challengeState.conductWarningEvidenceMessageId,
      )
    ) {
      context.addIssue({
        code: "custom",
        message:
          "A conduct warning must reference an accepted learner message.",
        path: [
          "challengeState",
          "conductWarningEvidenceMessageId",
        ],
      });
    }
    for (const [index, event] of state.evidenceEvents.entries()) {
      if (
        event.learnerMessageIds.some(
          (messageId) => !learnerMessageIds.has(messageId),
        )
      ) {
        context.addIssue({
          code: "custom",
          message:
            "Communication evidence must reference accepted learner messages.",
          path: ["evidenceEvents", index, "learnerMessageIds"],
        });
      }
    }
  }),
);

export const helpRequestSchema = z.object({
  type: helpTypeSchema,
  currentPartnerMessageId: z.string().trim().min(1).nullable().default(null),
});

export const helpResponseSchema = z.object({
  type: helpTypeSchema,
  coachText: z.string().trim().min(1).max(500),
  resumesPhase: z.enum(["initial_simulation", "targeted_retry"]),
  relatedPartnerMessageId: z.string().trim().min(1).nullable(),
});

export const challengeUpdateSchema = z.enum([
  "no_change",
  "introduced",
  "resolved",
]);

const retryAssessmentSchema = z
  .object({
    application: z.enum([
      "applied",
      "partly_applied",
      "not_yet_applied",
    ]),
    observation: z.string().trim().min(1).max(500),
    fifthResponseUseful: z.boolean(),
    fifthResponseReason: z.string().trim().min(1).max(300).nullable(),
    followUpPrompt: z.string().trim().min(1).max(400).nullable(),
  })
  .superRefine((assessment, context) => {
    const hasFifthDetails =
      assessment.fifthResponseReason !== null &&
      assessment.followUpPrompt !== null;
    if (assessment.fifthResponseUseful !== hasFifthDetails) {
      context.addIssue({
        code: "custom",
        message:
          "A response-four follow-up requires one reason and one prompt.",
        path: ["fifthResponseUseful"],
      });
    }
  });

export const partnerTurnOutputSchema = z.object({
  partnerText: z.string().trim().min(1).max(900),
  evidenceEvents: z.array(practiceEvidenceEventSchema).max(4),
  challengeUpdate: challengeUpdateSchema,
  languageAssessment: z.object({
    substantiallyEnglish: z.boolean(),
  }),
  retryAssessment: retryAssessmentSchema.nullable(),
  safetyClassification: z.enum([
    "none",
    "boundary_violation",
    "safety_override",
  ]),
  boundaryAction: z.enum(["none", "warn", "end", "safety_stop"]),
});

type ParsedPracticeSetup = z.infer<typeof practiceSetupSchema>;
export type PracticeSetup = Omit<ParsedPracticeSetup, "targetBehaviors"> & {
  targetBehaviors: readonly ParsedPracticeSetup["targetBehaviors"][number][];
};
export type QuickPracticeSelection = z.infer<
  typeof quickPracticeSelectionSchema
>;
export type PracticePlan = z.infer<typeof practicePlanSchema>;
export type PracticeMessage = z.infer<typeof practiceMessageSchema>;
export type PracticeEvidenceEvent = z.infer<
  typeof practiceEvidenceEventSchema
>;
export type HelpEvent = z.infer<typeof helpEventSchema>;
export type HelpType = z.infer<typeof helpTypeSchema>;
export type HelpRequest = z.infer<typeof helpRequestSchema>;
export type HelpResponse = z.infer<typeof helpResponseSchema>;
export type CoachingBreak = z.infer<typeof coachingBreakSchema>;
export type PartnerTurnOutput = z.infer<typeof partnerTurnOutputSchema>;
export type RetryTarget = z.infer<typeof retryTargetSchema>;
export type RetryOutcome = z.infer<typeof retryOutcomeSchema>;
export type FinalSessionTakeaway = z.infer<
  typeof finalSessionTakeawaySchema
>;
export type PracticeSessionState = z.infer<
  typeof practiceSessionStateSchema
>;
export type SessionPhase = z.infer<typeof sessionPhaseSchema>;
export type SessionStatus = z.infer<typeof sessionStatusSchema>;
export type TerminationReason = z.infer<typeof terminationReasonSchema>;
