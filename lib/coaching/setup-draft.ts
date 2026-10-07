import {
  activePracticeSetupSchema,
  describedSituationRequestSchema,
  type PracticeSetup,
} from "@/lib/coaching/schemas";
import { COACHING_BETA_RULES } from "@/lib/coaching/product-rules";

export const PRACTICE_SETUP_DRAFT_KEY =
  "openlytalk:latest-practice-setup";
export const PRACTICE_SITUATION_DRAFT_KEY =
  "openlytalk:latest-described-situation";

export function serializeDescribedSituationDraft(
  input: { background: string; goal: string },
  savedAt = Date.now(),
): string {
  return JSON.stringify({
    savedAt,
    answers: describedSituationRequestSchema.parse(input),
  });
}

export function parseDescribedSituationDraft(
  value: string | null,
  now = Date.now(),
): { background: string; goal: string } | null {
  if (value === null) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("savedAt" in parsed) ||
      typeof parsed.savedAt !== "number" ||
      !("answers" in parsed)
    ) return null;
    const maximumAge = COACHING_BETA_RULES.retentionDays * 24 * 60 * 60 * 1_000;
    if (parsed.savedAt > now || now - parsed.savedAt > maximumAge) return null;
    const answers = describedSituationRequestSchema.safeParse(parsed.answers);
    return answers.success ? answers.data : null;
  } catch {
    return null;
  }
}

export function serializePracticeSetupDraft(
  setup: PracticeSetup,
  savedAt = Date.now(),
): string {
  return JSON.stringify({
    savedAt,
    setup: activePracticeSetupSchema.parse(setup),
  });
}

export function parsePracticeSetupDraft(
  value: string | null,
  now = Date.now(),
): PracticeSetup | null {
  if (value === null) return null;

  try {
    const parsedJson: unknown = JSON.parse(value);
    if (
      typeof parsedJson !== "object" ||
      parsedJson === null ||
      !("savedAt" in parsedJson) ||
      typeof parsedJson.savedAt !== "number" ||
      !("setup" in parsedJson)
    ) {
      return null;
    }
    const maximumAge =
      COACHING_BETA_RULES.retentionDays * 24 * 60 * 60 * 1_000;
    if (parsedJson.savedAt > now || now - parsedJson.savedAt > maximumAge) {
      return null;
    }
    const parsedSetup = activePracticeSetupSchema.safeParse(parsedJson.setup);
    return parsedSetup.success ? parsedSetup.data : null;
  } catch {
    return null;
  }
}
