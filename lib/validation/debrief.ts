import { z } from "zod";

export const DEBRIEF_SECTION_ORDER = [
  "Communication Insights",
  "English Improvements",
  "Retell the Conversation",
] as const;

const communicationInsightSchema = z.object({
  title: z.string().trim().min(1).max(120),
  observation: z.string().trim().min(1).max(800),
  evidenceMessageIds: z.array(z.string().trim().min(1)).min(1).max(4),
});

const englishImprovementSchema = z.object({
  originalMeaningOrWords: z.string().trim().min(1).max(500),
  naturalAlternative: z.string().trim().min(1).max(500),
  briefExplanation: z.string().trim().min(1).max(500),
  learnerMessageId: z.string().trim().min(1),
});

export const debriefSchema = z
  .object({
    kind: z.enum(["full", "partial"]),
    sectionOrder: z.tuple([
      z.literal(DEBRIEF_SECTION_ORDER[0]),
      z.literal(DEBRIEF_SECTION_ORDER[1]),
      z.literal(DEBRIEF_SECTION_ORDER[2]),
    ]),
    communicationInsights: z.array(communicationInsightSchema).min(1).max(3),
    englishImprovements: z.array(englishImprovementSchema).max(3),
    noHighValueEnglishImprovementMessage: z
      .string()
      .trim()
      .min(1)
      .max(300)
      .nullable(),
    retell: z.object({
      prompt: z.string().trim().min(1).max(500),
      localOnly: z.literal(true),
      evaluated: z.literal(false),
    }),
  })
  .superRefine((debrief, context) => {
    const insightCount = debrief.communicationInsights.length;
    if (debrief.kind === "full" && insightCount < 2) {
      context.addIssue({
        code: "custom",
        message: "A full debrief requires two or three Communication Insights.",
        path: ["communicationInsights"],
      });
    }

    if (debrief.kind === "partial" && insightCount > 2) {
      context.addIssue({
        code: "custom",
        message: "A partial debrief allows one or two Communication Insights.",
        path: ["communicationInsights"],
      });
    }

    const hasImprovements = debrief.englishImprovements.length > 0;
    if (
      hasImprovements ===
      (debrief.noHighValueEnglishImprovementMessage !== null)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Provide either English Improvements or the no-improvement message, not both.",
        path: ["englishImprovements"],
      });
    }
  });

export type Debrief = z.infer<typeof debriefSchema>;
