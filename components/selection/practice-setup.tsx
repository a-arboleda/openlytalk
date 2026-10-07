"use client";

import { useEffect, useRef, useState } from "react";

import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  COMMUNICATION_SKILLS,
  DESIRED_IMPRESSIONS,
  PRACTICE_AREAS,
  communicationSkillLabel,
  desiredImpressionLabel,
  practiceAreaLabel,
  practiceContextLabel,
  practiceContextsForArea,
  type CommunicationSkill,
  type DesiredImpression,
  type PracticeArea,
  type PracticeContext,
  type TargetBehavior,
} from "@/lib/coaching/product-rules";
import { practiceSetupSchema, type PracticeSetup } from "@/lib/coaching/schemas";

const TOTAL_STEPS = 4;

const DEFAULT_BEHAVIORS = {
  explaining_clearly: ["tell_in_logical_order"],
  responding_naturally: [
    "give_natural_first_reaction",
    "add_short_comment_or_related_thought",
    "ask_natural_follow_up",
  ],
  expressing_yourself: ["share_opinion_and_reason"],
  speaking_assertively: ["make_clear_request"],
} as const satisfies Record<string, readonly TargetBehavior[]>;

interface PracticeSetupProps {
  initialSetup?: PracticeSetup;
  initialStep?: number;
  onCreate?: (setup: PracticeSetup) => Promise<void>;
}

