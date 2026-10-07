import {
  communicationSkillLabel,
  desiredImpressionLabel,
  practiceAreaLabel,
  practiceContextLabel,
  targetBehaviorsLabel,
} from "@/lib/coaching/product-rules";
import type { PublicPracticeSession } from "@/lib/coaching/public-contracts";
import { TechniqueExampleDisclosure } from "@/components/practice/technique-example-disclosure";

export function PracticeReferencePanel({
  session,
}: {
  session: PublicPracticeSession;
}) {
  const { setup, brief } = session;
  const isSimulationPhase =
    session.phase === "initial_simulation" ||
    session.phase === "targeted_retry";
  const details = [
    {
      label: "Communication skill",
      value: communicationSkillLabel(setup.primarySkill),
    },
    {
      label: "Part of your life",
      value: practiceAreaLabel(setup.practiceArea),
    },
    {
      label: "Focus",
      value: targetBehaviorsLabel(
        setup.primarySkill,
        setup.targetBehaviors,
      ),
    },
    {
      label: "Context",
      value: practiceContextLabel(setup.context),
    },
    ...(setup.desiredImpression === null
      ? []
      : [
          {
            label: "How you want to sound",
            value: desiredImpressionLabel(setup.desiredImpression),
          },
        ]),
  ];

  return (
    <div className="rounded-3xl border border-stone-200 bg-stone-50 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-800">
        Your practice
      </p>
      {!isSimulationPhase ? (
        <dl className="mt-4 space-y-3">
          {details.map((detail) => (
            <div key={detail.label}>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-stone-500">
                {detail.label}
              </dt>
              <dd className="mt-1 text-sm leading-5 text-stone-900">
                {detail.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div
        className={
          isSimulationPhase
            ? "mt-4"
            : "mt-5 border-t border-stone-200 pt-5"
        }
      >
        <h2 className="text-sm font-semibold text-stone-950">Situation</h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          {brief.situation}
        </p>
      </div>

      <div className="mt-5 rounded-2xl bg-white p-4 shadow-[0_1px_0_rgba(28,25,23,0.04)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-violet-700">
          Keep this in mind
        </p>
        <h2 className="mt-2 text-sm font-semibold text-stone-950">
          {brief.technique.title}
        </h2>
        <ol className="mt-3 space-y-2">
          {brief.technique.steps.map((step, index) => (
            <li key={step} className="flex gap-2 text-sm leading-5 text-stone-700">
              <span className="font-semibold text-violet-700">
                {index + 1}.
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <TechniqueExampleDisclosure
          example={brief.technique.example}
          compact
        />
      </div>
    </div>
  );
}
