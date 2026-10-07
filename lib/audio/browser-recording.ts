import fixWebmDuration from "fix-webm-duration";

type WebmDurationFixer = (
  blob: Blob,
  durationMs: number,
  options: { logger: false },
) => Promise<Blob>;

function baseMimeType(mimeType: string): string {
  return mimeType.toLowerCase().split(";", 1)[0].trim();
}

/**
 * Chromium MediaRecorder WebM files commonly omit container duration metadata.
 * Add the duration measured by the recorder so server-side validation and the
 * transcription provider can read the otherwise valid recording consistently.
 */
export async function prepareBrowserRecording(
  blob: Blob,
  durationMs: number,
  fixDuration: WebmDurationFixer = fixWebmDuration,
): Promise<Blob> {
  if (baseMimeType(blob.type) !== "audio/webm") return blob;

  return fixDuration(blob, durationMs, { logger: false });
}
