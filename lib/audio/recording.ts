import { parseBuffer } from "music-metadata";

import { COACHING_BETA_RULES } from "@/lib/coaching/product-rules";

import { MAX_AUDIO_BYTES } from "@/lib/audio/limits";
export { MAX_AUDIO_BYTES } from "@/lib/audio/limits";
// Allow a small browser timer/encoder delay when automatic stop reaches the limit.
export const RECORDING_STOP_TOLERANCE_SECONDS = 1;
export const MIN_RECORDING_SECONDS = 0.25;

const AUDIO_TYPES = {
  "audio/flac": "flac",
  "audio/m4a": "m4a",
  "audio/mp3": "mp3",
  "audio/mp4": "mp4",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/webm": "webm",
  "audio/x-m4a": "m4a",
  "audio/x-wav": "wav",
} as const;

export type AudioValidationCode =
  | "empty"
  | "too_large"
  | "unsupported"
  | "unreadable"
  | "too_short"
  | "too_long";

export class AudioValidationError extends Error {
  constructor(readonly code: AudioValidationCode) {
    super(`Recording validation failed: ${code}`);
    this.name = "AudioValidationError";
  }
}

function baseMimeType(mimeType: string): string {
  return mimeType.toLowerCase().split(";", 1)[0].trim();
}

export function recordingExtension(mimeType: string): string {
  const extension = AUDIO_TYPES[baseMimeType(mimeType) as keyof typeof AUDIO_TYPES];
  if (!extension) throw new AudioValidationError("unsupported");
  return extension;
}

export async function validateRecording(input: {
  audio: Uint8Array;
  mimeType: string;
}): Promise<{ durationSeconds: number; filename: string }> {
  if (input.audio.byteLength === 0) throw new AudioValidationError("empty");
  if (input.audio.byteLength > MAX_AUDIO_BYTES) {
    throw new AudioValidationError("too_large");
  }

  const extension = recordingExtension(input.mimeType);
  let duration: number | undefined;
  try {
    const metadata = await parseBuffer(input.audio, baseMimeType(input.mimeType), {
      duration: true,
      skipCovers: true,
    });
    duration = metadata.format.duration;
  } catch {
    throw new AudioValidationError("unreadable");
  }

  if (!duration || !Number.isFinite(duration)) {
    throw new AudioValidationError("unreadable");
  }
  if (duration < MIN_RECORDING_SECONDS) {
    throw new AudioValidationError("too_short");
  }
  if (duration > COACHING_BETA_RULES.maxRecordingSeconds + RECORDING_STOP_TOLERANCE_SECONDS) {
    throw new AudioValidationError("too_long");
  }

  return { durationSeconds: duration, filename: `response.${extension}` };
}
