import "server-only";

import OpenAI from "openai";

import { parseServerEnv } from "@/lib/env";
import {
  OpenAISpeechProvider,
  OpenAITranscriptionProvider,
} from "@/lib/openai/openai-audio-providers";

let providers:
  | {
      transcription: OpenAITranscriptionProvider;
      speech: OpenAISpeechProvider;
    }
  | undefined;

export function getAudioProviders() {
  if (providers) return providers;

  const env = parseServerEnv();
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for the audio experience.");
  }

  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  providers = {
    transcription: new OpenAITranscriptionProvider(
      client,
      env.OPENAI_TRANSCRIPTION_MODEL,
    ),
    speech: new OpenAISpeechProvider(
      client,
      env.OPENAI_TTS_MODEL,
      env.OPENAI_TTS_VOICE,
    ),
  };
  return providers;
}
