import OpenAI from "openai";
import { describe, expect, it } from "vitest";

import { getPracticeProviderConfig } from "@/lib/coaching/provider-config";
import { OpenAIPracticeSpeechProvider } from "@/lib/openai/openai-practice-speech-provider";

describe("OpenAI practice speech provider", () => {
  it("maps the partner role to its configured voice and speech instructions", async () => {
    const requests: unknown[] = [];
    const client = {
      audio: {
        speech: {
          create: async (request: unknown) => {
            requests.push(request);
            return {
              arrayBuffer: async () =>
                Uint8Array.from([1, 2, 3]).buffer,
            };
          },
        },
      },
    } as unknown as OpenAI;
    const config = getPracticeProviderConfig({ NODE_ENV: "test" });
    const provider = new OpenAIPracticeSpeechProvider(
      client,
      config.speech,
    );

    await expect(
      provider.synthesize({
        speechId: "message-1",
        text: "Could you tell me more about that experience?",
        role: "partner",
        format: "mp3",
      }),
    ).resolves.toEqual({
      audio: Uint8Array.from([1, 2, 3]),
      contentType: "audio/mpeg",
    });
    expect(requests).toEqual([
      {
        model: "gpt-4o-mini-tts-2025-12-15",
        voice: "marin",
        input: "Could you tell me more about that experience?",
        instructions: config.speech.roles.partner.instructions,
        response_format: "mp3",
      },
    ]);
  });
});
