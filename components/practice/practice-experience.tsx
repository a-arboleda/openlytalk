"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  PracticePhaseView,
  type PracticePlaybackStatus,
} from "@/components/practice/practice-phase-view";
import { PracticeReferencePanel } from "@/components/practice/practice-reference-panel";
import {
  PracticeRecorder,
  type PracticePendingRecording,
} from "@/components/practice/practice-recorder";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  practiceApiErrorSchema,
  deletePracticeResponseSchema,
  endPracticeResponseSchema,
  practiceSessionResponseSchema,
  practiceTranscriptionPreviewResponseSchema,
  practiceTurnResponseSchema,
  replacePracticeSituationResponseSchema,
  retryPracticeResponseSchema,
  startPracticeResponseSchema,
  type PublicPracticeSession,
} from "@/lib/coaching/public-contracts";
import { PRACTICE_SITUATION_DRAFT_KEY } from "@/lib/coaching/setup-draft";

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; session: PublicPracticeSession }
  | { kind: "expired"; message: string }
  | { kind: "unavailable"; message: string }
  | { kind: "error"; message: string };

async function responseBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function readPlayedPartnerMessageIds(storageKey: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const stored = window.sessionStorage.getItem(storageKey);
    const parsed: unknown = stored ? JSON.parse(stored) : [];
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((value): value is string => typeof value === "string")
        : [],
    );
  } catch {
    return new Set();
  }
}

async function requestPracticeEnd(input: {
  practiceSessionId: string;
  expectedUpdatedAt: string;
}): Promise<PublicPracticeSession> {
  const response = await fetch(
    `/api/practice-sessions/${encodeURIComponent(
      input.practiceSessionId,
    )}/end`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedUpdatedAt: input.expectedUpdatedAt,
      }),
    },
  );
  const body = await responseBody(response);
  if (!response.ok) {
    const error = practiceApiErrorSchema.safeParse(body);
    throw new Error(
      error.success
        ? error.data.error.message
        : "We could not finish this practice. Please try again.",
    );
  }
  const result = endPracticeResponseSchema.safeParse(body);
  if (!result.success) {
    throw new Error(
      "The practice changed, but the result could not refresh. Reload the page to continue.",
    );
  }
  return result.data.session;
}

function phaseLabel(session: PublicPracticeSession): string {
  if (session.status === "ended") return "Ended";
  if (session.status === "completed") return "Complete";

  if (session.experienceMode === "single_prompt") {
    return session.phase === "briefing" ? "Prompt" : "Practice";
  }

  switch (session.phase) {
    case "briefing":
      return "Brief";
    case "initial_simulation":
      return "Simulation";
    case "coaching_break":
      return "Coaching";
    case "targeted_retry":
      return "Retry";
    case "finalizing":
      return "Finishing";
    case "final_takeaway":
      return "Takeaway";
  }
}

