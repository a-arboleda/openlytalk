import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { parseServerEnv } from "@/lib/env";

// A purpose-specific derived key keeps previews stateless across server instances.
function signature(owner: string, id: string, audio: Uint8Array, transcript: string, expiry: string) {
  const secret = parseServerEnv().OPENAI_API_KEY;
  if (!secret) throw new Error("Transcription unavailable.");
  const key = createHmac("sha256", secret).update("openlytalk/story-preview/v7").digest();
  return createHmac("sha256", key).update(JSON.stringify([owner, id, createHash("sha256").update(audio).digest("hex"), transcript, expiry])).digest("hex");
}
export function signPreview(owner: string, id: string, audio: Uint8Array, transcript: string) {
  const expiry = String(Date.now() + 60 * 60 * 1000);
  return `${expiry}.${signature(owner, id, audio, transcript, expiry)}`;
}
export function verifyPreview(owner: string, id: string, audio: Uint8Array, transcript: string, proof: string) {
  const [expiry, received] = proof.split(".");
  if (!expiry || !received || !/^\d{13}$/.test(expiry) || !/^[a-f0-9]{64}$/.test(received) || Number(expiry) < Date.now()) return false;
  return timingSafeEqual(Buffer.from(received, "hex"), Buffer.from(signature(owner, id, audio, transcript, expiry), "hex"));
}
