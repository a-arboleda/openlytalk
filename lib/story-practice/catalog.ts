import data from "@/lib/story-practice/catalog-data.json";
import { questionSchema, type StoryQuestion } from "@/lib/story-practice/contracts";

export function validateCatalog(records: unknown): StoryQuestion[] {
  const questions = questionSchema.array().parse(records);
  const references = new Set<string>();
  for (const question of questions) {
    const reference = `${question.id}:${question.version}`;
    if (references.has(reference)) throw new Error("Duplicate story question.");
    references.add(reference);
    if (question.text.trim().split(/\s+/).length > 16) throw new Error("Story question exceeds 16 words.");
    if (!/childhood|recent(?:ly| day)|first met|last time|past (?:six months|year|month)|when you were younger|years ago|first time|earliest|last (?:week|month|year)/i.test(question.text)) throw new Error("Story question needs a time anchor.");
  }
  const approved = questions.filter(question => question.status === "approved");
  if (new Set(approved.map(q => q.id)).size !== approved.length) throw new Error("Only one active version per question.");
  return questions;
}
export const storyCatalog = validateCatalog(data);
