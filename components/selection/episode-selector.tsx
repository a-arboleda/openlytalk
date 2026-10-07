"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";

import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  CONTEXTS,
  CONVERSATION_TYPES,
  type ConversationContext,
  type ConversationType,
} from "@/lib/product-rules";
import { apiErrorSchema } from "@/lib/validation/api-error";
import { createEpisodeResponseSchema } from "@/lib/validation/episode";

type MicrophoneCapability = "checking" | "supported" | "unsupported";

function subscribeToMicrophoneCapability() {
  return () => undefined;
}

function readMicrophoneCapability(): MicrophoneCapability {
  return typeof window.MediaRecorder !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
    ? "supported"
    : "unsupported";
}

function readServerMicrophoneCapability(): MicrophoneCapability {
  return "checking";
}

export function EpisodeSelector() {
  const router = useRouter();
  const [conversationType, setConversationType] =
    useState<ConversationType | null>(null);
  const [context, setContext] = useState<ConversationContext | null>(null);
  const microphone = useSyncExternalStore(
    subscribeToMicrophoneCapability,
    readMicrophoneCapability,
    readServerMicrophoneCapability,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canStart =
    conversationType !== null &&
    context !== null &&
    microphone === "supported" &&
    !submitting;

  async function startEpisode() {
    if (!canStart || !conversationType || !context) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/episodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationType, context }),
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        const apiError = apiErrorSchema.safeParse(payload);
        throw new Error(
          apiError.success
            ? apiError.data.message
            : "We could not start this conversation. Please try again.",
        );
      }

      const episode = createEpisodeResponseSchema.safeParse(payload);
      if (!episode.success) {
        throw new Error(
          "The conversation response was incomplete. Please try again.",
        );
      }

      router.push(`/conversation/${episode.data.conversationId}`);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "We could not start this conversation. Please try again.",
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-10">
      <fieldset>
        <legend className="flex items-start gap-4">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-sm font-semibold text-white">
            1
          </span>
          <span>
            <span className="block text-xl font-semibold tracking-tight text-stone-950">
              What would you like to practice talking about?
            </span>
            <span className="mt-1 block text-sm leading-6 text-stone-600">
              You will begin with a real experience or point of view. Sofia will listen and respond.
            </span>
          </span>
        </legend>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {CONVERSATION_TYPES.map((option) => (
            <label key={option.value} className="group cursor-pointer">
              <input
                className="peer sr-only"
                type="radio"
                name="conversationType"
                value={option.value}
                checked={conversationType === option.value}
                onChange={() => setConversationType(option.value)}
              />
              <span className="block min-h-32 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition group-hover:border-stone-300 group-hover:shadow-md peer-checked:border-emerald-700 peer-checked:bg-emerald-50/60 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-emerald-700">
                <span className="flex items-start justify-between gap-3">
                  <span className="font-semibold text-stone-950">
                    {option.label}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 flex size-4 items-center justify-center rounded-full border text-[10px] ${
                      conversationType === option.value
                        ? "border-emerald-700 bg-emerald-700 text-white"
                        : "border-stone-300 bg-white text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                </span>
                <span className="mt-2 block text-sm leading-6 text-stone-600">
                  {option.description}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset
        className={
          conversationType
            ? "transition-opacity"
            : "pointer-events-none opacity-45"
        }
        aria-disabled={!conversationType}
      >
        <legend className="flex items-start gap-4">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-stone-200 text-sm font-semibold text-stone-700">
            2
          </span>
          <span>
            <span className="block text-xl font-semibold tracking-tight text-stone-950">
              What area would you like to explore?
            </span>
            <span className="mt-1 block text-sm leading-6 text-stone-600">
              This gives you a starting direction without choosing the topic for you.
            </span>
          </span>
        </legend>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {CONTEXTS.map((option) => (
            <label key={option.value} className="group cursor-pointer">
              <input
                className="peer sr-only"
                type="radio"
                name="context"
                value={option.value}
                checked={context === option.value}
                onChange={() => setContext(option.value)}
                disabled={!conversationType}
              />
              <span className="block min-h-28 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition group-hover:border-stone-300 group-hover:shadow-md peer-checked:border-emerald-700 peer-checked:bg-emerald-50/60 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-emerald-700">
                <span className="font-semibold text-stone-950">
                  {option.label}
                </span>
                <span className="mt-2 block text-sm leading-6 text-stone-600">
                  {option.domain}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="rounded-2xl border border-stone-200 bg-stone-50 p-5 sm:flex sm:items-center sm:justify-between sm:gap-6">
        <div>
          <p className="font-medium text-stone-900">
            {conversationType && context
              ? `${CONVERSATION_TYPES.find((option) => option.value === conversationType)?.label} · ${CONTEXTS.find((option) => option.value === context)?.label}`
              : "Choose both options to begin"}
          </p>
          <p className="mt-1 text-sm leading-6 text-stone-600">
            One private conversation with Sofia, with up to eight voice responses.
          </p>
          {microphone === "unsupported" ? (
            <p className="mt-2 max-w-xl text-sm leading-6 text-amber-800" role="alert">
              This browser cannot record a voice response. OpenlyTalk needs a
              current browser with microphone recording support.
            </p>
          ) : null}
          {error ? (
            <p className="mt-2 max-w-xl text-sm leading-6 text-red-700" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={startEpisode}
          disabled={!canStart}
          className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-emerald-700 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-600 sm:mt-0 sm:w-auto sm:min-w-40"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <LoadingSpinner />
              Getting things ready…
            </span>
          ) : microphone === "checking" ? (
            "Checking audio…"
          ) : (
            "Start conversation"
          )}
        </button>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {submitting ? "Getting your conversation with Sofia ready." : error}
      </p>
    </div>
  );
}