export function PracticeExperience({
  practiceSessionId,
}: {
  practiceSessionId: string;
}) {
  const router = useRouter();
  const playedAudioStorageKey = `openlytalk.practice.played-audio.${practiceSessionId}`;
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [starting, setStarting] = useState(false);
  const [situationReplacing, setSituationReplacing] = useState(false);
  const [situationReplacementError, setSituationReplacementError] =
    useState<string | null>(null);
  const [retryStarting, setRetryStarting] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(
    null,
  );
  const [captionsOn, setCaptionsOn] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [finalizationRetrying, setFinalizationRetrying] = useState(false);
  const [finalizationError, setFinalizationError] = useState<string | null>(
    null,
  );
  const [responseSubmitting, setResponseSubmitting] = useState(false);
  const [discardRecordingSignal, setDiscardRecordingSignal] =
    useState(0);
  const [playback, setPlayback] = useState<{
    messageId: string | null;
    status: PracticePlaybackStatus;
  }>({ messageId: null, status: "idle" });
  const [playedPartnerMessageIds, setPlayedPartnerMessageIds] = useState<
    ReadonlySet<string>
  >(new Set());
  const [conversationReviewOpen, setConversationReviewOpen] = useState(false);
  const [closingAudioPending, setClosingAudioPending] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioMessageIdRef = useRef<string | null>(null);
  const closingMessageIdRef = useRef<string | null>(null);
  const playedPartnerMessageIdsRef = useRef<ReadonlySet<string>>(
    new Set(),
  );
  const recoveryAttemptRef = useRef<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response = await fetch(
          `/api/practice-sessions/${encodeURIComponent(
            practiceSessionId,
          )}`,
          {
            cache: "no-store",
            signal,
          },
        );
        const body = await responseBody(response);

        if (!response.ok) {
          const error = practiceApiErrorSchema.safeParse(body);
          const message = error.success
            ? error.data.error.message
            : "We could not open this practice.";
          setState(
            response.status === 410
              ? { kind: "expired", message }
              : response.status === 404
                ? { kind: "unavailable", message }
                : { kind: "error", message },
          );
          return;
        }

        const result = practiceSessionResponseSchema.safeParse(body);
        if (!result.success) {
          setState({
            kind: "error",
            message: "We could not read this practice. Please try again.",
          });
          return;
        }
        setState({ kind: "ready", session: result.data.session });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setState({
          kind: "error",
          message: "We could not open this practice. Check your connection and try again.",
        });
      }
    },
    [practiceSessionId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => load(controller.signal));
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    const ids = readPlayedPartnerMessageIds(playedAudioStorageKey);
    playedPartnerMessageIdsRef.current = ids;
    const timeoutId = window.setTimeout(() => {
      setPlayedPartnerMessageIds(ids);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [playedAudioStorageKey]);

  useEffect(
    () => () => {
      audioRef.current?.pause();
      audioRef.current = null;
    },
    [],
  );

  const playSpeech = useCallback(
    async (
      speechUrl: string,
      messageId: string,
      singleUse = false,
    ) => {
      if (
        singleUse &&
        playedPartnerMessageIdsRef.current.has(messageId)
      ) {
        return;
      }
      audioRef.current?.pause();
      const audio = new Audio(speechUrl);
      audioRef.current = audio;
      audioMessageIdRef.current = messageId;
      setPlayback({ messageId, status: "loading" });

      audio.addEventListener("playing", () => {
        if (audioMessageIdRef.current === messageId) {
          if (singleUse) {
            const next = new Set(playedPartnerMessageIdsRef.current);
            next.add(messageId);
            playedPartnerMessageIdsRef.current = next;
            setPlayedPartnerMessageIds(next);
            try {
              window.sessionStorage.setItem(
                playedAudioStorageKey,
                JSON.stringify([...next]),
              );
            } catch {
              // Playback must not depend on tab storage.
            }
          }
          setPlayback({ messageId, status: "playing" });
        }
      });
      audio.addEventListener("waiting", () => {
        if (audioMessageIdRef.current === messageId) {
          setPlayback({ messageId, status: "loading" });
        }
      });
      audio.addEventListener("ended", () => {
        if (audioMessageIdRef.current === messageId) {
          setPlayback({ messageId, status: "idle" });
          if (closingMessageIdRef.current === messageId) {
            closingMessageIdRef.current = null;
            setClosingAudioPending(false);
            setConversationReviewOpen(false);
          }
        }
      });
      audio.addEventListener("error", () => {
        if (audioMessageIdRef.current === messageId) {
          setPlayback({ messageId, status: "error" });
        }
      });

      try {
        await audio.play();
      } catch {
        if (audioMessageIdRef.current === messageId) {
          setPlayback({ messageId, status: "error" });
        }
      }
    },
    [playedAudioStorageKey],
  );

  const session = state.kind === "ready" ? state.session : null;
  const simulationVisible =
    session?.phase === "initial_simulation" ||
    session?.phase === "targeted_retry" ||
    conversationReviewOpen;

  const resumeFinalization = useCallback(
    async (target: PublicPracticeSession) => {
      if (!target.actions.canResumeFinalization || finalizationRetrying) {
        return;
      }
      setFinalizationRetrying(true);
      setFinalizationError(null);
      try {
        const resumed = await requestPracticeEnd({
          practiceSessionId,
          expectedUpdatedAt: target.updatedAt,
        });
        setState({ kind: "ready", session: resumed });
      } catch (error) {
        setFinalizationError(
          error instanceof Error
            ? error.message
            : "We could not finish your takeaway. Please try again.",
        );
      } finally {
        setFinalizationRetrying(false);
      }
    },
    [finalizationRetrying, practiceSessionId],
  );

  useEffect(() => {
    if (
      !session?.actions.canResumeFinalization ||
      recoveryAttemptRef.current === session.updatedAt
    ) {
      return;
    }
    recoveryAttemptRef.current = session.updatedAt;
    void Promise.resolve().then(() => resumeFinalization(session));
  }, [resumeFinalization, session]);

  async function startPractice() {
    if (!session?.actions.canStart || starting || situationReplacing) return;
    setStarting(true);
    setOperationError(null);

    try {
      const response = await fetch(
        `/api/practice-sessions/${encodeURIComponent(
          practiceSessionId,
        )}/start`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expectedUpdatedAt: session.updatedAt,
          }),
        },
      );
      const body = await responseBody(response);
      if (!response.ok) {
        const error = practiceApiErrorSchema.safeParse(body);
        throw new Error(
          error.success
            ? error.data.error.message
            : session.experienceMode === "single_prompt"
              ? "We could not open your prompt. Please try again."
              : "We could not start the simulation. Please try again.",
        );
      }

      const result = startPracticeResponseSchema.safeParse(body);
      if (!result.success) {
        throw new Error(
          session.experienceMode === "single_prompt"
            ? "Your prompt is ready, but we could not open it. Please refresh."
            : "The simulation started, but we could not open it. Please refresh.",
        );
      }
      setState({ kind: "ready", session: result.data.session });
      try {
        window.sessionStorage.removeItem(PRACTICE_SITUATION_DRAFT_KEY);
      } catch {
        // Starting the simulation must not depend on tab storage.
      }

      if (result.data.autoplaySpeechUrl) {
        const openingMessage = result.data.session.messages.find(
          (message) =>
            message.speechUrl === result.data.autoplaySpeechUrl,
        );
        if (openingMessage) {
          void playSpeech(
            result.data.autoplaySpeechUrl,
            openingMessage.id,
            true,
          );
        }
      }
    } catch (error) {
      setOperationError(
        error instanceof Error
          ? error.message
          : session.experienceMode === "single_prompt"
            ? "We could not open your prompt. Please try again."
            : "We could not start the simulation. Please try again.",
      );
    } finally {
      setStarting(false);
    }
  }

  async function replaceSituation() {
    if (!session?.actions.canReplaceSituation || situationReplacing || starting) {
      return;
    }
    setSituationReplacing(true);
    setSituationReplacementError(null);

    try {
      const response = await fetch(
        `/api/practice-sessions/${encodeURIComponent(
          practiceSessionId,
        )}/replace-situation`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idempotencyKey: crypto.randomUUID(),
            expectedUpdatedAt: session.updatedAt,
          }),
        },
      );
      const body = await responseBody(response);
      if (!response.ok) {
        const error = practiceApiErrorSchema.safeParse(body);
        throw new Error(
          error.success
            ? error.data.error.message
            : "We could not find another situation. Please try again.",
        );
      }
      const result = replacePracticeSituationResponseSchema.safeParse(body);
      if (!result.success) {
        throw new Error(
          "The situation changed, but the practice could not refresh. Reload the page to continue.",
        );
      }
      setState({ kind: "ready", session: result.data.session });
    } catch (error) {
      setSituationReplacementError(
        error instanceof Error
          ? error.message
          : "We could not find another situation. Please try again.",
      );
    } finally {
      setSituationReplacing(false);
    }
  }

  async function submitRecording(
    recording: PracticePendingRecording,
  ): Promise<void> {
    if (!session?.actions.canRecord) {
      throw new Error(
        "This practice is not ready for another response.",
      );
    }

    const form = new FormData();
    const extension = recording.blob.type.includes("mp4")
      ? "mp4"
      : recording.blob.type.includes("ogg")
        ? "ogg"
        : "webm";
    form.set("audio", recording.blob, `response.${extension}`);
    form.set("idempotencyKey", recording.idempotencyKey);
    form.set(
      "expectedLearnerSequence",
      String(session.expectedLearnerSequence),
    );
    if (recording.transcript) {
      form.set("previewTranscript", recording.transcript);
    }

    let response: Response;
    try {
      response = await fetch(
        `/api/practice-sessions/${encodeURIComponent(
          practiceSessionId,
        )}/turn`,
        { method: "POST", body: form },
      );
    } catch {
      throw new Error(
        "Your recording is safe to retry. Check your connection and try again.",
      );
    }

    const body = await responseBody(response);
    if (!response.ok) {
      const error = practiceApiErrorSchema.safeParse(body);
      throw new Error(
        error.success
          ? error.data.error.message
          : "We could not send that response. Please try again.",
      );
    }

    const result = practiceTurnResponseSchema.safeParse(body);
    if (!result.success) {
      throw new Error(
        "Your response was saved, but the practice could not refresh. Reload the page to continue.",
      );
    }
    const partnerMessage = result.data.autoplaySpeechUrl
      ? [...result.data.acceptedMessages]
        .reverse()
        .find(
          (message) =>
            message.role === "partner" &&
            message.speechUrl === result.data.autoplaySpeechUrl,
        )
      : undefined;
    const holdsFeedbackForClosing =
      result.data.session.phase === "final_takeaway" &&
      partnerMessage !== undefined &&
      !playedPartnerMessageIdsRef.current.has(partnerMessage.id);
    if (holdsFeedbackForClosing) {
      closingMessageIdRef.current = partnerMessage.id;
      setClosingAudioPending(true);
      setConversationReviewOpen(true);
    }
    setState({ kind: "ready", session: result.data.session });

    if (result.data.autoplaySpeechUrl && partnerMessage) {
        void playSpeech(
          result.data.autoplaySpeechUrl,
          partnerMessage.id,
          true,
        );
    }
  }

  async function previewRecording(input: { blob: Blob }): Promise<string> {
    const form = new FormData();
    const extension = input.blob.type.includes("mp4")
      ? "mp4"
      : input.blob.type.includes("ogg")
        ? "ogg"
        : "webm";
    form.set("audio", input.blob, `response.${extension}`);
    const response = await fetch(
      `/api/practice-sessions/${encodeURIComponent(
        practiceSessionId,
      )}/transcription-preview`,
      { method: "POST", body: form },
    );
    const body = await responseBody(response);
    if (!response.ok) {
      const error = practiceApiErrorSchema.safeParse(body);
      throw new Error(
        error.success
          ? error.data.error.message
          : "We could not prepare the transcript. Please record it again.",
      );
    }
    const result = practiceTranscriptionPreviewResponseSchema.safeParse(body);
    if (!result.success) {
      throw new Error("We could not read the transcript. Please record it again.");
    }
    return result.data.transcript;
  }

  async function beginRetry() {
    if (
      !session ||
      session.phase !== "coaching_break" ||
      retryStarting
    ) {
      return;
    }
    setRetryStarting(true);
    setRetryError(null);
    try {
      const response = await fetch(
        `/api/practice-sessions/${encodeURIComponent(
          practiceSessionId,
        )}/retry`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expectedUpdatedAt: session.updatedAt,
          }),
        },
      );
      const body = await responseBody(response);
      if (!response.ok) {
        const error = practiceApiErrorSchema.safeParse(body);
        throw new Error(
          error.success
            ? error.data.error.message
            : "We could not open the retry. Please try again.",
        );
      }
      const result = retryPracticeResponseSchema.safeParse(body);
      if (!result.success) {
        throw new Error(
          "The retry started, but the practice could not refresh. Reload the page to continue.",
        );
      }
      setState({ kind: "ready", session: result.data.session });
    } catch (error) {
      setRetryError(
        error instanceof Error
          ? error.message
          : "We could not open the retry. Please try again.",
      );
    } finally {
      setRetryStarting(false);
    }
  }

  function openEndConfirmation() {
    if (!session?.actions.canEnd) return;
    setEndError(null);
    setEndOpen(true);
  }

  function closeEndConfirmation() {
    if (ending) return;
    setEndOpen(false);
    setEndError(null);
  }

  async function finishPractice() {
    if (
      !session?.actions.canEnd ||
      ending ||
      responseSubmitting
    ) {
      return;
    }

    setEnding(true);
    setEndError(null);
    setDiscardRecordingSignal((current) => current + 1);
    audioRef.current?.pause();
    audioRef.current = null;
    audioMessageIdRef.current = null;
    setPlayback({ messageId: null, status: "idle" });

    try {
      const ended = await requestPracticeEnd({
        practiceSessionId,
        expectedUpdatedAt: session.updatedAt,
      });
      setState({ kind: "ready", session: ended });
      setEndOpen(false);
    } catch (error) {
      setEndError(
        error instanceof Error
          ? error.message
          : "We could not end this practice. Please try again.",
      );
    } finally {
      setEnding(false);
    }
  }

  function openDeleteConfirmation() {
    if (!session?.actions.canDelete) return;
    setEndOpen(false);
    setDeleteError(null);
    setDeleteOpen(true);
  }

  function closeDeleteConfirmation() {
    if (deleting) return;
    setDeleteOpen(false);
    setDeleteError(null);
  }

  async function deletePractice() {
    if (!session?.actions.canDelete || deleting || responseSubmitting) {
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    setDiscardRecordingSignal((current) => current + 1);
    audioRef.current?.pause();
    audioRef.current = null;

    try {
      const response = await fetch(
        `/api/practice-sessions/${encodeURIComponent(
          practiceSessionId,
        )}`,
        { method: "DELETE" },
      );
      const body = await responseBody(response);
      if (!response.ok) {
        const error = practiceApiErrorSchema.safeParse(body);
        throw new Error(
          error.success
            ? error.data.error.message
            : "We could not delete this practice. Please try again.",
        );
      }
      if (!deletePracticeResponseSchema.safeParse(body).success) {
        throw new Error(
          "The practice was deleted, but the page could not refresh.",
        );
      }
      router.replace("/");
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : "We could not delete this practice. Please try again.",
      );
      setDeleting(false);
    }
  }

  return (
    <main className="min-h-dvh bg-white">
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 w-full max-w-5xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link
            href={
              session?.experienceMode === "single_prompt"
                ? "/"
                :
              session?.phase === "briefing" &&
              session.setup.situationMode === "learner_provided"
                ? "/"
                : session?.phase === "briefing"
                ? "/practice/new?resume=latest"
                : "/practice/new"
            }
            aria-label={
              session?.experienceMode === "single_prompt"
                ? "Back to practice choices"
                :
              session?.phase === "briefing" &&
              session.setup.situationMode === "learner_provided"
                ? "Back to your described situation"
                : session?.phase === "briefing"
                ? "Back to your latest setup step"
                : "Back to practice setup"
            }
            className="flex size-11 items-center justify-center rounded-full text-stone-700 transition hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none">
              <path
                d="m14.5 6.5-5.5 5.5 5.5 5.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <span className="text-center">
            <span className="block text-base font-semibold tracking-tight text-stone-950">
              OpenlyTalk
            </span>
            <span className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-emerald-800">
              {session ? phaseLabel(session) : "Practice"}
            </span>
          </span>
          {session?.actions.canEnd ? (
            <div className="flex items-center">
              {simulationVisible &&
              session.experienceMode === "conversation_simulation" ? (
                <button
                  type="button"
                  onClick={() => setCaptionsOn((current) => !current)}
                  aria-pressed={captionsOn}
                  aria-label={
                    captionsOn ? "Hide all captions" : "Show all captions"
                  }
                  className={`flex size-10 items-center justify-center rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${
                    captionsOn
                      ? "bg-emerald-50 text-emerald-800"
                      : "text-stone-600 hover:bg-stone-100"
                  }`}
                >
                  <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none">
                    <path
                      d="M2.5 10s2.7-4 7.5-4 7.5 4 7.5 4-2.7 4-7.5 4-7.5-4-7.5-4Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <circle cx="10" cy="10" r="2" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </button>
              ) : null}
              <button
                type="button"
                onClick={openEndConfirmation}
                className="min-h-10 rounded-full px-2 text-sm font-semibold text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
              >
                End
              </button>
            </div>
          ) : session?.actions.canDelete ? (
            <button
              type="button"
              onClick={openDeleteConfirmation}
              className="min-h-10 rounded-full px-2 text-sm font-semibold text-stone-600 transition hover:bg-stone-100 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            >
              Delete
            </button>
          ) : (
            <span className="size-11" aria-hidden="true" />
          )}
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-5 sm:px-8">
        {state.kind === "loading" ? (
          <div
            className="flex min-h-[70dvh] flex-col items-center justify-center text-center"
            role="status"
          >
            <LoadingSpinner className="size-7 border-stone-200 border-t-emerald-700" />
            <p className="mt-4 text-sm font-medium text-stone-600">
              Opening your practice…
            </p>
          </div>
        ) : null}

        {state.kind === "ready" ? (
          <div
            className={
              state.session.experienceMode === "single_prompt"
                ? "mx-auto max-w-xl"
                : "lg:grid lg:grid-cols-[minmax(0,36rem)_20rem] lg:items-start lg:gap-10"
            }
          >
            <div>
              {state.session.experienceMode === "conversation_simulation" &&
              state.session.phase !== "briefing" ? (
                <details className="mt-5 rounded-2xl border border-stone-200 bg-white p-4 lg:hidden">
                  <summary className="cursor-pointer text-sm font-semibold text-stone-900">
                    View your goal and technique
                  </summary>
                  <div className="mt-4">
                    <PracticeReferencePanel session={state.session} />
                  </div>
                </details>
              ) : null}
              <PracticePhaseView
                session={state.session}
                captionsOn={captionsOn}
                playbackMessageId={playback.messageId}
                playbackStatus={playback.status}
                playedPartnerMessageIds={playedPartnerMessageIds}
                onPlaySpeech={(speechUrl, messageId, singleUse) => {
                  void playSpeech(speechUrl, messageId, singleUse);
                }}
                retryStarting={retryStarting}
                retryError={retryError}
                onBeginRetry={() => void beginRetry()}
                finalizationRetrying={finalizationRetrying}
                finalizationError={finalizationError}
                onRetryFinalization={() => {
                  if (session) void resumeFinalization(session);
                }}
                situationReplacing={situationReplacing}
                situationReplacementError={situationReplacementError}
                onReplaceSituation={() => void replaceSituation()}
                showConversationReview={conversationReviewOpen}
                closingAudioPending={closingAudioPending}
                onViewConversation={() => setConversationReviewOpen(true)}
                onBackToFeedback={() => setConversationReviewOpen(false)}
                onContinueWithoutClosingAudio={() => {
                  closingMessageIdRef.current = null;
                  setClosingAudioPending(false);
                  setConversationReviewOpen(false);
                }}
              />
            </div>
            {state.session.experienceMode === "conversation_simulation" ? (
              <aside
                className="sticky top-24 hidden pt-7 lg:block"
                aria-label="Your practice reference"
              >
                <PracticeReferencePanel session={state.session} />
              </aside>
            ) : null}
          </div>
        ) : null}

        {state.kind === "expired" ? (
          <section className="flex min-h-[70dvh] flex-col items-center justify-center text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none">
                <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
                <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 className="mt-5 text-2xl font-semibold tracking-tight text-stone-950">
              This practice has expired.
            </h1>
            <p className="mt-3 max-w-sm text-sm leading-6 text-stone-600">
              {state.message} Start a new practice when you’re ready.
            </p>
            <Link
              href="/"
              className="mt-6 flex min-h-12 items-center justify-center rounded-full bg-emerald-700 px-6 font-semibold text-white"
            >
              Create a new practice
            </Link>
          </section>
        ) : null}

        {state.kind === "unavailable" ? (
          <section className="flex min-h-[70dvh] flex-col items-center justify-center text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-600">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none">
                <path
                  d="M12 8v4m0 4h.01M4.5 19h15L12 5 4.5 19Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h1 className="mt-5 text-2xl font-semibold tracking-tight text-stone-950">
              This practice isn’t available.
            </h1>
            <p className="mt-3 max-w-sm text-sm leading-6 text-stone-600">
              {state.message}
            </p>
            <Link
              href="/"
              className="mt-6 flex min-h-12 items-center justify-center rounded-full bg-emerald-700 px-6 font-semibold text-white"
            >
              Create a new practice
            </Link>
          </section>
        ) : null}

        {state.kind === "error" ? (
          <section className="flex min-h-[70dvh] flex-col items-center justify-center text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-stone-950">
              We couldn’t open your practice.
            </h1>
            <p className="mt-3 max-w-sm text-sm leading-6 text-stone-600">
              {state.message}
            </p>
            <button
              type="button"
              onClick={() => {
                setState({ kind: "loading" });
                void load();
              }}
              className="mt-6 min-h-12 rounded-full bg-emerald-700 px-6 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            >
              Try again
            </button>
          </section>
        ) : null}
      </div>

      {session?.actions.canStart ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 backdrop-blur">
          <div className="mx-auto w-full max-w-xl px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-8">
            {operationError ? (
              <p
                className="mb-2 text-center text-xs leading-5 text-red-700"
                role="alert"
              >
                {operationError}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => void startPractice()}
              disabled={
                starting ||
                situationReplacing ||
                (session.experienceMode === "single_prompt" &&
                  (playback.status === "loading" ||
                    playback.status === "playing"))
              }
              className="flex min-h-13 w-full items-center justify-center rounded-full bg-emerald-700 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:bg-stone-300 disabled:text-stone-600"
            >
              {starting ? (
                <span className="flex items-center gap-2">
                  <LoadingSpinner />
                  {session.experienceMode === "single_prompt"
                    ? "Getting ready…"
                    : "Starting simulation…"}
                </span>
              ) : session.experienceMode === "single_prompt" ? (
                "Respond aloud"
              ) : session.brief.opening.speaker === "partner" ? (
                "Start and play partner"
              ) : (
                "Start speaking"
              )}
            </button>
          </div>
        </div>
      ) : null}

      {session?.actions.canRecord ? (
        <PracticeRecorder
          key={`practice-recorder-${discardRecordingSignal}`}
          disabled={ending}
          onPreview={
            session.experienceMode === "single_prompt"
              ? previewRecording
              : undefined
          }
          onSubmittingChange={setResponseSubmitting}
          onSubmit={submitRecording}
        />
      ) : null}

      {endOpen && session ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-stone-950/35 sm:items-center sm:justify-center"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeEndConfirmation();
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="end-practice-title"
            className="w-full rounded-t-3xl bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-6 shadow-2xl sm:max-w-md sm:rounded-3xl sm:p-6"
          >
            <div className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-stone-300 sm:hidden" />
            <h2
              id="end-practice-title"
              className="text-xl font-semibold tracking-tight text-stone-950"
            >
              End this practice?
            </h2>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              {session.acceptedResponseCount >= 2
                ? "Your coach will prepare a partial takeaway using only what you have practiced so far."
                : "There is not enough practice yet for grounded feedback, so this session will end without a takeaway."}
            </p>
            <p className="mt-2 text-xs leading-5 text-stone-500">
              Any recording you have not sent will be discarded.
            </p>
            {responseSubmitting ? (
              <p className="mt-3 text-sm leading-5 text-amber-700">
                Your current response is still being sent. You can end the
                practice as soon as it finishes.
              </p>
            ) : null}
            {endError ? (
              <p
                className="mt-3 text-sm leading-5 text-red-700"
                role="alert"
              >
                {endError}
              </p>
            ) : null}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={closeEndConfirmation}
                disabled={ending}
                className="min-h-12 rounded-full border border-stone-300 px-4 font-semibold text-stone-700 disabled:opacity-50"
              >
                Keep practicing
              </button>
              <button
                type="button"
                onClick={() => void finishPractice()}
                disabled={ending || responseSubmitting}
                className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-stone-900 px-4 font-semibold text-white disabled:bg-stone-300 disabled:text-stone-600"
              >
                {ending ? (
                  <>
                    <LoadingSpinner />
                    Ending…
                  </>
                ) : (
                  "End practice"
                )}
              </button>
            </div>
            <button
              type="button"
              onClick={openDeleteConfirmation}
              disabled={ending || responseSubmitting}
              className="mt-3 min-h-10 w-full rounded-full text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:text-stone-400"
            >
              Delete practice and transcript
            </button>
          </section>
        </div>
      ) : null}

      {deleteOpen && session ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-stone-950/35 sm:items-center sm:justify-center"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeDeleteConfirmation();
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-practice-title"
            className="w-full rounded-t-3xl bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-6 shadow-2xl sm:max-w-md sm:rounded-3xl sm:p-6"
          >
            <div className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-stone-300 sm:hidden" />
            <h2
              id="delete-practice-title"
              className="text-xl font-semibold tracking-tight text-stone-950"
            >
              Delete this practice?
            </h2>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              This permanently removes the setup, transcript, coaching, and
              takeaway. It cannot be undone.
            </p>
            {responseSubmitting ? (
              <p className="mt-3 text-sm leading-5 text-amber-700">
                Your current response is still being sent. You can delete the
                practice as soon as it finishes.
              </p>
            ) : null}
            {deleteError ? (
              <p className="mt-3 text-sm leading-5 text-red-700" role="alert">
                {deleteError}
              </p>
            ) : null}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={closeDeleteConfirmation}
                disabled={deleting}
                className="min-h-12 rounded-full border border-stone-300 px-4 font-semibold text-stone-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void deletePractice()}
                disabled={deleting || responseSubmitting}
                className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-red-700 px-4 font-semibold text-white disabled:bg-stone-300 disabled:text-stone-600"
              >
                {deleting ? (
                  <>
                    <LoadingSpinner />
                    Deleting…
                  </>
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
