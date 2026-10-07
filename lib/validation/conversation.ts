import { z } from "zod";

import { V1_RULES } from "@/lib/product-rules";
import {
  conversationContextSchema,
  conversationTypeSchema,
} from "@/lib/validation/episode";

export const lifecycleStatusSchema = z.enum([
  "creating",
  "active",
  "debrief_pending",
  "completed",
  "ended",
  "creation_failed",
]);

export const terminationReasonSchema = z.enum([
  "meaningful_outcome",
  "response_limit",
  "user_exit",
  "boundary_repeat",
  "safety_override",
]);

export const outcomeCategorySchema = z.enum([
  "connection_reached",
  "perspective_clarified",
  "decision_reached",
  "repair_reached",
  "boundary_respected",
  "unresolved_but_acknowledged",
  "safety_ended",
]);

export const stageSchema = z.enum([
  "opening",
  "developing",
  "resolving",
  "closing",
]);

export const conversationModeSchema = z.enum(["normal", "repair"]);

export const trustLevelSchema = z.enum([
  "guarded",
  "cautious",
  "comfortable",
  "open",
]);

export const emotionKindSchema = z.enum([
  "calm",
  "curious",
  "amused",
  "pleased",
  "uncertain",
  "anxious",
  "disappointed",
  "frustrated",
  "hurt",
  "guarded",
  "hopeful",
  "relieved",
]);

export const emotionIntensitySchema = z.enum(["low", "medium", "high"]);

export const learnerIntentSchema = z.enum([
  "acknowledge",
  "ask",
  "clarify",
  "share",
  "express",
  "advise",
  "disagree",
  "set_boundary",
  "repair",
  "redirect",
  "dismiss",
]);

export const evidenceDimensionSchema = z.enum([
  "listening_acknowledgment",
  "emotional_responsiveness",
  "curiosity_questions",
  "self_expression",
  "advice_timing",
  "topical_continuity",
  "repair_behavior",
  "conversational_movement",
]);

export const evidenceClassificationSchema = z.enum([
  "supportive",
  "concerning",
  "mixed",
  "not_observed",
]);

export const safetyClassificationSchema = z.enum([
  "none",
  "friction",
  "boundary_violation",
  "safety_override",
]);

export const boundaryActionSchema = z.enum([
  "none",
  "warn",
  "end",
  "safety_stop",
]);

export const emotionSchema = z.object({
  kind: emotionKindSchema,
  intensity: emotionIntensitySchema,
  cause: z.string().trim().min(1).max(280),
  evidenceMessageId: z.string().trim().min(1).nullable(),
});

export const trustSchema = z.object({
  level: trustLevelSchema,
  supportStreak: z.number().int().min(0).max(1),
  lastChangeEvidenceIds: z.array(z.string().trim().min(1)).max(4),
});

export const evidenceEventSchema = z.object({
  learnerMessageId: z.string().trim().min(1),
  dimension: evidenceDimensionSchema,
  classification: evidenceClassificationSchema,
  note: z.string().trim().min(1).max(240),
});

export const transcriptMessageSchema = z.object({
  id: z.string().trim().min(1),
  role: z.enum(["learner", "sofia"]),
  sequence: z.number().int().min(0),
  text: z.string().trim().min(1).max(4_000),
  createdAt: z.string().datetime(),
});

export const privateFactSchema = z.object({
  fact: z.string().trim().min(1).max(500),
  relevanceCondition: z.string().trim().min(1).max(500),
});

export const scenePlanSchema = z.object({
  openingMode: z.enum(["sofia_first", "learner_first"]).default("sofia_first"),
  conversationType: conversationTypeSchema,
  context: conversationContextSchema,
  location: z.string().trim().min(1).max(160),
  personalLifeAnchor: z.string().trim().min(1).max(500),
  whySofiaBringsItUpNow: z.string().trim().min(1).max(500),
  initialEmotion: emotionSchema,
  sofiaImmediateGoal: z.string().trim().min(1).max(500),
  privateFact: privateFactSchema,
  learnerOpportunity: z.string().trim().min(1).max(500),
  stakes: z.object({
    level: z.enum(["low", "medium"]),
    description: z.string().trim().min(1).max(500),
  }),
  plausibleOutcomes: z.array(outcomeCategorySchema).min(2).max(3),
  canonConstraints: z.array(z.string().trim().min(1)).min(1).max(20),
  prohibitedInventions: z.array(z.string().trim().min(1)).min(1).max(20),
  learnerVisibleScene: z.string().trim().min(1).max(700),
  sofiaOpeningText: z.string().trim().min(1).max(1_000),
});

const topicSchema = z.string().trim().min(1).max(80);

