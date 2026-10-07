import { MAX_AUDIO_REQUEST_BYTES } from "@/lib/audio/limits";
import { readAudioForm } from "@/lib/audio/request";
import { COACHING_BETA_RULES } from "@/lib/coaching/product-rules";
import { z } from "zod";
import { MAX_AUDIO_BYTES, validateRecording } from "@/lib/audio/recording";
import { publicStory } from "@/lib/story-practice/contracts";
import { acceptsResponse, requireStory, StoryError, submitStory } from "@/lib/story-practice/engine";
import { generateStoryFeedback } from "@/lib/story-practice/feedback-provider";
import { signPreview, verifyPreview } from "@/lib/story-practice/preview-proof";
import { getStoryRepository } from "@/lib/story-practice/repository";
import { checkOrigin, storyOwner, storyFailure, storyJson } from "@/lib/story-practice/route-utils";
import { getPracticeTranscriptionProvider } from "@/lib/providers/practice-audio-providers";
import { moderateStoryTranscript } from "@/lib/story-practice/content-moderation";
export const runtime = "nodejs";
export const maxDuration = 180;
const fields = z.object({
  action: z.enum(["preview", "submit"]), expectedUpdatedAt: z.iso.datetime(),
  expectedLearnerSequence: z.coerce.number().int().min(0).max(1),
  idempotencyKey: z.uuid(), transcript: z.string().max(4000).optional(), proof: z.string().max(100).optional(),
}).strict();
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request);
    const { id } = await context.params;
    const owner = await storyOwner(id);
    if (Number(request.headers.get("content-length")) > MAX_AUDIO_REQUEST_BYTES) throw new StoryError(413, "That recording is too large.");
    const form = await readAudioForm(request);
    const file = form.get("audio");
    const raw = Object.fromEntries([...form.entries()].filter(([key]) => key !== "audio"));
    const input = fields.parse(raw);
    if (!(file instanceof File) || file.size > MAX_AUDIO_BYTES) throw new StoryError(422, `Record one response, up to ${COACHING_BETA_RULES.maxRecordingSeconds} seconds.`);
    const repo = getStoryRepository();
    const state = await requireStory(repo, id, owner);
    // A committed retry returns before any audio or provider work.
    if (input.action === "submit" && state.status === "completed" && state.committedKey === input.idempotencyKey) return storyJson({ session: publicStory(state) });
    if (!acceptsResponse(state) || state.updatedAt !== input.expectedUpdatedAt) throw new StoryError(409, "This practice has changed. Refresh it before continuing.");
    const audio = new Uint8Array(await file.arrayBuffer());
    async function transcribe() {
      const recording = await validateRecording({ audio, mimeType: (file as File).type });
      const result = await getPracticeTranscriptionProvider().transcribe({ audio, mimeType: (file as File).type, filename: recording.filename, language: "en" });
      const transcript = result.text.replace(/\s+/g, " ").trim();
      if (!transcript || transcript.length > 4000) throw new StoryError(422, "We could not hear a clear response. Please record it again.");
      return transcript;
    }
    if (input.action === "preview") {
      if (state.reservation && state.reservation.expiresAt > new Date().toISOString()) throw new StoryError(409, "Your response is still being processed.");
      const transcript = await transcribe();
      return storyJson({ transcript, proof: signPreview(owner, id, audio, transcript) });
    }
    const result = await submitStory({
      repo, id, owner, key: input.idempotencyKey, expectedUpdatedAt: input.expectedUpdatedAt,
      expectedLearnerSequence: input.expectedLearnerSequence, feedback: generateStoryFeedback,
      moderateTranscript: moderateStoryTranscript,
      prepareTranscript: async () => {
        await validateRecording({ audio, mimeType: file.type });
        if (input.transcript && input.proof && verifyPreview(owner, id, audio, input.transcript, input.proof)) return input.transcript;
        return transcribe();
      },
    });
    return storyJson({ session: publicStory(result) });
  } catch (error) { return storyFailure(error); }
}
