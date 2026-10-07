"use client";

import Link from "next/link";
import { useState } from "react";

import { TechniqueExampleDisclosure } from "@/components/practice/technique-example-disclosure";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { partnerRolePhrase } from "@/lib/coaching/partner-role-label";
import { communicationSkillLabel } from "@/lib/coaching/product-rules";
import type { PublicPracticeSession } from "@/lib/coaching/public-contracts";

export type PracticePlaybackStatus =
  | "idle"
  | "loading"
  | "playing"
  | "error";

function SpeakingBars({ label, color }: { label: string; color: string }) {
  return (
    <span className="flex h-4 items-center gap-0.5" aria-label={label}>
      {[0, 1, 2, 3].map((bar) => (
        <span
          key={bar}
          className={`speaking-bar h-3 w-0.5 rounded-full ${color}`}
        />
      ))}
    </span>
  );
}

function CoachPlaybackButton({
  session,
  content,
  playbackMessageId,
  playbackStatus,
  onPlaySpeech,
}: {
  session: PublicPracticeSession;
  content: "coaching_break" | "final_takeaway";
  playbackMessageId: string | null;
  playbackStatus: PracticePlaybackStatus;
  onPlaySpeech: (speechUrl: string, messageId: string) => void;
}) {
  const playbackId = `coach:${content}`;
  const isCurrent = playbackMessageId === playbackId;
  const isLoading = isCurrent && playbackStatus === "loading";
  const isPlaying = isCurrent && playbackStatus === "playing";
  const hasError = isCurrent && playbackStatus === "error";
  const speechUrl = `/api/practice-sessions/${encodeURIComponent(
    session.practiceSessionId,
  )}/coach-speech?content=${content}`;

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => onPlaySpeech(speechUrl, playbackId)}
        disabled={isLoading}
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-violet-100 px-4 text-sm font-semibold text-violet-900 transition hover:bg-violet-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 disabled:opacity-60"
      >
        {isLoading ? (
          <LoadingSpinner className="text-violet-700" />
        ) : isPlaying ? (
          <SpeakingBars
            label="Your coach is speaking"
            color="bg-violet-700"
          />
        ) : (
          <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="currentColor">
            <path d="M6 4.7v10.6L15 10 6 4.7Z" />
          </svg>
        )}
        {isLoading
          ? "Loading coach audio…"
          : isPlaying
            ? "Coach is speaking"
            : "Listen to your coach"}
      </button>
      <span className="sr-only" aria-live="polite">
        {isLoading
          ? "Loading coach audio."
          : isPlaying
            ? "Your coach is speaking."
            : hasError
              ? "Coach audio could not play."
              : ""}
      </span>
      {hasError ? (
        <p className="mt-2 text-xs leading-5 text-red-700" role="alert">
          Coach audio didn’t play. Tap the button to try again.
        </p>
      ) : null}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800">
      {children}
    </p>
  );
}

function promptTopicLabel(session: PublicPracticeSession): string {
  if (session.setup.context === "personal_decisions") {
    return "What matters to me";
  }
  return session.setup.practiceArea === "work" ? "Work" : "Everyday life";
}

