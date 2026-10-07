import type { PublicStory, StoryFeedback } from "@/lib/story-practice/contracts";

export function reportFixture(mode: "free_share" | "random_question" = "free_share"): PublicStory {
  const learnerMessageId = "10000000-0000-4000-8000-000000000001";
  const observation = { text: "You kept the attempt and its outcome together.", quote: "It looked strange, but it tasted good.", learnerMessageId };
  const transcript = "Last week José and I tried baking bread. It looked strange, but it tasted good. I’d like to try again.";
  const feedback: StoryFeedback = mode === "free_share" ? {
    entryMode: mode, kind: "full", concision: { observation, nextStep: null, conciseExample: null },
  } : {
    entryMode: mode, kind: "full", whatYouPracticed: "Describing a first attempt.", whatWorked: observation,
    oneImprovement: { ...observation, text: "Add one detail to explain what looked strange." },
    concision: { observation, nextStep: "Keep the attempt and outcome close together." },
    naturalExample: { text: "Last week José and I baked bread for the first time. It looked uneven, but it tasted good.", learnerMessageId },
    englishPolish: [{ original: "tried baking bread", suggestion: "baked bread for the first time", explanation: "This makes the first attempt explicit.", learnerMessageId }],
    tryItInRealLife: "Describe one recent attempt to someone you know.",
  };
  return {
    schemaVersion: 7, id: "20000000-0000-4000-8000-000000000002", entryMode: mode,
    status: "completed", phase: "final_takeaway", responseLimit: 1, acceptedResponseCount: 1,
    expectedLearnerSequence: 1, replacementCount: 0, transcript, feedback,
    question: mode === "random_question" ? { id: "STORY-001", version: 1, text: "What did you try for the first time recently?", responseGuide: { steps: ["Name the attempt.", "Share what happened."], example: "I tried baking bread." } } : null,
    updatedAt: "2026-09-29T12:00:00.000Z", expiresAt: "2026-10-06T12:00:00.000Z",
  };
}
