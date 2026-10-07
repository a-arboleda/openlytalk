import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PracticeExperience } from "@/components/practice/practice-experience";
import { databaseIdSchema } from "@/lib/validation/persistence";

export const metadata: Metadata = {
  title: "Your practice | OpenlyTalk",
  description: "A focused English communication coaching practice.",
};

export default async function PracticePage({
  params,
}: {
  params: Promise<{ practiceSessionId: string }>;
}) {
  const { practiceSessionId } = await params;
  const parsedId = databaseIdSchema.safeParse(practiceSessionId);
  if (!parsedId.success) notFound();

  return <PracticeExperience practiceSessionId={parsedId.data} />;
}