function ResponseGuideDisclosure({
  session,
}: {
  session: PublicPracticeSession;
}) {
  const [visible, setVisible] = useState(false);
  const contentId = `response-guide-${session.practiceSessionId}`;

  return (
    <div className="mt-5 border-t border-stone-100 pt-4">
      <button
        type="button"
        aria-expanded={visible}
        aria-controls={contentId}
        onClick={() => setVisible((current) => !current)}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-1 text-left text-sm font-semibold text-emerald-800 transition hover:text-emerald-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
      >
        <span>{visible ? "Hide response guide" : "Help me shape my response"}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className={`size-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none ${
            visible ? "rotate-180" : ""
          }`}
          fill="none"
        >
          <path
            d="m5.5 7.5 4.5 4.5 4.5-4.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {visible ? (
        <div id={contentId} className="mt-3 rounded-2xl bg-stone-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.11em] text-stone-500">
            One way to organize your response
          </p>
          <ol className="mt-3 space-y-3">
            {session.brief.technique.steps.map((step, index) => (
              <li
                key={step}
                className="flex items-start gap-3 text-sm leading-5 text-stone-800"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-xs font-semibold text-white">
                  {index + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs leading-5 text-stone-500">
            Use only what helps. This is a guide, not a script.
          </p>
          <TechniqueExampleDisclosure
            example={session.brief.technique.example}
            compact
          />
        </div>
      ) : null}
    </div>
  );
}

function PromptBriefingView({
  session,
  playbackMessageId,
  playbackStatus,
  playedPartnerMessageIds,
  onPlaySpeech,
  situationReplacing,
  situationReplacementError,
  onReplaceSituation,
}: {
  session: PublicPracticeSession;
  playbackMessageId: string | null;
  playbackStatus: PracticePlaybackStatus;
  playedPartnerMessageIds: ReadonlySet<string>;
  onPlaySpeech: (
    speechUrl: string,
    messageId: string,
    singleUse?: boolean,
  ) => void;
  situationReplacing: boolean;
  situationReplacementError: string | null;
  onReplaceSituation: () => void;
}) {
  const playbackId = `prompt-${session.updatedAt}`;
  const isCurrent = playbackMessageId === playbackId;
  const isLoading = isCurrent && playbackStatus === "loading";
  const isPlaying = isCurrent && playbackStatus === "playing";
  const hasPlayed = playedPartnerMessageIds.has(playbackId);
  const playbackFailed = isCurrent && playbackStatus === "error";
  const speechUrl = `/api/practice-sessions/${encodeURIComponent(
    session.practiceSessionId,
  )}/prompt-speech`;

  return (
    <section className="pb-[calc(8rem+env(safe-area-inset-bottom))] pt-7">
      <SectionLabel>Your coach</SectionLabel>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
        Try this conversation prompt
      </h1>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
          {communicationSkillLabel(session.setup.primarySkill)}
        </span>
        <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">
          {promptTopicLabel(session)}
        </span>
      </div>

      <div className="mt-5 flex items-start gap-3 rounded-2xl bg-emerald-50 px-4 py-3">
        <div
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-emerald-800 shadow-sm"
        >
          <svg viewBox="0 0 20 20" className="size-4" fill="none">
            <path d="M5.5 6.5h9M5.5 10h6M4 16l.8-2.5A6.5 6.5 0 1 1 16.5 10a6.5 6.5 0 0 1-9.8 5.6L4 16Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="text-sm leading-6 text-emerald-950">
          Respond as you would in real life. Focus on getting your meaning
          across—not on perfect grammar.
        </p>
      </div>

      <div className="mt-4 rounded-3xl border border-stone-200 bg-white p-6 shadow-[0_1px_0_rgba(28,25,23,0.03)]">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
          Practice partner
        </p>
        <p className="text-xl font-semibold leading-8 tracking-tight text-stone-950">
          {session.brief.promptText}
        </p>
        <button
          type="button"
          onClick={() => onPlaySpeech(speechUrl, playbackId, true)}
          disabled={hasPlayed || isLoading || isPlaying}
          aria-label={
            hasPlayed
              ? "Prompt audio already played"
              : isPlaying
                ? "Prompt audio is playing"
                : "Play prompt audio once"
          }
          className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:border-stone-200 disabled:bg-stone-100 disabled:text-stone-500"
        >
          {isLoading ? (
            <LoadingSpinner className="size-4 border-stone-200 border-t-emerald-700" />
          ) : (
            <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none">
              {isPlaying ? (
                <>
                  <path d="M5 8v4M8.5 6v8M12 7.5v5M15.5 9v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </>
              ) : (
                <path d="m7 5 8 5-8 5V5Z" fill="currentColor" />
              )}
            </svg>
          )}
          {isLoading
            ? "Loading audio…"
            : isPlaying
              ? "Playing…"
              : hasPlayed
                ? "Played"
                : playbackFailed
                  ? "Try audio again"
                  : "Play prompt"}
        </button>
        <p className="mt-2 text-xs leading-5 text-stone-500">
          The prompt can be played once.
        </p>
        <ResponseGuideDisclosure session={session} />
      </div>

      <div className="mt-4">
        {session.actions.canReplaceSituation ? (
          <button
            type="button"
            onClick={onReplaceSituation}
            disabled={situationReplacing || isLoading || isPlaying}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:text-stone-400"
          >
            {situationReplacing ? (
              <>
                <LoadingSpinner className="size-4 border-stone-200 border-t-emerald-700" />
                Creating another prompt…
              </>
            ) : (
              "Try another prompt"
            )}
          </button>
        ) : (
          <p className="text-sm text-stone-500">
            You’ve viewed all three prompts for this practice.
          </p>
        )}
        {session.actions.canReplaceSituation && !situationReplacing ? (
          <p className="mt-2 text-xs leading-5 text-stone-500">
            {session.situationReplacementsRemaining === 1
              ? "1 alternative remaining"
              : `${session.situationReplacementsRemaining} alternatives remaining`}
          </p>
        ) : null}
        {situationReplacementError ? (
          <p className="mt-2 text-sm leading-5 text-red-700" role="alert">
            {situationReplacementError}
          </p>
        ) : null}
      </div>

    </section>
  );
}

function BriefingView({
  session,
  playbackMessageId,
  playbackStatus,
  playedPartnerMessageIds,
  onPlaySpeech,
  situationReplacing,
  situationReplacementError,
  onReplaceSituation,
}: {
  session: PublicPracticeSession;
  playbackMessageId: string | null;
  playbackStatus: PracticePlaybackStatus;
  playedPartnerMessageIds: ReadonlySet<string>;
  onPlaySpeech: (
    speechUrl: string,
    messageId: string,
    singleUse?: boolean,
  ) => void;
  situationReplacing: boolean;
  situationReplacementError: string | null;
  onReplaceSituation: () => void;
}) {
  if (session.experienceMode === "single_prompt") {
    return (
      <PromptBriefingView
        session={session}
        playbackMessageId={playbackMessageId}
        playbackStatus={playbackStatus}
        playedPartnerMessageIds={playedPartnerMessageIds}
        onPlaySpeech={onPlaySpeech}
        situationReplacing={situationReplacing}
        situationReplacementError={situationReplacementError}
        onReplaceSituation={onReplaceSituation}
      />
    );
  }
  const { brief } = session;

  return (
    <div className="pb-[calc(8rem+env(safe-area-inset-bottom))]">
      <section className="pt-7">
        <div className="flex items-center gap-3">
          <div
            aria-hidden="true"
            className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800"
          >
            <svg viewBox="0 0 24 24" className="size-6" fill="none">
              <path
                d="M8 10.5h8M8 14h5m-7.5 5 1-3.2A8 8 0 1 1 20 10a8 8 0 0 1-12.5 6.6L5.5 19Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <SectionLabel>Practice brief</SectionLabel>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-950">
              You’re speaking with {partnerRolePhrase(brief.partnerRole)}
            </h1>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-stone-200 bg-white p-5 shadow-[0_1px_0_rgba(28,25,23,0.03)]">
          <SectionLabel>Situation</SectionLabel>
          <p className="mt-2 text-base leading-7 text-stone-800">
            {brief.situation}
          </p>
          {session.setup.situationMode === "choose_for_me" ? (
            <div className="mt-4 border-t border-stone-200 pt-4">
              {session.actions.canReplaceSituation ? (
                <button
                  type="button"
                  onClick={onReplaceSituation}
                  disabled={situationReplacing}
                  className="inline-flex min-h-10 items-center gap-2 rounded-full border border-stone-300 px-4 text-sm font-semibold text-stone-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:border-stone-200 disabled:bg-stone-50 disabled:text-stone-400"
                >
                  {situationReplacing ? (
                    <>
                      <LoadingSpinner className="size-4 border-stone-200 border-t-emerald-700" />
                      Finding another situation…
                    </>
                  ) : (
                    "Try another situation"
                  )}
                </button>
              ) : (
                <p className="text-sm leading-5 text-stone-500">
                  You’ve viewed all three situations for this practice.
                </p>
              )}
              {session.actions.canReplaceSituation && !situationReplacing ? (
                <p className="mt-2 text-xs leading-5 text-stone-500">
                  {session.situationReplacementsRemaining === 1
                    ? "1 alternative remaining"
                    : `${session.situationReplacementsRemaining} alternatives remaining`}
                </p>
              ) : null}
              {situationReplacementError ? (
                <p className="mt-2 text-sm leading-5 text-red-700" role="alert">
                  {situationReplacementError}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="mt-3 rounded-3xl bg-stone-100 p-5">
          <SectionLabel>Your goal</SectionLabel>
          <p className="mt-2 text-base font-medium leading-7 text-stone-900">
            {brief.goal}
          </p>
          {brief.desiredImpression ? (
            <div className="mt-4 flex items-start gap-2 border-t border-stone-200 pt-4">
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                className="mt-0.5 size-4 shrink-0 text-emerald-700"
                fill="none"
              >
                <path
                  d="M10 2.5 12 7l4.5.5-3.4 3 1 4.5-4.1-2.3L5.9 15l1-4.5-3.4-3L8 7l2-4.5Z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="text-sm leading-5 text-stone-700">
                Aim to come across as{" "}
                <span className="font-semibold text-stone-900">
                  {brief.desiredImpression.toLowerCase()}
                </span>
                .
              </p>
            </div>
          ) : null}
        </div>
      </section>

      <section
        aria-labelledby="technique-title"
        className="mt-7 rounded-3xl border border-emerald-200 bg-emerald-50/70 p-5"
      >
        <div className="flex items-start gap-3">
          <div
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-800 shadow-sm"
          >
            <svg viewBox="0 0 20 20" className="size-5" fill="none">
              <path
                d="M7.5 14.5h5M8 17h4m3-9.2a5 5 0 1 0-8.5 3.6c.7.7 1.1 1.4 1.2 2.1h4.6c.1-.7.5-1.4 1.2-2.1A5 5 0 0 0 15 7.8Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <SectionLabel>Try this technique</SectionLabel>
            <h2
              id="technique-title"
              className="mt-1 text-xl font-semibold tracking-tight text-stone-950"
            >
              {brief.technique.title}
            </h2>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-stone-700">
          {brief.technique.whyItFits}
        </p>
        <ol className="mt-4 space-y-3">
          {brief.technique.steps.map((step, index) => (
            <li key={step} className="flex items-start gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-xs font-semibold text-white">
                {index + 1}
              </span>
              <span className="pt-0.5 text-sm font-medium leading-5 text-stone-900">
                {step}
              </span>
            </li>
          ))}
        </ol>

        <TechniqueExampleDisclosure example={brief.technique.example} />
      </section>

      <section className="mt-5 rounded-3xl border border-stone-200 bg-white p-5">
        <SectionLabel>Who begins</SectionLabel>
        <p className="mt-2 text-base font-semibold text-stone-950">
          {brief.opening.speaker === "learner"
            ? "You begin"
            : `${brief.partnerRole} begins`}
        </p>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          {brief.opening.learnerCue}
        </p>
      </section>

      <div className="mt-6 rounded-2xl bg-stone-100 px-4 py-3 text-center text-sm leading-5 text-stone-600">
        Take a moment to review your goal and technique before you begin.
      </div>
      <p className="mx-auto mt-4 max-w-sm px-4 text-center text-xs leading-5 text-stone-500">
        The simulation partner’s voice is generated by AI.
      </p>
    </div>
  );
}

function SimulationView({
  session,
  captionsOn,
  playbackMessageId,
  playbackStatus,
  playedPartnerMessageIds,
  onPlaySpeech,
  reviewMode,
  closingAudioPending,
  onBackToFeedback,
  onContinueWithoutClosingAudio,
}: {
  session: PublicPracticeSession;
  captionsOn: boolean;
  playbackMessageId: string | null;
  playbackStatus: PracticePlaybackStatus;
  playedPartnerMessageIds: ReadonlySet<string>;
  onPlaySpeech: (
    speechUrl: string,
    messageId: string,
    singleUse?: boolean,
  ) => void;
  reviewMode: boolean;
  closingAudioPending: boolean;
  onBackToFeedback: () => void;
  onContinueWithoutClosingAudio: () => void;
}) {
  const [captionOverrides, setCaptionOverrides] = useState<
    Record<string, boolean>
  >({});

  function toggleCaption(messageId: string) {
    const currentlyVisible =
      captionOverrides[messageId] ?? captionsOn;
    setCaptionOverrides((current) => ({
      ...current,
      [messageId]: !currentlyVisible,
    }));
  }

  const visibleMessages =
    session.phase === "targeted_retry"
      ? session.messages.filter(
          (message) => message.phase === "targeted_retry",
        )
      : session.messages;

  return (
    <section className="pb-40 pt-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <SectionLabel>{reviewMode ? "Conversation" : "Simulation"}</SectionLabel>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
            {reviewMode
              ? "Your conversation"
              : `Practice with ${partnerRolePhrase(session.brief.partnerRole)}`}
          </h1>
        </div>
        {reviewMode && !closingAudioPending ? (
          <button
            type="button"
            onClick={onBackToFeedback}
            className="min-h-10 shrink-0 rounded-full border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          >
            Back to feedback
          </button>
        ) : null}
      </div>
      {reviewMode && closingAudioPending ? (
        <div className="mt-5 rounded-2xl bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900">
          The conversation will finish before your feedback appears.
        </div>
      ) : null}
      {reviewMode &&
      closingAudioPending &&
      playbackStatus === "error" ? (
        <button
          type="button"
          onClick={onContinueWithoutClosingAudio}
          className="mt-3 min-h-10 rounded-full px-4 text-sm font-semibold text-stone-600 transition hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        >
          Continue without audio
        </button>
      ) : null}
      {session.messages.length === 0 ? (
        <div className="mt-6 rounded-3xl bg-emerald-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-800">
            You begin
          </p>
          <p className="mt-2 text-base leading-7 text-stone-800">
            {session.brief.opening.learnerCue}
          </p>
        </div>
      ) : null}
      {session.phase === "targeted_retry" && session.retryTarget ? (
        <div className="mt-6 rounded-3xl border border-violet-200 bg-violet-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-800">
            {session.acceptedResponseCount >= 4
              ? "Final follow-up"
              : "Your retry"}
          </p>
          <p className="mt-2 text-base font-semibold leading-7 text-stone-950">
            {session.retryTarget.prompt}
          </p>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Focus on: {session.retryTarget.goal}
          </p>
        </div>
      ) : null}
      <div className="mt-6 space-y-3">
        {visibleMessages.map((message) => {
          const captionVisible =
            captionOverrides[message.id] ?? captionsOn;
          const isCurrentAudio =
            playbackMessageId === message.id;
          const isPlaying =
            isCurrentAudio && playbackStatus === "playing";
          const isLoading =
            isCurrentAudio && playbackStatus === "loading";
          const hasPlayed = playedPartnerMessageIds.has(message.id);

          return (
            <article
              key={message.id}
              className={`rounded-3xl p-5 ${
                message.role === "learner"
                  ? "ml-7 bg-emerald-700 text-white"
                  : "mr-7 border border-stone-200 bg-white text-stone-900"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <p
                    className={`text-xs font-semibold uppercase tracking-[0.12em] ${
                      message.role === "learner"
                        ? "text-emerald-100"
                        : "text-stone-500"
                    }`}
                  >
                    {message.speakerLabel}
                  </p>
                  {isPlaying ? (
                    <SpeakingBars
                      label={`${message.speakerLabel} is speaking`}
                      color="bg-emerald-600"
                    />
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => toggleCaption(message.id)}
                  aria-label={
                    captionVisible ? "Hide this caption" : "Show this caption"
                  }
                  className={`flex size-9 items-center justify-center rounded-full ${
                    message.role === "learner"
                      ? "text-emerald-50 hover:bg-emerald-800"
                      : "text-stone-500 hover:bg-stone-100"
                  }`}
                >
                  <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none">
                    {captionVisible ? (
                      <>
                        <path
                          d="M2.5 10s2.7-4 7.5-4 7.5 4 7.5 4-2.7 4-7.5 4-7.5-4-7.5-4Z"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                        <circle cx="10" cy="10" r="2" stroke="currentColor" strokeWidth="1.5" />
                      </>
                    ) : (
                      <>
                        <path
                          d="M3 3 17 17M8.4 6.2A8.8 8.8 0 0 1 10 6c4.8 0 7.5 4 7.5 4a10.7 10.7 0 0 1-2 2.2M6 7.4A10.5 10.5 0 0 0 2.5 10s2.7 4 7.5 4c.7 0 1.4-.1 2-.3"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </>
                    )}
                  </svg>
                </button>
              </div>

              {captionVisible ? (
                <p className="mt-2 text-sm leading-6">{message.text}</p>
              ) : (
                <p
                  className={`mt-2 text-sm ${
                    message.role === "learner"
                      ? "text-emerald-100"
                      : "text-stone-500"
                  }`}
                >
                  Caption hidden
                </p>
              )}

              {message.speechUrl ? (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      onPlaySpeech(
                        message.speechUrl as string,
                        message.id,
                        true,
                      )
                    }
                    disabled={isLoading || isPlaying || hasPlayed}
                    aria-label={
                      hasPlayed
                        ? `${message.speakerLabel}'s message has been played`
                        : `Play ${message.speakerLabel}'s message once`
                    }
                    className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full bg-stone-100 px-4 text-sm font-semibold text-stone-800 hover:bg-stone-200 disabled:opacity-60"
                  >
                    {isLoading ? (
                      <LoadingSpinner className="text-emerald-700" />
                    ) : (
                      <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="currentColor">
                        <path d="M6 4.7v10.6L15 10 6 4.7Z" />
                      </svg>
                    )}
                    {isLoading
                      ? "Loading audio…"
                      : isPlaying
                        ? "Playing…"
                        : hasPlayed
                          ? "Played"
                          : "Play once"}
                  </button>
                  <span className="sr-only" aria-live="polite">
                    {isLoading
                      ? `Loading ${message.speakerLabel}'s audio.`
                      : isPlaying
                        ? `${message.speakerLabel} is speaking.`
                        : ""}
                  </span>
                </>
              ) : null}
              {isCurrentAudio &&
              playbackStatus === "error" &&
              !hasPlayed ? (
                <p className="mt-2 text-xs leading-5 text-red-700" role="alert">
                  Audio didn’t play. Tap Play to try again.
                </p>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function CoachingView({
  session,
  playbackMessageId,
  playbackStatus,
  onPlaySpeech,
  retryStarting,
  retryError,
  onBeginRetry,
}: {
  session: PublicPracticeSession;
  playbackMessageId: string | null;
  playbackStatus: PracticePlaybackStatus;
  onPlaySpeech: (speechUrl: string, messageId: string) => void;
  retryStarting: boolean;
  retryError: string | null;
  onBeginRetry: () => void;
}) {
  const coaching = session.coachingBreak;
  if (!coaching) return <PreparingView label="Preparing your coaching…" />;

  return (
    <section className="py-7">
      <SectionLabel>Your coach</SectionLabel>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
        One focused adjustment
      </h1>
      <CoachPlaybackButton
        session={session}
        content="coaching_break"
        playbackMessageId={playbackMessageId}
        playbackStatus={playbackStatus}
        onPlaySpeech={onPlaySpeech}
      />
      <div className="mt-6 space-y-3">
        {coaching.whatWorked ? (
          <div className="rounded-3xl bg-emerald-50 p-5">
            <h2 className="font-semibold text-stone-950">
              {coaching.whatWorked.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-stone-700">
              {coaching.whatWorked.observation}
            </p>
          </div>
        ) : null}
        <div className="rounded-3xl border border-stone-200 bg-white p-5">
          <h2 className="font-semibold text-stone-950">
            {coaching.oneImprovement.title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-stone-700">
            {coaching.oneImprovement.observation}
          </p>
        </div>
        <div className="rounded-3xl bg-stone-100 p-5">
          <h2 className="font-semibold text-stone-950">
            Try it this way
          </h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            {coaching.tryItThisWay.originalMeaning}
          </p>
          <p className="mt-3 rounded-2xl bg-white p-4 text-sm font-medium leading-6 text-stone-900">
            “{coaching.tryItThisWay.naturalExample}”
          </p>
        </div>
        <div className="rounded-3xl border border-violet-200 bg-violet-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-800">
            Your retry goal
          </p>
          <h2 className="mt-2 font-semibold text-stone-950">
            {coaching.retryGoal}
          </h2>
          <p className="mt-2 text-sm leading-6 text-stone-700">
            {coaching.retryPrompt}
          </p>
        </div>
      </div>
      {retryError ? (
        <p
          className="mt-4 text-center text-sm leading-5 text-red-700"
          role="alert"
        >
          {retryError}
        </p>
      ) : null}
      <button
        type="button"
        onClick={onBeginRetry}
        disabled={retryStarting}
        className="mt-6 flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-violet-700 px-6 font-semibold text-white hover:bg-violet-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 disabled:bg-stone-300 disabled:text-stone-600"
      >
        {retryStarting ? (
          <>
            <LoadingSpinner />
            Opening retry…
          </>
        ) : (
          "Try again"
        )}
      </button>
    </section>
  );
}

function SinglePromptResponseView({
  session,
  reviewMode,
  onBackToFeedback,
}: {
  session: PublicPracticeSession;
  reviewMode: boolean;
  onBackToFeedback: () => void;
}) {
  const learnerMessage = session.messages.find(
    (message) => message.role === "learner",
  );

  return (
    <section className="pb-40 pt-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <SectionLabel>{reviewMode ? "Your response" : "Conversation practice"}</SectionLabel>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
            {reviewMode ? "What your coach heard" : "Say what you would really say"}
          </h1>
        </div>
        {reviewMode ? (
          <button
            type="button"
            onClick={onBackToFeedback}
            className="min-h-10 shrink-0 rounded-full border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          >
            Back to feedback
          </button>
        ) : null}
      </div>

      <div className="mt-6 rounded-3xl border border-stone-200 bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
          Practice partner
        </p>
        <p className="mt-2 text-lg font-semibold leading-8 text-stone-950">
          {session.brief.promptText}
        </p>
      </div>

      {learnerMessage ? (
        <div className="mt-4 rounded-3xl bg-emerald-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-800">
            Your response
          </p>
          <p className="mt-2 text-sm leading-7 text-stone-800">
            {learnerMessage.text}
          </p>
        </div>
      ) : (
        <p className="mt-5 text-center text-sm leading-6 text-stone-600">
          Take your time. You can listen to your recording and review its
          transcript before sending it.
        </p>
      )}
    </section>
  );
}

function TakeawayView({
  session,
  playbackMessageId,
  playbackStatus,
  onPlaySpeech,
  onViewConversation,
}: {
  session: PublicPracticeSession;
  playbackMessageId: string | null;
  playbackStatus: PracticePlaybackStatus;
  onPlaySpeech: (speechUrl: string, messageId: string) => void;
  onViewConversation: () => void;
}) {
  const takeaway = session.takeaway;
  if (!takeaway) return <PreparingView label="Preparing your takeaway…" />;

  return (
    <section className="py-7">
      <SectionLabel>Your coach</SectionLabel>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
        Feedback on your response
      </h1>
      {session.experienceMode === "conversation_simulation" ? (
        <CoachPlaybackButton
          session={session}
          content="final_takeaway"
          playbackMessageId={playbackMessageId}
          playbackStatus={playbackStatus}
          onPlaySpeech={onPlaySpeech}
        />
      ) : null}
      <h2 className="mt-6 font-semibold text-stone-950">What you practiced</h2>
      <p className="mt-2 text-base leading-7 text-stone-700">
        {takeaway.whatYouPracticed}
      </p>
      <button
        type="button"
        onClick={onViewConversation}
        className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none">
          <path d="M5 6.5h10M5 10h7M5 13.5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        {session.experienceMode === "single_prompt"
          ? "View response"
          : "View conversation"}
      </button>
      {takeaway.flow === "continuous" ? (
        <>
          {takeaway.whatWorked ? (
            <div className="mt-6 rounded-3xl bg-emerald-50 p-5">
              <h2 className="font-semibold text-stone-950">What came across well</h2>
              <p className="mt-2 text-sm font-semibold text-stone-900">
                {takeaway.whatWorked.title}
              </p>
              <p className="mt-1 text-sm leading-6 text-stone-700">
                {takeaway.whatWorked.observation}
              </p>
            </div>
          ) : null}
          <div className="mt-3 rounded-3xl border border-stone-200 bg-white p-5">
            <h2 className="font-semibold text-stone-950">
              One thing to try next
            </h2>
            <p className="mt-2 text-sm font-semibold text-stone-900">
              {takeaway.oneImprovement.title}
            </p>
            <p className="mt-1 text-sm leading-6 text-stone-700">
              {takeaway.oneImprovement.observation}
            </p>
          </div>
          <div className="mt-3 rounded-3xl bg-violet-50 p-5">
            <h2 className="font-semibold text-stone-950">How you could say it</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              {takeaway.naturalExample.originalMeaning}
            </p>
            <p className="mt-3 rounded-2xl bg-white p-4 text-sm leading-6 text-stone-800">
              “{takeaway.naturalExample.naturalExample}”
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="mt-6 rounded-3xl bg-emerald-50 p-5">
            <h2 className="font-semibold text-stone-950">What changed</h2>
            <p className="mt-2 text-sm leading-6 text-stone-700">
              {takeaway.whatChanged.initialObservation}
            </p>
            {takeaway.whatChanged.retryObservation ? (
              <p className="mt-3 text-sm leading-6 text-stone-700">
                {takeaway.whatChanged.retryObservation}
              </p>
            ) : null}
          </div>
          {takeaway.strongestMoment ? (
            <div className="mt-3 rounded-3xl border border-stone-200 bg-white p-5">
              <h2 className="font-semibold text-stone-950">Your strongest moment</h2>
              <p className="mt-2 text-sm font-semibold text-stone-900">
                {takeaway.strongestMoment.title}
              </p>
              <p className="mt-1 text-sm leading-6 text-stone-700">
                {takeaway.strongestMoment.observation}
              </p>
            </div>
          ) : null}
          <div className="mt-3 rounded-3xl bg-violet-50 p-5">
            <h2 className="font-semibold text-stone-950">
              Keep using {takeaway.keepUsingTechnique.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-stone-700">
              {takeaway.keepUsingTechnique.reminder}
            </p>
            <p className="mt-3 rounded-2xl bg-white p-4 text-sm leading-6 text-stone-800">
              “{takeaway.keepUsingTechnique.personalizedExample}”
            </p>
          </div>
        </>
      )}
      <div className="mt-3 rounded-3xl border border-stone-200 bg-white p-5">
        <h2 className="font-semibold text-stone-950">
          A little English polish
        </h2>
        {takeaway.englishPolish.length === 0 ? (
          <p className="mt-2 text-sm leading-6 text-stone-600">
            No high-value language change is needed from this practice.
          </p>
        ) : (
          <div className="mt-3 space-y-4">
            {takeaway.englishPolish.map((item) => (
              <div key={`${item.originalMeaningOrWords}-${item.naturalAlternative}`}>
                <p className="text-sm text-stone-500">
                  {item.originalMeaningOrWords}
                </p>
                <p className="mt-1 text-sm font-semibold leading-6 text-stone-900">
                  {item.naturalAlternative}
                </p>
                <p className="mt-1 text-xs leading-5 text-stone-600">
                  {item.briefExplanation}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="mt-3 rounded-3xl bg-stone-100 p-5">
        <h2 className="font-semibold text-stone-950">
          Try it in real life
        </h2>
        <p className="mt-2 text-sm leading-6 text-stone-700">
          {takeaway.tryItInRealLife}
        </p>
      </div>
      {takeaway.optionalRetell ? (
        <div className="mt-3 rounded-3xl border border-stone-200 bg-white p-5">
          <h2 className="font-semibold text-stone-950">
            Optional retell
          </h2>
          <p className="mt-2 text-sm leading-6 text-stone-700">
            {takeaway.optionalRetell}
          </p>
        </div>
      ) : null}
      <Link
        href={session.experienceMode === "single_prompt" ? "/" : "/practice/new"}
        className="mt-6 flex min-h-12 items-center justify-center rounded-full bg-emerald-700 px-6 font-semibold text-white"
      >
        Start another practice
      </Link>
    </section>
  );
}

function PreparingView({
  label,
  retrying = false,
  error = null,
  onRetry,
}: {
  label: string;
  retrying?: boolean;
  error?: string | null;
  onRetry?: () => void;
}) {
  return (
    <div
      className="flex min-h-[60dvh] flex-col items-center justify-center text-center"
      role="status"
    >
      <span className="size-7 animate-spin rounded-full border-2 border-stone-200 border-t-emerald-700 motion-reduce:animate-none" />
      <p className="mt-4 text-sm font-medium text-stone-600">{label}</p>
      {error ? (
        <>
          <p className="mt-3 max-w-sm text-sm leading-6 text-red-700" role="alert">
            {error}
          </p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              disabled={retrying}
              className="mt-5 flex min-h-12 items-center justify-center gap-2 rounded-full bg-emerald-700 px-6 font-semibold text-white disabled:bg-stone-300 disabled:text-stone-600"
            >
              {retrying ? (
                <>
                  <LoadingSpinner />
                  Trying again…
                </>
              ) : (
                "Try preparing again"
              )}
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export function PracticePhaseView({
  session,
  captionsOn = false,
  playbackMessageId = null,
  playbackStatus = "idle",
  playedPartnerMessageIds = new Set<string>(),
  onPlaySpeech = () => {},
  retryStarting = false,
  retryError = null,
  onBeginRetry = () => {},
  finalizationRetrying = false,
  finalizationError = null,
  onRetryFinalization = () => {},
  situationReplacing = false,
  situationReplacementError = null,
  onReplaceSituation = () => {},
  showConversationReview = false,
  closingAudioPending = false,
  onViewConversation = () => {},
  onBackToFeedback = () => {},
  onContinueWithoutClosingAudio = () => {},
}: {
  session: PublicPracticeSession;
  captionsOn?: boolean;
  playbackMessageId?: string | null;
  playbackStatus?: PracticePlaybackStatus;
  playedPartnerMessageIds?: ReadonlySet<string>;
  onPlaySpeech?: (
    speechUrl: string,
    messageId: string,
    singleUse?: boolean,
  ) => void;
  retryStarting?: boolean;
  retryError?: string | null;
  onBeginRetry?: () => void;
  finalizationRetrying?: boolean;
  finalizationError?: string | null;
  onRetryFinalization?: () => void;
  situationReplacing?: boolean;
  situationReplacementError?: string | null;
  onReplaceSituation?: () => void;
  showConversationReview?: boolean;
  closingAudioPending?: boolean;
  onViewConversation?: () => void;
  onBackToFeedback?: () => void;
  onContinueWithoutClosingAudio?: () => void;
}) {
  if (session.status === "ended") {
    return (
      <section className="py-12 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-950">
          This practice has ended.
        </h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          You can begin a new focused practice whenever you’re ready.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-emerald-700 px-6 font-semibold text-white"
        >
          New practice
        </Link>
      </section>
    );
  }

  switch (session.phase) {
    case "briefing":
      return (
        <BriefingView
          session={session}
          playbackMessageId={playbackMessageId}
          playbackStatus={playbackStatus}
          playedPartnerMessageIds={playedPartnerMessageIds}
          onPlaySpeech={onPlaySpeech}
          situationReplacing={situationReplacing}
          situationReplacementError={situationReplacementError}
          onReplaceSituation={onReplaceSituation}
        />
      );
    case "initial_simulation":
    case "targeted_retry":
      if (session.experienceMode === "single_prompt") {
        return (
          <SinglePromptResponseView
            session={session}
            reviewMode={false}
            onBackToFeedback={() => {}}
          />
        );
      }
      return (
        <SimulationView
          session={session}
          captionsOn={captionsOn}
          playbackMessageId={playbackMessageId}
          playbackStatus={playbackStatus}
          playedPartnerMessageIds={playedPartnerMessageIds}
          onPlaySpeech={onPlaySpeech}
          reviewMode={false}
          closingAudioPending={false}
          onBackToFeedback={() => {}}
          onContinueWithoutClosingAudio={() => {}}
        />
      );
    case "coaching_break":
      return (
        <CoachingView
          session={session}
          playbackMessageId={playbackMessageId}
          playbackStatus={playbackStatus}
          onPlaySpeech={onPlaySpeech}
          retryStarting={retryStarting}
          retryError={retryError}
          onBeginRetry={onBeginRetry}
        />
      );
    case "finalizing":
      return (
        <PreparingView
          label="Preparing your takeaway…"
          retrying={finalizationRetrying}
          error={finalizationError}
          onRetry={
            session.actions.canResumeFinalization
              ? onRetryFinalization
              : undefined
          }
        />
      );
    case "final_takeaway":
      if (showConversationReview) {
        if (session.experienceMode === "single_prompt") {
          return (
            <SinglePromptResponseView
              session={session}
              reviewMode
              onBackToFeedback={onBackToFeedback}
            />
          );
        }
        return (
          <SimulationView
            session={session}
            captionsOn={captionsOn}
            playbackMessageId={playbackMessageId}
            playbackStatus={playbackStatus}
            playedPartnerMessageIds={playedPartnerMessageIds}
            onPlaySpeech={onPlaySpeech}
            reviewMode
            closingAudioPending={closingAudioPending}
            onBackToFeedback={onBackToFeedback}
            onContinueWithoutClosingAudio={onContinueWithoutClosingAudio}
          />
        );
      }
      return (
        <TakeawayView
          session={session}
          playbackMessageId={playbackMessageId}
          playbackStatus={playbackStatus}
          onPlaySpeech={onPlaySpeech}
          onViewConversation={onViewConversation}
        />
      );
  }
}
