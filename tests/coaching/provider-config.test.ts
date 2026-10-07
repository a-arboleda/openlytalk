import { describe, expect, it } from "vitest";

import {
  getPracticeProviderConfig,
  PRACTICE_TEXT_STAGES,
} from "@/lib/coaching/provider-config";

describe("practice provider configuration", () => {
  it("routes latency-sensitive and reflective work to separate models", () => {
    const config = getPracticeProviderConfig({ NODE_ENV: "test" });

    expect(config.responses.stages.plan).toEqual({
      model: "gpt-5.6-luna",
      reasoningEffort: "none",
    });
    expect(config.responses.stages.setupInference).toEqual(
      config.responses.stages.plan,
    );
    expect(config.responses.stages.partnerTurn).toEqual(
      config.responses.stages.plan,
    );
    expect(config.responses.stages.help).toEqual(
      config.responses.stages.plan,
    );
    expect(config.responses.stages.coachingBreak).toEqual({
      model: "gpt-5.6-terra",
      reasoningEffort: "low",
    });
    expect(config.responses.stages.takeaway).toEqual(
      config.responses.stages.coachingBreak,
    );
    expect(Object.keys(config.responses.stages).sort()).toEqual(
      [...PRACTICE_TEXT_STAGES].sort(),
    );
    expect(config.responses.store).toBe(false);
    expect(config.responses.verbosity).toBe("low");
  });

  it("keeps coach and partner audio behavior visibly distinct", () => {
    const config = getPracticeProviderConfig({ NODE_ENV: "test" });

    expect(config.speech.roles.coach.voice).toBe("cedar");
    expect(config.speech.roles.partner.voice).toBe("marin");
    expect(config.speech.model).toBe("gpt-4o-mini-tts-2025-12-15");
    expect(config.speech.elevenLabsPartner).toEqual({
      model: "eleven_flash_v2_5",
      defaultVoiceId: "DODLEQrClDo8wCz460ld",
      masculineVoiceId: "pNInz6obpgDQGcFmaJgB",
      outputFormat: "mp3_44100_128",
    });
    expect(config.speech.roles.coach.voice).not.toBe(
      config.speech.roles.partner.voice,
    );
    expect(config.speech.roles.coach.autoplay).toBe(false);
    expect(config.speech.roles.partner.autoplay).toBe(true);
  });

  it("allows every provider choice to be changed without engine changes", () => {
    const config = getPracticeProviderConfig({
      NODE_ENV: "test",
      OPENAI_PRACTICE_FAST_MODEL: "fast-model",
      OPENAI_PRACTICE_REFLECTION_MODEL: "reflection-model",
      OPENAI_PRACTICE_TRANSCRIPTION_MODEL: "transcription-model",
      OPENAI_PRACTICE_SPEECH_MODEL: "speech-model",
      OPENAI_PRACTICE_COACH_VOICE: "coach-voice",
      OPENAI_PRACTICE_PARTNER_VOICE: "partner-voice",
      ELEVENLABS_PARTNER_VOICE_ID: "elevenlabs-partner-voice",
      ELEVENLABS_PARTNER_MASCULINE_VOICE_ID:
        "elevenlabs-masculine-voice",
      ELEVENLABS_TTS_MODEL: "elevenlabs-model",
      ELEVENLABS_OUTPUT_FORMAT: "mp3_44100_128",
    });

    expect(config.responses.stages.plan.model).toBe("fast-model");
    expect(config.responses.stages.coachingBreak.model).toBe(
      "reflection-model",
    );
    expect(config.transcription.model).toBe("transcription-model");
    expect(config.speech.model).toBe("speech-model");
    expect(config.speech.roles.coach.voice).toBe("coach-voice");
    expect(config.speech.roles.partner.voice).toBe("partner-voice");
    expect(config.speech.elevenLabsPartner).toEqual({
      model: "elevenlabs-model",
      defaultVoiceId: "elevenlabs-partner-voice",
      masculineVoiceId: "elevenlabs-masculine-voice",
      outputFormat: "mp3_44100_128",
    });
  });
});
