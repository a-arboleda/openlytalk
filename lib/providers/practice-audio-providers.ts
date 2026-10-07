import "server-only";

import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import OpenAI from "openai";

import { getPracticeProviderConfig } from "@/lib/coaching/provider-config";
import type { PracticeSpeechProvider } from "@/lib/coaching/provider-contracts";
import { ElevenLabsPracticeSpeechProvider } from "@/lib/elevenlabs/elevenlabs-practice-speech-provider";
import { parseServerEnv } from "@/lib/env";
import { OpenAITranscriptionProvider } from "@/lib/openai/openai-audio-providers";
import { OpenAIPracticeSpeechProvider } from "@/lib/openai/openai-practice-speech-provider";
import { RoleBasedPracticeSpeechProvider } from "@/lib/providers/role-based-practice-speech-provider";

let speechProvider: PracticeSpeechProvider | undefined;
let elevenLabsPartnerSpeechProvider: PracticeSpeechProvider | undefined;
let transcriptionProvider: OpenAITranscriptionProvider | undefined;

export function getElevenLabsPartnerSpeechProvider(): PracticeSpeechProvider {
  if (elevenLabsPartnerSpeechProvider) {
    return elevenLabsPartnerSpeechProvider;
  }

  const { ELEVENLABS_API_KEY } = parseServerEnv();
  if (!ELEVENLABS_API_KEY) {
    throw new Error("ELEVENLABS_API_KEY is required for prompt speech.");
  }

  elevenLabsPartnerSpeechProvider = new ElevenLabsPracticeSpeechProvider(
    new ElevenLabsClient({ apiKey: ELEVENLABS_API_KEY }),
    getPracticeProviderConfig().speech.elevenLabsPartner,
  );
  return elevenLabsPartnerSpeechProvider;
}

export function getPracticeSpeechProvider(): PracticeSpeechProvider {
  if (speechProvider) return speechProvider;

  const { OPENAI_API_KEY, ELEVENLABS_API_KEY } = parseServerEnv();
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for practice speech.");
  }

  const config = getPracticeProviderConfig();
  const openAIProvider = new OpenAIPracticeSpeechProvider(
    new OpenAI({ apiKey: OPENAI_API_KEY }),
    config.speech,
  );

  if (!ELEVENLABS_API_KEY) {
    speechProvider = openAIProvider;
    return speechProvider;
  }

  const partnerProvider = getElevenLabsPartnerSpeechProvider();
  speechProvider = new RoleBasedPracticeSpeechProvider({
    coach: openAIProvider,
    partner: partnerProvider,
  });
  return speechProvider;
}

export function getPracticeTranscriptionProvider(): OpenAITranscriptionProvider {
  if (transcriptionProvider) return transcriptionProvider;

  const { OPENAI_API_KEY } = parseServerEnv();
  if (!OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is required for practice transcription.",
    );
  }

  transcriptionProvider = new OpenAITranscriptionProvider(
    new OpenAI({ apiKey: OPENAI_API_KEY }),
    getPracticeProviderConfig().transcription.model,
  );
  return transcriptionProvider;
}