function ChoiceCard({
  checked,
  description,
  name,
  onChange,
  title,
  value,
}: {
  checked: boolean;
  description: string;
  name: string;
  onChange: () => void;
  title: string;
  value: string;
}) {
  return (
    <label className="group block cursor-pointer">
      <input
        className="peer sr-only"
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
      />
      <span className="flex min-h-20 items-start gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-4 text-left transition active:scale-[0.99] group-hover:border-stone-300 peer-checked:border-emerald-700 peer-checked:bg-emerald-50/70 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-emerald-700">
        <span
          aria-hidden="true"
          className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border ${
            checked
              ? "border-emerald-700 bg-emerald-700 text-white"
              : "border-stone-300 bg-white text-transparent"
          }`}
        >
          <svg viewBox="0 0 16 16" className="size-3" fill="none">
            <path d="m3.25 8 3 3 6.5-6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="font-semibold leading-5 text-stone-950">{title}</span>
          <span className="mt-1 block text-sm leading-5 text-stone-600">{description}</span>
        </span>
      </span>
    </label>
  );
}

function SelectionSnapshot({
  primarySkill,
  practiceArea,
  context,
  desiredImpression,
  step,
  onEditStep,
}: {
  primarySkill: CommunicationSkill | null;
  practiceArea: PracticeArea | null;
  context: PracticeContext | null;
  desiredImpression: DesiredImpression | null;
  step: number;
  onEditStep: (step: number) => void;
}) {
  const rows = [
    { label: "Practice focus", step: 1, value: primarySkill ? communicationSkillLabel(primarySkill) : null },
    { label: "Part of your life", step: 2, value: practiceArea ? practiceAreaLabel(practiceArea) : null },
    { label: "Context", step: 3, value: context ? practiceContextLabel(context) : null },
    {
      label: "How you’ll come across",
      step: 4,
      value: step < 4 ? null : desiredImpression ? desiredImpressionLabel(desiredImpression) : "No preference",
    },
    { label: "Situation", step: 4, value: step < 4 ? null : "OpenlyTalk will choose" },
  ];

  return (
    <div className="rounded-3xl border border-stone-200 bg-stone-50 p-5">
      <h2 className="font-semibold text-stone-950">Your practice</h2>
      <dl className="mt-4 space-y-4">
        {rows.map((row) => (
          <div key={row.label}>
            <dt>
              <button
                type="button"
                disabled={row.step > step}
                onClick={() => onEditStep(row.step)}
                className="-ml-1 min-h-7 rounded-lg px-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-emerald-800 hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:text-stone-500 disabled:hover:bg-transparent"
              >
                {row.label}
              </button>
            </dt>
            <dd className={`mt-1 text-sm leading-5 ${row.value ? "text-stone-900" : "text-stone-400"}`}>
              {row.value ?? "Not selected yet"}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function PracticeSetup({ initialSetup, initialStep = 1, onCreate }: PracticeSetupProps) {
  const [step, setStep] = useState(Math.min(Math.max(initialStep, 1), TOTAL_STEPS));
  const [primarySkill, setPrimarySkill] = useState<CommunicationSkill | null>(initialSetup?.primarySkill ?? null);
  const [practiceArea, setPracticeArea] = useState<PracticeArea | null>(initialSetup?.practiceArea ?? null);
  const [context, setContext] = useState<PracticeContext | null>(initialSetup?.context ?? null);
  const [targetBehaviors, setTargetBehaviors] = useState<TargetBehavior[]>(
    initialSetup ? [...initialSetup.targetBehaviors] : [],
  );
  const [desiredImpression, setDesiredImpression] = useState<DesiredImpression | null>(initialSetup?.desiredImpression ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  const contextOptions = practiceArea ? practiceContextsForArea(practiceArea) : [];
  const canContinue =
    (step === 1 && primarySkill !== null) ||
    (step === 2 && practiceArea !== null) ||
    (step === 3 && context !== null) ||
    step === 4;

  function chooseSkill(skill: CommunicationSkill) {
    setPrimarySkill(skill);
    setTargetBehaviors([...(DEFAULT_BEHAVIORS[skill as keyof typeof DEFAULT_BEHAVIORS] ?? ["tell_in_logical_order"])]);
  }

  function chooseArea(area: PracticeArea) {
    setPracticeArea(area);
    if (!practiceContextsForArea(area).some((option) => option.value === context)) setContext(null);
  }

  async function continueSetup() {
    if (!canContinue || submitting) return;
    if (step < TOTAL_STEPS) {
      setSubmitError(null);
      setStep((current) => current + 1);
      return;
    }

    const parsed = practiceSetupSchema.safeParse({
      primarySkill,
      supportingSkill: null,
      practiceArea,
      context,
      targetBehaviors,
      desiredImpression,
      situationMode: "choose_for_me",
      situationDetail: null,
    });
    if (!parsed.success) {
      setSubmitError("Check your selections before continuing.");
      return;
    }
    if (!onCreate) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await onCreate(parsed.data);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "We could not create your practice. Please try again.");
      setSubmitting(false);
    }
  }

  const snapshot = (
    <SelectionSnapshot
      primarySkill={primarySkill}
      practiceArea={practiceArea}
      context={context}
      desiredImpression={desiredImpression}
      step={step}
      onEditStep={(nextStep) => setStep(Math.min(nextStep, step))}
    />
  );

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,36rem)_20rem] lg:items-start lg:gap-10">
      <div className="flex min-h-[calc(100dvh-5rem)] flex-col">
        <div className="pt-5">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="font-medium text-stone-700">Step {step} of {TOTAL_STEPS}</span>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-1.5" aria-label={`Step ${step} of ${TOTAL_STEPS}`}>
            {Array.from({ length: TOTAL_STEPS }, (_, index) => (
              <span key={index} aria-hidden="true" className={`h-1.5 rounded-full ${index < step ? "bg-emerald-700" : "bg-stone-200"}`} />
            ))}
          </div>
        </div>

        <details className="mt-4 rounded-2xl border border-stone-200 bg-white p-4 lg:hidden">
          <summary className="cursor-pointer text-sm font-semibold text-stone-900">View your selections</summary>
          <div className="mt-4">{snapshot}</div>
        </details>

        <div className="flex-1 pb-28 pt-8">
          {step === 1 ? (
            <fieldset>
              <legend className="sr-only">What would you like help with?</legend>
              <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-semibold tracking-tight text-stone-950 outline-none">What would you like help with?</h1>
              <p className="mt-3 text-base leading-7 text-stone-600">Choose one broad focus. OpenlyTalk will turn it into a specific practice.</p>
              <div className="mt-7 space-y-3">
                {COMMUNICATION_SKILLS.map((option) => (
                  <ChoiceCard key={option.value} name="communicationSkill" value={option.value} checked={primarySkill === option.value} onChange={() => chooseSkill(option.value)} title={option.label} description={option.description} />
                ))}
              </div>
            </fieldset>
          ) : null}

          {step === 2 ? (
            <fieldset>
              <legend className="sr-only">Where would you like to practice it?</legend>
              <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-semibold tracking-tight text-stone-950 outline-none">Where would you like to practice it?</h1>
              <p className="mt-3 text-base leading-7 text-stone-600">Choose the broad part of your life.</p>
              <div className="mt-7 space-y-3">
                {PRACTICE_AREAS.map((option) => (
                  <ChoiceCard key={option.value} name="practiceArea" value={option.value} checked={practiceArea === option.value} onChange={() => chooseArea(option.value)} title={option.label} description={option.description} />
                ))}
              </div>
            </fieldset>
          ) : null}

          {step === 3 && practiceArea ? (
            <fieldset>
              <legend className="sr-only">Choose a context</legend>
              <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-semibold tracking-tight text-stone-950 outline-none">Choose a context</h1>
              <p className="mt-3 text-base leading-7 text-stone-600">OpenlyTalk will create a realistic situation in this setting.</p>
              <div className="mt-7 space-y-3">
                {contextOptions.map((option) => (
                  <ChoiceCard key={option.value} name="practiceContext" value={option.value} checked={context === option.value} onChange={() => setContext(option.value)} title={option.label} description={option.description} />
                ))}
              </div>
            </fieldset>
          ) : null}

          {step === 4 ? (
            <fieldset>
              <legend className="sr-only">How would you like to come across?</legend>
              <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-semibold tracking-tight text-stone-950 outline-none">How would you like to come across?</h1>
              <p className="mt-3 text-base leading-7 text-stone-600">Optional. OpenlyTalk will choose the situation and use this only to shape your delivery.</p>
              <div className="mt-7 space-y-3">
                <ChoiceCard name="desiredImpression" value="none" checked={desiredImpression === null} onChange={() => setDesiredImpression(null)} title="No preference" description="Keep the coaching focused on the communication goal." />
                {DESIRED_IMPRESSIONS.map((option) => (
                  <ChoiceCard key={option.value} name="desiredImpression" value={option.value} checked={desiredImpression === option.value} onChange={() => setDesiredImpression(option.value)} title={option.label} description={option.description} />
                ))}
              </div>
            </fieldset>
          ) : null}

          {submitError ? <p className="mt-5 text-sm leading-6 text-red-700" role="alert">{submitError}</p> : null}
        </div>

        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex w-full max-w-xl items-center gap-3 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-8">
            {step > 1 ? <button type="button" onClick={() => setStep((current) => current - 1)} disabled={submitting} className="flex min-h-12 min-w-24 items-center justify-center rounded-full border border-stone-300 bg-white px-5 font-semibold text-stone-800 hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-50">Back</button> : null}
            <button type="button" onClick={() => void continueSetup()} disabled={!canContinue || submitting} className="flex min-h-12 flex-1 items-center justify-center rounded-full bg-emerald-700 px-6 py-3 font-semibold text-white shadow-sm hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-600">
              {submitting ? <span className="flex items-center gap-2"><LoadingSpinner />Creating your practice…</span> : step === TOTAL_STEPS ? "Create my practice" : "Continue"}
            </button>
          </div>
        </div>
      </div>

      <aside className="sticky top-24 hidden pt-5 lg:block" aria-label="Your practice selections">{snapshot}</aside>
    </div>
  );
}
