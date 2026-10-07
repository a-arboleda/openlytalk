import type { PracticeSessionState } from "@/lib/coaching/schemas";

export type CoachSpeechContent = "coaching_break" | "final_takeaway";

function sentence(label: string, value: string): string {
  return `${label}. ${value}`;
}

/**
 * Produces learner-visible coach narration only. Private plan fields, evidence
 * identifiers, and hidden classifications never enter speech generation.
 */
export function buildCoachSpeechText(
  state: PracticeSessionState,
  content: CoachSpeechContent,
): string | null {
  if (content === "coaching_break") {
    const coaching = state.coachingBreak;
    if (!coaching) return null;

    return [
      "Here is your coaching.",
      coaching.whatWorked
        ? sentence("What worked", coaching.whatWorked.observation)
        : null,
      sentence("One adjustment", coaching.oneImprovement.observation),
      sentence("Try it this way", coaching.tryItThisWay.naturalExample),
      sentence("Your retry goal", coaching.retryGoal),
      coaching.retryPrompt,
    ]
      .filter((part): part is string => part !== null)
      .join(" ");
  }

  const takeaway = state.takeaway;
  if (!takeaway) return null;

  const polish = takeaway.englishPolish.map((item) =>
    sentence("A natural alternative", item.naturalAlternative),
  );
  if (takeaway.flow === "continuous") {
    return [
      "Here is your final feedback.",
      sentence("What you practiced", takeaway.whatYouPracticed),
      takeaway.whatWorked
        ? sentence("What worked", takeaway.whatWorked.observation)
        : null,
      sentence(
        "One improvement for next time",
        takeaway.oneImprovement.observation,
      ),
      sentence("A natural example", takeaway.naturalExample.naturalExample),
      ...polish,
      sentence("Try it in real life", takeaway.tryItInRealLife),
    ]
      .filter((part): part is string => part !== null)
      .join(" ");
  }
  return [
    "Here is your final takeaway.",
    sentence("What you practiced", takeaway.whatYouPracticed),
    sentence("What changed", takeaway.whatChanged.initialObservation),
    takeaway.whatChanged.retryObservation,
    takeaway.strongestMoment
      ? sentence(
          "Your strongest moment",
          takeaway.strongestMoment.observation,
        )
      : null,
    sentence(
      `Keep using ${takeaway.keepUsingTechnique.title}`,
      takeaway.keepUsingTechnique.reminder,
    ),
    ...polish,
    sentence("Try it in real life", takeaway.tryItInRealLife),
  ]
    .filter((part): part is string => part !== null)
    .join(" ");
}
