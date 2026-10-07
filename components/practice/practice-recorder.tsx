"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { prepareBrowserRecording } from "@/lib/audio/browser-recording";
import { MAX_AUDIO_BYTES, RECORDING_AUDIO_BITS_PER_SECOND } from "@/lib/audio/limits";
import { COACHING_BETA_RULES } from "@/lib/coaching/product-rules";

const RECORDING_TYPES = [
  "audio/webm;codecs=opus",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/webm",
];

export interface PracticePendingRecording {
  blob: Blob;
  idempotencyKey: string;
  transcript?: string;
}

type PendingRecording = PracticePendingRecording & {
  previewUrl: string;
  durationMs: number;
};

function recorderMimeType(): string | undefined {
  return RECORDING_TYPES.find((type) =>
    MediaRecorder.isTypeSupported(type),
  );
}

function formatDuration(milliseconds: number): string {
  const seconds = Math.max(1, Math.round(milliseconds / 1_000));
  return `${seconds} second${seconds === 1 ? "" : "s"}`;
}

export function PracticeRecorder({
  disabled = false,
  onPreview,
  onSubmittingChange,
  onSubmit,
}: {
  disabled?: boolean;
  onPreview?: (recording: { blob: Blob }) => Promise<string>;
  onSubmittingChange?: (submitting: boolean) => void;
  onSubmit: (recording: PracticePendingRecording) => Promise<void>;
}) {
  const [recording, setRecording] = useState(false);
  const [recordingMs, setRecordingMs] = useState(0);
  const [pending, setPending] = useState<PendingRecording | null>(null);
  const [preparingTranscript, setPreparingTranscript] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [reachedLimit, setReachedLimit] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const stoppedAtRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const clearTimers = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    intervalRef.current = null;
    timeoutRef.current = null;
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

  useEffect(
    () => () => {
      clearTimers();
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        recorder.stop();
      }
      stopTracks();
      setPending((current) => {
        if (current) URL.revokeObjectURL(current.previewUrl);
        return null;
      });
    },
    [clearTimers, stopTracks],
  );

  async function preparePreview(captured: PendingRecording) {
    setPreparingTranscript(true);
    setNotice(null);
    try {
      const blob = await prepareBrowserRecording(captured.blob, captured.durationMs);
      if (blob.size > MAX_AUDIO_BYTES) throw new Error("This recording is too large. Please record it again.");
      const prepared = { ...captured, blob, previewUrl: URL.createObjectURL(blob) };
      URL.revokeObjectURL(captured.previewUrl);
      setPending(prepared);
      const transcript = onPreview ? await onPreview({ blob }) : undefined;
      setPending({ ...prepared, transcript });
    } catch (error) {
      setNotice(`Your audio is still available in this tab. ${error instanceof Error ? error.message : "We could not prepare your transcript. Please try again."}`);
    } finally {
      setPreparingTranscript(false);
    }
  }

  async function startRecording() {
    if (disabled || submitting || preparingTranscript) return;
    setNotice(null);
    setReachedLimit(false);
    clearPending();
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setNotice("Audio recording is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      const mimeType = recorderMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType, audioBitsPerSecond: RECORDING_AUDIO_BITS_PER_SECOND })
        : new MediaRecorder(stream, { audioBitsPerSecond: RECORDING_AUDIO_BITS_PER_SECOND });
      recorderRef.current = recorder;
      streamRef.current = stream;
      chunksRef.current = [];
      startedAtRef.current = Date.now();
      stoppedAtRef.current = 0;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        const durationMs = (stoppedAtRef.current || Date.now()) - startedAtRef.current;
        const captured = new Blob(chunksRef.current, {
          type: recorder.mimeType || mimeType || "audio/webm",
        });
        recorderRef.current = null;
        clearTimers();
        stopTracks();
        setRecording(false);
        setRecordingMs(durationMs);

        if (captured.size === 0 || captured.size > MAX_AUDIO_BYTES) {
          setNotice(
            captured.size === 0
              ? "We did not capture any audio. Please try again."
              : "That recording is too large. Please make it shorter.",
          );
          return;
        }
        const saved = {
          blob: captured,
          previewUrl: URL.createObjectURL(captured),
          durationMs,
          idempotencyKey: crypto.randomUUID(),
        };
        setPending(saved);
        await preparePreview(saved);
      };

      recorder.start(250);
      setRecording(true);
      setRecordingMs(0);
      intervalRef.current = setInterval(() => {
        setRecordingMs(Date.now() - startedAtRef.current);
      }, 250);
      timeoutRef.current = setTimeout(() => {
        if (recorder.state === "recording") {
          setReachedLimit(true);
          stopRecording();
        }
      }, COACHING_BETA_RULES.maxRecordingSeconds * 1_000);
    } catch {
      stopTracks();
      setNotice(
        "Microphone access is needed to speak. Allow it in your browser and try again.",
      );
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") {
      stoppedAtRef.current = Date.now();
      recorderRef.current.stop();
    }
  }

  async function sendRecording() {
    if (!pending || submitting || preparingTranscript || (onPreview && !pending.transcript)) return;
    setSubmitting(true);
    onSubmittingChange?.(true);
    setNotice(null);
    try {
      await onSubmit({
        blob: pending.blob,
        idempotencyKey: pending.idempotencyKey,
        transcript: pending.transcript,
      });
      clearPending();
      setRecordingMs(0);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Your recording is safe to retry. Please try again.",
      );
    } finally {
      setSubmitting(false);
      onSubmittingChange?.(false);
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 backdrop-blur">
      <div className="mx-auto w-full max-w-xl px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-8">
        <span className="sr-only" aria-live="polite">
          {recording
            ? "Recording in progress."
            : preparingTranscript
              ? "Preparing your transcript."
            : submitting
              ? "Sending your response."
              : pending
                ? "Recording ready to review."
                : ""}
        </span>
        {notice ? (
          <p
            className="mb-2 text-center text-xs leading-5 text-red-700"
            role="alert"
          >
            {notice}
          </p>
        ) : null}

        {reachedLimit && (pending || preparingTranscript) ? (
          <p role="status" className="mb-2 text-center text-xs leading-5 text-stone-600">
            You reached {COACHING_BETA_RULES.maxRecordingSeconds} seconds. Recording stopped automatically. Your audio is here to review.
          </p>
        ) : null}
        {preparingTranscript ? (
          <div className="flex min-h-20 items-center justify-center gap-3 rounded-3xl border border-stone-200 bg-white p-4 text-sm font-medium text-stone-600 shadow-lg shadow-stone-900/5">
            <LoadingSpinner className="border-stone-200 border-t-emerald-700" />
            Preparing your transcript…
          </div>
        ) : pending ? (
          <div className="rounded-3xl border border-stone-200 bg-white p-3 shadow-lg shadow-stone-900/5">
            <div className="flex items-center gap-3">
              <audio
                controls
                preload="metadata"
                src={pending.previewUrl}
                className="h-10 min-w-0 flex-1"
                aria-label="Review your recording"
              />
              <span className="shrink-0 text-xs font-medium text-stone-500">
                {formatDuration(pending.durationMs)}
              </span>
            </div>
            {pending.transcript ? (
              <div className="mt-3 rounded-2xl bg-stone-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-stone-500">
                  What your coach heard
                </p>
                <p className="mt-1 text-sm leading-6 text-stone-800">
                  {pending.transcript}
                </p>
              </div>
            ) : null}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { clearPending(); setNotice(null); setReachedLimit(false); }}
                disabled={submitting}
                className="min-h-11 rounded-full border border-stone-300 px-4 text-sm font-semibold text-stone-700 disabled:opacity-50"
              >
                Re-record
              </button>
              <button
                type="button"
                onClick={() => void (onPreview && !pending.transcript ? preparePreview(pending) : sendRecording())}
                disabled={submitting}
                className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white disabled:bg-stone-300 disabled:text-stone-600"
              >
                {submitting ? (
                  <>
                    <LoadingSpinner />
                    Sending…
                  </>
                ) : (
                  onPreview && !pending.transcript ? "Retry transcript" : "Send response"
                )}
              </button>
            </div>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={
                recording
                  ? stopRecording
                  : () => void startRecording()
              }
              disabled={disabled || submitting}
              aria-pressed={recording}
              className={`flex min-h-14 w-full items-center justify-center gap-3 rounded-full px-6 font-semibold text-white shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 ${
                recording
                  ? "bg-rose-600 hover:bg-rose-700 focus-visible:outline-rose-600"
                  : "bg-emerald-700 hover:bg-emerald-800 focus-visible:outline-emerald-700"
              } disabled:bg-stone-300 disabled:text-stone-600`}
            >
              <span
                aria-hidden="true"
                className={`flex size-8 items-center justify-center rounded-full ${
                  recording ? "bg-white/20" : "bg-white/15"
                }`}
              >
                {recording ? (
                  <span className="size-3 rounded-sm bg-white" />
                ) : (
                  <svg
                    viewBox="0 0 20 20"
                    className="size-5"
                    fill="none"
                  >
                    <rect
                      x="7"
                      y="2.5"
                      width="6"
                      height="10"
                      rx="3"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    />
                    <path
                      d="M4.8 9.5a5.2 5.2 0 0 0 10.4 0M10 14.7v2.8M7.5 17.5h5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
              </span>
              {recording
                ? `Stop recording · ${formatDuration(recordingMs)}`
                : "Tap to speak"}
            </button>
          </>
        )}
        {!pending && !preparingTranscript ? (
          <p className="mt-2 text-center text-[11px] leading-4 text-stone-500">
            Record up to {COACHING_BETA_RULES.maxRecordingSeconds} seconds.
            You can review it before sending.
          </p>
        ) : null}
      </div>
    </div>
  );
}
