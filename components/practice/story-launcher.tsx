"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { publicStoryResponseSchema } from "@/lib/story-practice/contracts";

import type { TodayCard } from "@/lib/story-practice/daily";

export function StoryLauncher({ today, showCategory = true }: { today: TodayCard; showCategory?: boolean }) {
  const QuestionHeading = showCategory ? "h3" : "h2";
  const router = useRouter();
  const lock = useRef(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function start(mode: "daily_question") {
    if (lock.current) return;
    lock.current = true;
    setPending(mode);
    setError(null);
    try {
      const response = await fetch("/api/story-practices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error?.message ?? "We could not open your practice. Please try again.");
      const parsed = publicStoryResponseSchema.safeParse(data);
      if (!parsed.success) throw new Error("We could not open your practice. Please try again.");
      const { session } = parsed.data;
      router.push(`/practice/story/${session.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "We could not open your practice. Please try again.");
      setPending(null);
      lock.current = false;
    }
  }
  return <>
    <article className="practice-choice practice-choice-clay daily-practice-card mx-auto max-w-3xl text-left" aria-busy={pending !== null}>
      <div className="daily-practice-heading">
        <div><p className="eyebrow">Today’s question</p>{showCategory && <h2 className="font-editorial text-ink">{today.categoryTitle}</h2>}</div>
      </div>
      <QuestionHeading className="daily-practice-question font-editorial mt-4 text-3xl leading-tight text-ink sm:text-4xl">{today.question}</QuestionHeading>
      {today.supportPrompt && <p className="mt-4 leading-7 text-muted">{today.supportPrompt}</p>}
      <p className="mt-5 leading-7 text-muted">Take a moment to think. Then explain it in your own words.</p>
      <button type="button" onClick={() => void start("daily_question")} disabled={pending !== null} className="practice-choice-button practice-choice-button-clay disabled:cursor-wait disabled:opacity-60">
        {pending ? "Opening your practice…" : "Start today’s practice"} <span aria-hidden="true">→</span>
      </button>
      <p className="mt-4 text-sm text-muted">A new question each day at midnight UTC.</p>
    </article>
    {error && <p role="alert" className="mt-6 text-sm text-red-800">{error}</p>}
    <span className="sr-only" role="status">{pending ? "Opening your practice" : ""}</span>
  </>;
}
