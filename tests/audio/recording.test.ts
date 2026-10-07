import { describe, expect, it } from "vitest";

import {
  AudioValidationError,
  validateRecording,
} from "@/lib/audio/recording";
import { wavFixture } from "@/tests/helpers/audio";

describe("recording validation", () => {
  it("reads the actual duration and assigns a provider-safe filename", async () => {
    await expect(
      validateRecording({ audio: wavFixture(1), mimeType: "audio/wav" }),
    ).resolves.toMatchObject({ durationSeconds: 1, filename: "response.wav" });
  });

  it.each([59.5, 60, 60.05, 61])("accepts a %s-second recording including automatic-stop delay", async (durationSeconds) => {
    await expect(
      validateRecording({ audio: wavFixture(durationSeconds), mimeType: "audio/wav" }),
    ).resolves.toMatchObject({ durationSeconds, filename: "response.wav" });
  });

  it.each([
    [new Uint8Array(), "audio/wav", "empty"],
    [wavFixture(1), "text/plain", "unsupported"],
    [new Uint8Array([1, 2, 3]), "audio/wav", "unreadable"],
    [wavFixture(0.1), "audio/wav", "too_short"],
    [wavFixture(61.01), "audio/wav", "too_long"],
    [wavFixture(120), "audio/wav", "too_long"],
  ] as const)("rejects invalid audio as %s", async (audio, mimeType, code) => {
    await expect(validateRecording({ audio, mimeType })).rejects.toMatchObject({
      code,
    } satisfies Partial<AudioValidationError>);
  });
});
