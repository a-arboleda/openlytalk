export const CONVERSATION_TYPE_VALUES = [
  "Sharing Experiences",
  "Expressing Yourself",
  "Difficult Conversations",
] as const;

export const CONTEXT_VALUES = [
  "Relationships",
  "Work",
  "Daily Life",
  "Life Moments",
] as const;

export const CONVERSATION_TYPES = [
  {
    value: CONVERSATION_TYPE_VALUES[0],
    label: "Describe or explain something",
    description:
      "Describe what happened, explain how you do something, or walk through the steps.",
  },
  {
    value: CONVERSATION_TYPE_VALUES[1],
    label: "Express what you think or feel",
    description:
      "Share a feeling, opinion, belief, preference, or reaction in your own words.",
  },
  {
    value: CONVERSATION_TYPE_VALUES[2],
    label: "Talk through something difficult",
    description:
      "Explain a problem or uncomfortable situation you are dealing with.",
  },
] as const;

export const CONTEXTS = [
  {
    value: CONTEXT_VALUES[0],
    label: "Relationships & Friendship",
    domain:
      "Family, friends, dating, support, misunderstandings, or belonging.",
  },
  {
    value: CONTEXT_VALUES[1],
    label: "Work & Ambition",
    domain:
      "Your job, coworkers, responsibilities, money goals, or something you want to build.",
  },
  {
    value: CONTEXT_VALUES[2],
    label: "Everyday Life",
    domain:
      "Routines, food, errands, rest, habits, self-care, or small daily decisions.",
  },
  {
    value: CONTEXT_VALUES[3],
    label: "Ideas & The World",
    domain:
      "Beliefs, society, current topics, life changes, future plans, or meaningful decisions.",
  },
] as const;

export function conversationTypeLabel(value: ConversationType): string {
  return CONVERSATION_TYPES.find((option) => option.value === value)?.label ?? value;
}

export function conversationContextLabel(value: ConversationContext): string {
  return CONTEXTS.find((option) => option.value === value)?.label ?? value;
}

export const V1_RULES = {
  captionsDefaultOn: false,
  learnerLevel: "B1-B2",
  language: "English",
  maxAcceptedResponses: 8,
  maxRecordingSeconds: 60,
  persistAudio: false,
  retentionDays: 7,
  textInputFallback: false,
} as const;

export type ConversationType = (typeof CONVERSATION_TYPE_VALUES)[number];
export type ConversationContext = (typeof CONTEXT_VALUES)[number];
