"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { prepareBrowserRecording } from "@/lib/audio/browser-recording";
import { MAX_AUDIO_BYTES } from "@/lib/audio/recording";
import {
  conversationContextLabel,
  conversationTypeLabel,
  V1_RULES,
} from "@/lib/product-rules";
import { apiErrorSchema } from "@/lib/validation/api-error";
import type { ConversationView } from "@/lib/validation/conversation-view";
import { endConversationResponseSchema } from "@/lib/validation/end-conversation";
import { turnResponseSchema } from "@/lib/validation/turn";

const RECORDING_TYPES = [
  "audio/webm;codecs=opus",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/webm",
];

type PendingRecording = {
  blob: Blob;
  previewUrl: string;
  durationMs: number;
  idempotencyKey: string;
};

function recorderMimeType(): string | undefined {
  return RECORDING_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

function formatSeconds(milliseconds: number): string {
  return `${Math.max(1, Math.round(milliseconds / 1_000))}s`;
}

function CaptionVisibilityIcon({ visible }: { visible: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.75" />
      {visible ? (
        <path
          d="M4 4l16 16"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
    </svg>
  );
}

function SpeakingIndicator() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-4 items-center gap-0.5 text-emerald-700"
    >
      <span className="sofia-speaking-bar h-2 w-0.5 rounded-full bg-current" />
      <span className="sofia-speaking-bar h-3.5 w-0.5 rounded-full bg-current" />
      <span className="sofia-speaking-bar h-2.5 w-0.5 rounded-full bg-current" />
      <span className="sofia-speaking-bar h-4 w-0.5 rounded-full bg-current" />
    </span>
  );
}

export function ConversationExperience({ initial }: { initial: ConversationView }) {
  const [messages, setMessages] = useState(initial.messages);
  const [acceptedCount, setAcceptedCount] = useState(
    initial.episode.acceptedResponseCount,
  );
  const [expectedSequence, setExpectedSequence] = useState(
    initial.episode.expectedSequence,
  );
  const [episodeStatus, setEpisodeStatus] = useState(initial.episode.status);
  const [captionsOn, setCaptionsOn] = useState(false);
  const [captionVisibilityOverrides, setCaptionVisibilityOverrides] = useState<
    Record<string, boolean>
  >({});
  const [recording, setRecording] = useState(false);
  const [recordingMs, setRecordingMs] = useState(0);
  const [pending, setPending] = useState<PendingRecording | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [speechState, setSpeechState] = useState<
    "loading" | "ready" | "playing" | "failed"
  >("ready");
  const firstSofia = initial.messages.find((message) => message.role === "sofia");
  const openingMessageId = firstSofia?.messageId ?? "";
  const [speechUrl, setSpeechUrl] = useState(
    firstSofia
      ? `/api/conversations/${initial.conversationId}/messages/${firstSofia.messageId}/speech`
      : "",
  );
  const [speechMessageId, setSpeechMessageId] = useState(openingMessageId);
  const [playedSpeechMessageId, setPlayedSpeechMessageId] = useState<
    string | null
  >(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartedRef = useRef(0);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const autoPlayAttemptedMessageIdRef = useRef<string | null>(null);
  const latestSofia = [...messages].reverse().find((message) => message.role === "sofia");
  const active = episodeStatus === "active";

  function toggleAllCaptions() {
    setCaptionsOn((visible) => !visible);
    setCaptionVisibilityOverrides({});
  }

  function toggleMessageCaption(messageId: string, currentlyVisible: boolean) {
    setCaptionVisibilityOverrides((current) => ({
      ...current,
      [messageId]: !currentlyVisible,
    }));
  }

  const clearRecordingTimers = useCallback(() => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    recordingTimerRef.current = null;
    maxTimerRef.current = null;
  }, []);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const clearPending = useCallback(() => {
    setPending((current) => {
      if (current) URL.revokeObjectURL(current.previewUrl);
      return null;
    });
  }, []);

  useEffect(() => {
    return () => {
      clearRecordingTimers();
      stopTracks();
    };
  }, [clearRecordingTimers, stopTracks]);

  async function playSofia() {
    setNotice(null);
    if (audioRef.current && speechUrl) {
      try {
        if (speechState === "failed") audioRef.current.load();
        await audioRef.current.play();
      } catch {
        setSpeechState("failed");
      }
      return;
    }
    if (latestSofia) {
      const nextUrl = `/api/conversations/${initial.conversationId}/messages/${latestSofia.messageId}/speech`;
      setSpeechUrl(nextUrl);
      setSpeechMessageId(latestSofia.messageId);
    }
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!active || !audio || !speechUrl || !speechMessageId) return;
    if (speechMessageId === openingMessageId) return;
    if (autoPlayAttemptedMessageIdRef.current === speechMessageId) return;

    autoPlayAttemptedMessageIdRef.current = speechMessageId;
    audio.src = speechUrl;
    audio.load();
    void audio.play().catch(() => {
      setSpeechState("failed");
      setNotice("Sofia's response is ready. Tap Play Sofia to hear it.");
    });
  }, [active, openingMessageId, speechMessageId, speechUrl]);

  function discardCurrentResponse() {
    const recorder = mediaRecorderRef.current;
    if (recorder?.state === "recording") {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.stop();
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    clearRecordingTimers();
    stopTracks();
    setRecording(false);
    setRecordingMs(0);
    clearPending();
  }

  async function confirmEndConversation() {
    if (ending || submitting) return;
    setEnding(true);
    setNotice(null);
    discardCurrentResponse();
    audioRef.current?.pause();
    setSpeechState("ready");

    try {
      const response = await fetch(
        `/api/conversations/${initial.conversationId}/end`,
        { method: "POST" },
      );
      const body: unknown = await response.json();
      if (!response.ok) {
        const parsedError = apiErrorSchema.safeParse(body);
        setNotice(
          parsedError.success
            ? parsedError.data.message
            : "We could not end the conversation. Please try again.",
        );
        return;
      }

      const result = endConversationResponseSchema.parse(body);
      setAcceptedCount(result.episode.acceptedResponseCount);
      setEpisodeStatus(result.episode.status);
      setConfirmingEnd(false);
    } catch {
      setNotice("We could not end the conversation. Please try again.");
    } finally {
      setEnding(false);
    }
  }

  async function startRecording() {
    setNotice(null);
    clearPending();
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setNotice("Audio recording is not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      const mimeType = recorderMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      streamRef.current = stream;
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recordingStartedRef.current = Date.now();
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        const durationMs = Date.now() - recordingStartedRef.current;
        const capturedBlob = new Blob(chunksRef.current, {
          type: recorder.mimeType || mimeType || "audio/webm",
        });
        stopTracks();
        clearRecordingTimers();
        setRecording(false);
        setRecordingMs(durationMs);
        if (capturedBlob.size === 0 || capturedBlob.size > MAX_AUDIO_BYTES) {
          setNotice(
            capturedBlob.size === 0
              ? "We did not capture any audio. Please try again."
              : "That recording is too large. Please make it shorter.",
          );
          return;
        }
        const blob = await prepareBrowserRecording(capturedBlob, durationMs);
        setPending({
          blob,
          previewUrl: URL.createObjectURL(blob),
          durationMs,
          idempotencyKey: crypto.randomUUID(),
        });
      };
      recorder.start(250);
      setRecording(true);
      setRecordingMs(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingMs(Date.now() - recordingStartedRef.current);
      }, 250);
      maxTimerRef.current = setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, V1_RULES.maxRecordingSeconds * 1_000);
    } catch {
      stopTracks();
      setNotice(
        "Microphone access is needed for push-to-talk. Allow it in your browser and try again.",
      );
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }

  async function submitRecording() {
    if (!pending || submitting) return;
    setSubmitting(true);
    setNotice(null);
    const form = new FormData();
    form.set("audio", pending.blob, `response.${pending.blob.type.includes("mp4") ? "mp4" : "webm"}`);
    form.set("idempotencyKey", pending.idempotencyKey);
    form.set("expectedSequence", String(expectedSequence));

    try {
      const response = await fetch(
        `/api/conversations/${initial.conversationId}/turn`,
        { method: "POST", body: form },
      );
      const body: unknown = await response.json();
      if (!response.ok) {
        const parsedError = apiErrorSchema.safeParse(body);
        const error = parsedError.success ? parsedError.data : null;
        if (
          error &&
          ["INVALID_AUDIO", "UNCLEAR_AUDIO", "NON_ENGLISH_RETRY"].includes(error.code)
        ) {
          clearPending();
        }
        setNotice(error?.message ?? "We could not send that response. Please try again.");
        return;
      }
      const result = turnResponseSchema.parse(body);
      setMessages((current) => [
        ...current,
        { ...result.learner, role: "learner" as const },
        { ...result.sofia, role: "sofia" as const },
      ]);
      setAcceptedCount(result.episode.acceptedResponseCount);
      setExpectedSequence(result.episode.expectedSequence);
      setEpisodeStatus(result.episode.status);
      clearPending();
      setSpeechUrl(result.speechUrl);
      setSpeechMessageId(result.sofia.messageId);
      setPlayedSpeechMessageId(null);
    } catch {
      setNotice("The response is still safe to retry. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-5 py-6 sm:px-10 sm:py-10">
      <header className="flex items-center justify-between gap-4 border-b border-stone-200 pb-5">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-stone-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700"
        >
          OpenlyTalk
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-stone-600" aria-live="polite">
            {acceptedCount} of {initial.episode.maxAcceptedResponses} responses
          </span>
          {active ? (
            <button
              type="button"
              onClick={() => setConfirmingEnd(true)}
              disabled={ending || submitting}
              className="min-h-9 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:border-rose-300 hover:text-rose-700 disabled:cursor-wait disabled:text-stone-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700"
            >
              End conversation
            </button>
          ) : null}
        </div>
      </header>

      <section className="mx-auto max-w-2xl py-10 sm:py-14">
        <div className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
          <span className="rounded-full border border-stone-200 bg-white px-3 py-1.5">
            {conversationTypeLabel(initial.conversationType)}
          </span>
          <span className="rounded-full border border-stone-200 bg-white px-3 py-1.5">
            {conversationContextLabel(initial.context)}
          </span>
          <button
            type="button"
            aria-pressed={captionsOn}
            onClick={toggleAllCaptions}
            className="ml-auto min-h-9 rounded-full border border-stone-300 bg-white px-3 py-1.5 font-medium text-stone-700 hover:border-stone-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          >
            Captions {captionsOn ? "on" : "off"}
          </button>
        </div>

        {acceptedCount === 0 && initial.starter ? (
          <div className="mt-7 rounded-3xl border border-emerald-200 bg-emerald-50/60 p-6 sm:p-7">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-emerald-800">
              Start with something small
            </p>
            <p className="mt-3 text-xl font-medium leading-8 text-stone-950">
              {initial.starter.prompt}
            </p>
            <div className="mt-5 flex flex-wrap gap-2" aria-label="Optional ideas">
              {initial.starter.ideas.map((idea) => (
                <span
                  key={idea}
                  className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-sm text-stone-700"
                >
                  {idea}
                </span>
              ))}
            </div>
          </div>
        ) : initial.scene ? (
          <p className="mt-7 text-lg leading-8 text-stone-600">{initial.scene}</p>
        ) : null}

        <audio
          ref={audioRef}
          src={speechUrl || undefined}
          preload="none"
          onWaiting={() => setSpeechState("loading")}
          onCanPlay={() => setSpeechState("ready")}
          onPlay={() => {
            setSpeechState("playing");
            setPlayedSpeechMessageId(speechMessageId);
          }}
          onPause={() => setSpeechState("ready")}
          onEnded={() => setSpeechState("ready")}
          onError={() => setSpeechState("failed")}
        />
        {latestSofia ? (
          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={() => void playSofia()}
              disabled={speechState === "loading"}
              className="min-h-11 rounded-full border border-stone-300 bg-white px-4 py-2 font-semibold text-stone-800 hover:border-stone-400 disabled:cursor-wait disabled:text-stone-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            >
              {speechState === "loading" ? (
                <span className="flex items-center gap-2">
                  <LoadingSpinner />
                  Preparing Sofia…
                </span>
              ) : speechState === "playing" ? (
                <span className="flex items-center gap-2">
                  <SpeakingIndicator />
                  Sofia is speaking
                </span>
              ) : speechState === "failed" ? (
                "Play Sofia"
              ) : playedSpeechMessageId === speechMessageId ? (
                "Replay Sofia"
              ) : (
                "Play Sofia"
              )}
            </button>
            <span className="text-xs text-stone-500">AI-generated voice</span>
          </div>
        ) : null}

        <div className="mt-8 space-y-5" aria-live="polite">
          {messages.map((message) => {
            const captionVisible =
              captionVisibilityOverrides[message.messageId] ?? captionsOn;
            const captionAction = captionVisible
              ? "Hide this caption"
              : "Show this caption";

            return (
              <div
                key={message.messageId}
                className={`flex items-start gap-3 ${message.role === "learner" ? "justify-end" : ""}`}
              >
                {message.role === "sofia" && (
                  <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-semibold text-emerald-800">
                    S
                  </span>
                )}
                <div className={`max-w-[85%] rounded-3xl px-5 py-4 shadow-sm ring-1 ${message.role === "sofia" ? "rounded-tl-md bg-white ring-stone-200" : "rounded-tr-md bg-emerald-800 text-white ring-emerald-800"}`}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-medium ${message.role === "sofia" ? "text-emerald-800" : "text-emerald-100"}`}>
                        {message.role === "sofia" ? "Sofia" : "You"}
                      </p>
                      {message.role === "sofia" &&
                      speechState === "playing" &&
                      speechMessageId === message.messageId ? (
                        <SpeakingIndicator />
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        toggleMessageCaption(
                          message.messageId,
                          captionVisible,
                        )
                      }
                      aria-label={captionAction}
                      aria-pressed={captionVisible}
                      title={captionAction}
                      className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ${
                        message.role === "sofia"
                          ? "text-stone-500 hover:bg-stone-100 hover:text-stone-700"
                          : "text-emerald-100 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <CaptionVisibilityIcon visible={captionVisible} />
                    </button>
                  </div>
                  {captionVisible ? (
                    <p className="mt-1 text-base leading-7">{message.text}</p>
                  ) : (
                    <p
                      className={`mt-1 text-sm ${
                        message.role === "sofia"
                          ? "text-stone-500"
                          : "text-emerald-100"
                      }`}
                    >
                      Caption hidden
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {active && confirmingEnd ? (
          <div
            role="dialog"
            aria-labelledby="end-conversation-title"
            className="mt-10 rounded-3xl border border-rose-200 bg-rose-50 p-6 text-center"
          >
            <p
              id="end-conversation-title"
              className="font-semibold text-rose-950"
            >
              End this conversation?
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-rose-900">
              Any response you have not sent will be discarded. Your existing
              conversation will remain available until it expires.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => setConfirmingEnd(false)}
                disabled={ending}
                className="min-h-11 rounded-full border border-stone-300 bg-white px-5 py-2 font-semibold text-stone-700 hover:border-stone-400 disabled:opacity-50"
              >
                Keep talking
              </button>
              <button
                type="button"
                onClick={() => void confirmEndConversation()}
                disabled={ending}
                className="min-h-11 rounded-full bg-rose-700 px-5 py-2 font-semibold text-white hover:bg-rose-800 disabled:cursor-wait disabled:bg-rose-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rose-700"
              >
                {ending ? "Ending…" : "End conversation"}
              </button>
            </div>
          </div>
        ) : null}

        {active ? (
          <div className="mt-10 rounded-3xl border border-stone-200 bg-white p-6 text-center shadow-sm">
            <p className="font-semibold text-stone-950">
              {acceptedCount === 0 ? "Your turn first" : "Push to talk"}
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-600">
              {acceptedCount === 0
                ? `Say as much or as little as you want in English. You have up to ${V1_RULES.maxRecordingSeconds} seconds.`
                : `Record one English response, listen back, then send it. Maximum ${V1_RULES.maxRecordingSeconds} seconds.`}
            </p>

            {recording ? (
              <div className="mt-6">
                <p className="font-medium text-rose-700" aria-live="polite">
                  Recording · {formatSeconds(recordingMs)}
                </p>
                <button
                  type="button"
                  onClick={stopRecording}
                  className="mt-4 min-h-14 rounded-full bg-rose-700 px-7 py-3 font-semibold text-white hover:bg-rose-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rose-700"
                >
                  Stop recording
                </button>
              </div>
            ) : pending ? (
              <div className="mt-6">
                <p className="text-sm font-medium text-stone-700">
                  Review your response · {formatSeconds(pending.durationMs)}
                </p>
                <audio className="mx-auto mt-3 w-full max-w-sm" controls src={pending.previewUrl} />
                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={clearPending}
                    disabled={submitting}
                    className="min-h-12 rounded-full border border-stone-300 px-5 py-2 font-semibold text-stone-700 hover:border-stone-400 disabled:opacity-50"
                  >
                    Record again
                  </button>
                  <button
                    type="button"
                    onClick={() => void submitRecording()}
                    disabled={submitting}
                    className="min-h-12 rounded-full bg-emerald-800 px-6 py-2 font-semibold text-white hover:bg-emerald-900 disabled:cursor-wait disabled:bg-stone-400 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700"
                  >
                    {submitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <LoadingSpinner />
                        Sofia is thinking…
                      </span>
                    ) : (
                      "Send response"
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void startRecording()}
                className="mt-6 min-h-14 rounded-full bg-emerald-800 px-7 py-3 font-semibold text-white hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700"
              >
                {acceptedCount === 0 ? "Start speaking" : "Start recording"}
              </button>
            )}
          </div>
        ) : (
          <div className="mt-10 rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-center">
            <p className="font-semibold text-emerald-950">This conversation has ended.</p>
            <p className="mt-2 text-sm leading-6 text-emerald-900">
              Your transcript will remain available until this conversation
              expires. You can start another conversation whenever you are ready.
            </p>
            <Link href="/" className="mt-4 inline-flex min-h-11 items-center rounded-full bg-emerald-800 px-5 py-2 font-semibold text-white">
              Start another conversation
            </Link>
          </div>
        )}

        {notice && (
          <p role="alert" className="mt-5 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900 ring-1 ring-amber-200">
            {notice}
          </p>
        )}
      </section>
    </main>
  );
}