export const conversationStateSchema = z
  .object({
    schemaVersion: z.literal(2),
    conversationId: z.string().trim().min(1),
    status: lifecycleStatusSchema,
    terminationReason: terminationReasonSchema.nullable(),
    outcomeCategory: outcomeCategorySchema.nullable(),
    conversationType: conversationTypeSchema,
    context: conversationContextSchema,
    scenePlan: scenePlanSchema.nullable(),
    stage: stageSchema,
    mode: conversationModeSchema,
    acceptedResponseCount: z
      .number()
      .int()
      .min(0)
      .max(V1_RULES.maxAcceptedResponses),
    expectedSequence: z.number().int().min(0),
    trust: trustSchema,
    emotion: emotionSchema,
    warningActive: z.boolean(),
    warningEvidenceMessageId: z.string().trim().min(1).nullable(),
    topics: z.array(topicSchema).max(12),
    privateFactRevealed: z.boolean(),
    evidenceEvents: z.array(evidenceEventSchema),
    messages: z.array(transcriptMessageSchema),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
  })
  .superRefine((state, context) => {
    if (state.stage === "opening" && state.acceptedResponseCount !== 0) {
      context.addIssue({
        code: "custom",
        message: "Opening stage requires zero accepted learner responses.",
        path: ["acceptedResponseCount"],
      });
    }

    if (state.status === "active" && state.terminationReason !== null) {
      context.addIssue({
        code: "custom",
        message: "An active conversation cannot have a termination reason.",
        path: ["terminationReason"],
      });
    }

    if (
      ["debrief_pending", "completed", "ended"].includes(state.status) &&
      state.terminationReason === null
    ) {
      context.addIssue({
        code: "custom",
        message: "A terminal or closing conversation requires a termination reason.",
        path: ["terminationReason"],
      });
    }

    if (state.warningActive !== (state.warningEvidenceMessageId !== null)) {
      context.addIssue({
        code: "custom",
        message: "Warning state and warning evidence must be set together.",
        path: ["warningEvidenceMessageId"],
      });
    }

    if (state.status === "active" && state.scenePlan === null) {
      context.addIssue({
        code: "custom",
        message: "An active conversation requires a validated scene plan.",
        path: ["scenePlan"],
      });
    }

    const sequences = state.messages.map((message) => message.sequence);
    if (new Set(sequences).size !== sequences.length) {
      context.addIssue({
        code: "custom",
        message: "Transcript message sequences must be unique.",
        path: ["messages"],
      });
    }

    if (Date.parse(state.expiresAt) <= Date.parse(state.createdAt)) {
      context.addIssue({
        code: "custom",
        message: "Expiration must occur after creation.",
        path: ["expiresAt"],
      });
    }
  });

export const nextTurnOutputSchema = z
  .object({
    languageAssessment: z.object({
      substantiallyEnglish: z.boolean(),
    }),
    interpretation: z.object({
      primaryIntent: learnerIntentSchema,
      secondaryIntent: learnerIntentSchema.nullable(),
      evidenceMessageId: z.string().trim().min(1),
    }),
    communicationEvidence: z.array(evidenceEventSchema).length(8),
    safetyClassification: safetyClassificationSchema,
    boundaryAction: boundaryActionSchema,
    stateUpdate: z.object({
      stage: stageSchema,
      mode: conversationModeSchema,
      trust: trustSchema,
      emotion: emotionSchema,
      topics: z.array(topicSchema).max(12),
      privateFactRevealed: z.boolean(),
    }),
    endingDecision: z.object({
      shouldClose: z.boolean(),
      terminationReason: terminationReasonSchema.nullable(),
      outcomeCategory: outcomeCategorySchema.nullable(),
      evidenceMessageIds: z.array(z.string().trim().min(1)).max(8),
    }),
    sofiaText: z.string().trim().min(1).max(1_200),
  })
  .superRefine((turn, context) => {
    const dimensions = turn.communicationEvidence.map(
      (event) => event.dimension,
    );
    if (new Set(dimensions).size !== 8) {
      context.addIssue({
        code: "custom",
        message: "Each communication evidence dimension must appear exactly once.",
        path: ["communicationEvidence"],
      });
    }

    if (turn.endingDecision.shouldClose) {
      if (turn.endingDecision.terminationReason === null) {
        context.addIssue({
          code: "custom",
          message: "A closing decision requires a termination reason.",
          path: ["endingDecision", "terminationReason"],
        });
      }
    } else if (
      turn.endingDecision.terminationReason !== null ||
      turn.endingDecision.outcomeCategory !== null
    ) {
      context.addIssue({
        code: "custom",
        message: "A continuing turn cannot set terminal fields.",
        path: ["endingDecision"],
      });
    }
  });

export type LifecycleStatus = z.infer<typeof lifecycleStatusSchema>;
export type TerminationReason = z.infer<typeof terminationReasonSchema>;
export type OutcomeCategory = z.infer<typeof outcomeCategorySchema>;
export type ConversationStage = z.infer<typeof stageSchema>;
export type ConversationMode = z.infer<typeof conversationModeSchema>;
export type TrustLevel = z.infer<typeof trustLevelSchema>;
export type Emotion = z.infer<typeof emotionSchema>;
export type LearnerIntent = z.infer<typeof learnerIntentSchema>;
export type EvidenceEvent = z.infer<typeof evidenceEventSchema>;
export type TranscriptMessage = z.infer<typeof transcriptMessageSchema>;
export type ScenePlan = z.infer<typeof scenePlanSchema>;
export type ConversationState = z.infer<typeof conversationStateSchema>;
export type NextTurnOutput = z.infer<typeof nextTurnOutputSchema>;
