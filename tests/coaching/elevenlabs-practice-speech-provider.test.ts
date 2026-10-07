import { describe, expect, it } from "vitest";

import { getPracticeProviderConfig } from "@/lib/coaching/provider-config";
import { ElevenLabsPracticeSpeechProvider } from "@/lib/elevenlabs/elevenlabs-practice-speech-provider";

describe("ElevenLabs practice speech provider", () => {
  it("generates request-scoped partner MP3 audio with the selected voice", async () => {
    const requests: unknown[] = [];
    const client = {
      textToSpeech: {
        convert: async (...request: unknown[]) => {
          requests.push(request);
          return new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(Uint8Array.from([1, 2]));
              controller.enqueue(Uint8Array.from([3, 4]));
              controller.close();
            },
          });
        },
      },
    } as unknown as ConstructorParameters<
      typeof ElevenLabsPracticeSpeechProvider
    >[0];
    const config = getPracticeProviderConfig({ NODE_ENV: "test" });
    const provider = new ElevenLabsPracticeSpeechProvider(
      client,
      config.speech.elevenLabsPartner,
    );

    await expect(
      provider.synthesize({
        speechId: "message-1",
        text: "Could you tell me more about that experience?",
        role: "partner",
        format: "mp3",
      }),
    ).resolves.toEqual({
      audio: Uint8Array.from([1, 2, 3, 4]),
      contentType: "audio/mpeg",
    });
    expect(requests).toEqual([
      [
        "DODLEQrClDo8wCz460ld",
        {
          text: "Could you tell me more about that experience?",
          modelId: "eleven_flash_v2_5",
          outputFormat: "mp3_44100_128",
          languageCode: "en",
        },
      ],
    ]);
  });

  it("rejects coach requests so role separation cannot be bypassed", async () => {
    const provider = new ElevenLabsPracticeSpeechProvider(
      {} as ConstructorParameters<
        typeof ElevenLabsPracticeSpeechProvider
      >[0],
      getPracticeProviderConfig({ NODE_ENV: "test" }).speech
        .elevenLabsPartner,
    );

    await expect(
      provider.synthesize({
        speechId: "coach-1",
        text: "Focus on one clear next step.",
        role: "coach",
        format: "mp3",
      }),
    ).rejects.toThrow("limited to partner audio");
  });

  it("uses the masculine voice for an explicitly masculine partner role", async () => {
    const requests: unknown[] = [];
    const client = {
      textToSpeech: {
        convert: async (...request: unknown[]) => {
          requests.push(request);
          return new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(Uint8Array.from([1]));
              controller.close();
            },
          });
        },
      },
    } as unknown as ConstructorParameters<
      typeof ElevenLabsPracticeSpeechProvider
    >[0];
    const provider = new ElevenLabsPracticeSpeechProvider(
      client,
      getPracticeProviderConfig({ NODE_ENV: "test" }).speech
        .elevenLabsPartner,
    );

    await provider.synthesize({
      speechId: "boyfriend-message",
      text: "I understand. Let’s work this out together.",
      role: "partner",
      voiceProfile: "masculine",
      format: "mp3",
    });

    expect((requests[0] as unknown[])[0]).toBe(
      "pNInz6obpgDQGcFmaJgB",
    );
  });
});
