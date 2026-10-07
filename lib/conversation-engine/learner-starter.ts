import type {
  ConversationContext,
  ConversationType,
} from "@/lib/product-rules";

export type LearnerStarter = {
  prompt: string;
  ideas: [string, string, string];
};

const CONTEXT_LANGUAGE: Record<
  ConversationContext,
  {
    experience: string;
    process: string;
    expression: string;
    difficulty: string;
    experienceIdeas: [string, string, string];
    expressionIdeas: [string, string, string];
    difficultyIdeas: [string, string, string];
  }
> = {
  Relationships: {
    experience: "with a friend, family member, or someone close to you",
    process: "to stay connected with someone or handle a conversation",
    expression: "a relationship or someone close to you",
    difficulty: "a friend, family member, or someone close to you",
    experienceIdeas: [
      "How you stay in touch",
      "What happened in a conversation",
      "Why you handled something that way",
    ],
    expressionIdeas: [
      "A belief about relationships",
      "Something people expect from friends",
      "An opinion you have changed",
    ],
    difficultyIdeas: [
      "A boundary that feels hard",
      "A misunderstanding",
      "Something you need to say",
    ],
  },
  Work: {
    experience: "at work",
    process: "to complete a task or responsibility at work",
    expression: "work, money, or something you want to build",
    difficulty: "your job, a coworker, or a responsibility",
    experienceIdeas: [
      "How you do a regular task",
      "What happened at work",
      "How you solved a small problem",
    ],
    expressionIdeas: [
      "Whether work should feel meaningful",
      "How technology is changing work",
      "What a fair workplace looks like",
    ],
    difficultyIdeas: [
      "A problem with a coworker",
      "Too much responsibility",
      "A decision you are avoiding",
    ],
  },
  "Daily Life": {
    experience: "in your everyday life",
    process: "as part of a routine or ordinary task",
    expression: "your routines, habits, or everyday preferences",
    difficulty: "a routine, habit, or small daily responsibility",
    experienceIdeas: [
      "How you prepare or organize something",
      "Your routine, step by step",
      "What happened and why",
    ],
    expressionIdeas: [
      "How social media affects people",
      "A habit society treats as normal",
      "Something people are discussing lately",
    ],
    difficultyIdeas: [
      "A routine that is not working",
      "Something you keep postponing",
      "A small daily frustration",
    ],
  },
  "Life Moments": {
    experience: "during a life change or while reacting to something happening around you",
    process: "when making a decision, handling a change, or responding to an idea",
    expression: "your beliefs, a life change, a future plan, or something happening in the world",
    difficulty: "a belief, change, public situation, or uncertain next step",
    experienceIdeas: [
      "How something changed your mind",
      "A decision, step by step",
      "What happened and why it mattered",
    ],
    expressionIdeas: [
      "What success means to you",
      "A belief you have changed",
      "Something happening in the world",
    ],
    difficultyIdeas: [
      "An uncertain next step",
      "A belief that is hard to explain",
      "A situation with no perfect answer",
    ],
  },
};

function stableVariant(conversationId: string, count: number): number {
  const value = Array.from(conversationId).reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );
  return value % count;
}

export function buildLearnerStarter(input: {
  conversationId: string;
  conversationType: ConversationType;
  context: ConversationContext;
}): LearnerStarter {
  const language = CONTEXT_LANGUAGE[input.context];
  const prompts: Record<ConversationType, string[]> = {
    "Sharing Experiences": [
      `Tell Sofia about one small thing that happened ${language.experience} recently. It can be completely ordinary.`,
      `Explain something you do ${language.process}. Tell Sofia what you do first, what comes next, and why you do it that way.`,
      `Describe one situation ${language.experience}. Tell Sofia what happened first, what happened next, and why it mattered to you.`,
    ],
    "Expressing Yourself": [
      `Tell Sofia about something you have been thinking or feeling about ${language.expression}. It can be simple.`,
      `Share one opinion, belief, or reaction connected to ${language.expression}. It can come from your own life or something people are talking about.`,
      `Tell Sofia what you think about an idea, situation, or current topic connected to ${language.expression}. Start with your honest reaction.`,
    ],
    "Difficult Conversations": [
      `Tell Sofia about one situation involving ${language.difficulty} that has felt difficult or uncomfortable. Start wherever feels easiest.`,
      `Share a small problem involving ${language.difficulty} with Sofia. You can begin with what happened.`,
      `Think of one uncomfortable moment involving ${language.difficulty}. Tell Sofia the part you want to talk through.`,
    ],
  };
  const choices = prompts[input.conversationType];
  const ideas: Record<ConversationType, [string, string, string]> = {
    "Sharing Experiences": language.experienceIdeas,
    "Expressing Yourself": language.expressionIdeas,
    "Difficult Conversations": language.difficultyIdeas,
  };

  return {
    prompt: choices[stableVariant(input.conversationId, choices.length)],
    ideas: [...ideas[input.conversationType]],
  };
}
