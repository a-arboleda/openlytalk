import { MAX_AUDIO_REQUEST_BYTES } from "@/lib/audio/limits";

export class AudioRequestTooLarge extends Error {}

/** Bound actual bytes even when Content-Length is missing or dishonest. */
export async function readAudioForm(request: Request): Promise<FormData> {
  if (Number(request.headers.get("content-length")) > MAX_AUDIO_REQUEST_BYTES) {
    throw new AudioRequestTooLarge();
  }
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing recording");
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_AUDIO_REQUEST_BYTES) {
        await reader.cancel();
        throw new AudioRequestTooLarge();
      }
      chunks.push(new Uint8Array(value));
    }
  } finally {
    reader.releaseLock();
  }
  return new Response(new Blob(chunks), {
    headers: { "Content-Type": request.headers.get("content-type") ?? "" },
  }).formData();
}
