export const EDITORIAL_PILLARS = [
  "clarity",
  "concision",
  "organization",
  "storytelling",
  "natural_english",
  "presence_attention",
] as const;

export type EditorialPillar = (typeof EDITORIAL_PILLARS)[number];
export type LearningFormat = "guide" | "breakdown" | "exercise" | "reflection";

export type LearningPiece = {
  id: string;
  slug: string;
  title: string;
  description: string;
  format: LearningFormat;
  primaryPillar: EditorialPillar;
  secondaryPillars: EditorialPillar[];
  level: "b1" | "b2" | "b1_b2";
  readingMinutes: number;
  art: "arch" | "circle" | "leaves" | "steps" | "window" | "pause";
  available: boolean;
  featured?: boolean;
};

export const pillarLabels: Record<EditorialPillar, string> = {
  clarity: "Clarity",
  concision: "Concision",
  organization: "Organization",
  storytelling: "Storytelling",
  natural_english: "Natural English",
  presence_attention: "Presence & attention",
};

export const learningPieces: LearningPiece[] = [
  {
    id: "LEARN-001",
    slug: "know-your-point-before-you-start-speaking",
    title: "Know your point before you start speaking",
    description:
      "A simple way to give your ideas direction before the first sentence.",
    format: "guide",
    primaryPillar: "clarity",
    secondaryPillars: ["organization"],
    level: "b1_b2",
    readingMinutes: 6,
    art: "arch",
    available: true,
    featured: true,
  },
  {
    id: "LEARN-002",
    slug: "give-context-without-overexplaining",
    title: "Give context without overexplaining",
    description:
      "Choose the context your listener needs, then move to your point.",
    format: "breakdown",
    primaryPillar: "concision",
    secondaryPillars: ["clarity"],
    level: "b1_b2",
    readingMinutes: 5,
    art: "circle",
    available: false,
  },
  {
    id: "LEARN-003",
    slug: "put-your-ideas-in-an-order-people-can-follow",
    title: "Put your ideas in an order people can follow",
    description: "Help your listener understand how one thought connects to the next.",
    format: "guide",
    primaryPillar: "organization",
    secondaryPillars: ["clarity"],
    level: "b1_b2",
    readingMinutes: 6,
    art: "steps",
    available: false,
  },
  {
    id: "LEARN-004",
    slug: "tell-a-story-around-what-changed",
    title: "Tell a story around what changed",
    description: "Give a real moment movement without adding every detail.",
    format: "guide",
    primaryPillar: "storytelling",
    secondaryPillars: ["organization", "concision"],
    level: "b1_b2",
    readingMinutes: 5,
    art: "leaves",
    available: false,
  },
  {
    id: "LEARN-005",
    slug: "choose-natural-english-that-keeps-your-meaning",
    title: "Choose natural English that keeps your meaning",
    description: "Look beyond literal translation and protect what you want to say.",
    format: "breakdown",
    primaryPillar: "natural_english",
    secondaryPillars: ["clarity"],
    level: "b1_b2",
    readingMinutes: 5,
    art: "window",
    available: false,
  },
  {
    id: "LEARN-006",
    slug: "use-pauses-to-give-your-ideas-shape",
    title: "Use pauses to give your ideas shape",
    description: "Let a pause separate ideas and give your listener time to follow.",
    format: "exercise",
    primaryPillar: "presence_attention",
    secondaryPillars: ["organization"],
    level: "b1_b2",
    readingMinutes: 4,
    art: "pause",
    available: false,
  },
];

export function learningPieceBySlug(slug: string) {
  return learningPieces.find((piece) => piece.slug === slug);
}
