const THIRD_PERSON_LEARNER_REFERENCE = /\bthe\s+learner(?:['’]s)?\b/i;
const THIRD_PERSON_LEARNER_REFERENCE_GLOBAL =
  /\bthe\s+learner(?:['’]s)?\b/gi;
const THIRD_PERSON_LEARNER_WITH_VERB =
  /\bthe\s+learner\s+(is|has|does|prefers|wants|needs|likes|chooses|thinks|believes|feels|knows|uses|asks|decides)\b/gi;

const DIRECT_VERB = {
  is: "are",
  has: "have",
  does: "do",
  prefers: "prefer",
  wants: "want",
  needs: "need",
  likes: "like",
  chooses: "choose",
  thinks: "think",
  believes: "believe",
  feels: "feel",
  knows: "know",
  uses: "use",
  asks: "ask",
  decides: "decide",
} as const;

export function hasThirdPersonLearnerReference(value: string): boolean {
  return THIRD_PERSON_LEARNER_REFERENCE.test(value);
}

export function addressLearnerDirectly(value: string): string {
  return value
    .replace(
      THIRD_PERSON_LEARNER_WITH_VERB,
      (match, verb: keyof typeof DIRECT_VERB) => {
        const capitalized = /^[A-Z]/.test(match);
        return `${capitalized ? "You" : "you"} ${DIRECT_VERB[verb.toLowerCase() as keyof typeof DIRECT_VERB]}`;
      },
    )
    .replace(
      THIRD_PERSON_LEARNER_REFERENCE_GLOBAL,
      (match) => {
        const possessive = /['’]s$/i.test(match);
        const capitalized = /^[A-Z]/.test(match);
        if (possessive) return capitalized ? "Your" : "your";
        return capitalized ? "You" : "you";
      },
    );
}
