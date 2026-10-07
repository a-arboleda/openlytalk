"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  COMMUNICATION_SKILLS,
  communicationSkillLabel,
  isPracticeTopicForSkill,
  practiceTopicsForSkill,
  type ActiveCommunicationSkill,
  type PracticeTopic,
} from "@/lib/coaching/product-rules";
import {
  practiceApiErrorSchema,
  practiceSessionResponseSchema,
} from "@/lib/coaching/public-contracts";

async function responseBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function SelectionCard({
  selected,
  title,
  description,
  onSelect,
}: {
  selected: boolean;
  title: string;
  description: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`w-full rounded-2xl border p-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 sm:p-4 ${
        selected
          ? "border-emerald-600 bg-emerald-50 shadow-[0_0_0_1px_rgba(5,150,105,0.08)]"
          : "border-stone-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/40"
      }`}
    >
      <span className="flex items-start justify-between gap-2 sm:gap-4">
        <span>
          <span className="block text-sm font-semibold leading-5 text-stone-950 sm:text-base sm:leading-6">
            {title}
          </span>
          <span className="mt-1 block text-xs leading-4 text-stone-600 sm:text-sm sm:leading-5">
            {description}
          </span>
        </span>
        <span
          aria-hidden="true"
          className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold sm:size-6 sm:text-xs ${
            selected
              ? "border-emerald-700 bg-emerald-700 text-white"
              : "border-stone-300 bg-white text-transparent"
          }`}
        >
          ✓
        </span>
      </span>
    </button>
  );
}

export function QuickPracticeSetup() {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState<1 | 2>(1);
  const [skill, setSkill] = useState<ActiveCommunicationSkill | null>(null);
  const [topic, setTopic] = useState<PracticeTopic | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const complete = skill !== null && topic !== null;
  const availableTopics = skill ? practiceTopicsForSkill(skill) : [];

  function selectSkill(nextSkill: ActiveCommunicationSkill) {
    setSkill(nextSkill);
    setTopic((currentTopic) =>
      currentTopic && isPracticeTopicForSkill(nextSkill, currentTopic)
        ? currentTopic
        : null,
    );
    setError(null);
  }

  async function createPractice() {
    if (!skill || !topic || creating) return;
    setCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/practice-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primarySkill: skill, topic }),
      });
      const body = await responseBody(response);
      if (!response.ok) {
        const parsed = practiceApiErrorSchema.safeParse(body);
        throw new Error(
          parsed.success
            ? parsed.data.error.message
            : "We could not create your practice. Please try again.",
        );
      }

      const result = practiceSessionResponseSchema.safeParse(body);
      if (!result.success) {
        throw new Error(
          "Your practice was created, but we could not open it. Please try again.",
        );
      }
      router.push(
        `/practice/${encodeURIComponent(
          result.data.session.practiceSessionId,
        )}`,
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "We could not create your practice. Please try again.",
      );
      setCreating(false);
    }
  }

  return (
    <section className="mx-auto flex h-[calc(100dvh-4rem)] w-full max-w-xl flex-col overflow-hidden py-4 sm:py-6">
      <div className="shrink-0">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
          Your conversation coach
        </div>
        <h1 className="mt-3 text-balance text-2xl font-semibold tracking-tight text-stone-950 sm:text-3xl">
          Practice saying what you mean.
        </h1>
        <p className="mt-2 text-sm leading-6 text-stone-600 sm:text-base">
          Make two quick choices. Your coach will create a focused speaking
          practice for you.
        </p>

        <div className="mt-4 flex items-center justify-between border-y border-stone-200 py-2">
          <button
            type="button"
            onClick={() => setActiveStep(1)}
            disabled={activeStep === 1}
            aria-label="Go back to what you want to practice"
            className="flex size-10 items-center justify-center rounded-full text-stone-700 transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:text-stone-300"
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none">
              <path d="m12.5 4.5-5.5 5.5 5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="text-center" aria-live="polite">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-800">
              Step {activeStep} of 2
            </p>
            <div className="mt-1.5 flex justify-center gap-1.5" aria-hidden="true">
              <span className={`h-1.5 w-8 rounded-full ${activeStep === 1 ? "bg-emerald-700" : "bg-stone-200"}`} />
              <span className={`h-1.5 w-8 rounded-full ${activeStep === 2 ? "bg-emerald-700" : "bg-stone-200"}`} />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveStep(2)}
            disabled={activeStep === 2 || skill === null}
            aria-label="Go to what you would like to talk about"
            className="flex size-10 items-center justify-center rounded-full text-stone-700 transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:text-stone-300"
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none">
              <path d="m7.5 4.5 5.5 5.5-5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden pt-4">
        <div
          className={`flex h-full w-full transition-transform duration-500 ease-out motion-reduce:transition-none ${
            activeStep === 1 ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <fieldset
            className="h-full w-full shrink-0 overflow-y-auto px-0.5 pb-3"
            aria-hidden={activeStep !== 1}
            inert={activeStep !== 1}
          >
            <legend className="text-lg font-semibold tracking-tight text-stone-950">
              What would you like to practice?
            </legend>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              {COMMUNICATION_SKILLS.map((option) => (
                <SelectionCard
                  key={option.value}
                  selected={skill === option.value}
                  title={option.label}
                  description={option.description}
                  onSelect={() => selectSkill(option.value)}
                />
              ))}
            </div>
          </fieldset>

          <fieldset
            className="flex h-full w-full shrink-0 flex-col overflow-y-auto px-0.5 pb-3"
            aria-hidden={activeStep !== 2}
            inert={activeStep !== 2}
          >
            <legend className="w-full">
              {skill ? (
                <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                  Your choice · {communicationSkillLabel(skill)}
                </span>
              ) : null}
              <span className="mt-2 block text-lg font-semibold tracking-tight text-stone-950">
                What would you like to talk about?
              </span>
            </legend>
            <p className="mt-1.5 text-sm leading-5 text-stone-600">
              Choose a topic that fits what you want to practice.
            </p>
            <div className="mt-3 grid gap-2.5">
              {availableTopics.map((option) => (
                <SelectionCard
                  key={option.value}
                  selected={topic === option.value}
                  title={option.label}
                  description={option.description}
                  onSelect={() => {
                    setTopic(option.value);
                    setError(null);
                  }}
                />
              ))}
            </div>

            <div className="mt-auto pt-4">
              {error ? (
                <p className="mb-2 text-center text-sm leading-5 text-red-700" role="alert">
                  {error}
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => void createPractice()}
                disabled={!complete || creating}
                className="flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-emerald-700 px-6 py-3 font-semibold text-white shadow-[0_5px_14px_rgba(4,120,87,0.18)] transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-600 disabled:shadow-none"
              >
                {creating ? (
                  <>
                    <LoadingSpinner />
                    Creating your prompt…
                  </>
                ) : (
                  <>
                    Coach me <span aria-hidden="true">→</span>
                  </>
                )}
              </button>
            </div>
          </fieldset>
        </div>
      </div>
    </section>
  );
}
