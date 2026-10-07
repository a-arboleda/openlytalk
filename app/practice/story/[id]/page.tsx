import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { StoryExperience } from "@/components/practice/story-experience";
export const metadata: Metadata = { title: "Your practice", description: "Speak once. Reflect on what you said." };
export default async function StoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  return <StoryExperience id={id} />;
}
