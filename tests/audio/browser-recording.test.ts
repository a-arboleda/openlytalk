import { describe, expect, it, vi } from "vitest";

import { prepareBrowserRecording } from "@/lib/audio/browser-recording";

describe("browser recording preparation", () => {
  it("adds measured duration metadata to WebM recordings", async () => {
    const captured = new Blob([new Uint8Array([1, 2, 3])], {
      type: "audio/webm;codecs=opus",
    });
    const fixed = new Blob([new Uint8Array([4, 5, 6])], {
      type: captured.type,
    });
    const fixDuration = vi.fn(async () => fixed);

    await expect(
      prepareBrowserRecording(captured, 1_250, fixDuration),
    ).resolves.toBe(fixed);
    expect(fixDuration).toHaveBeenCalledWith(captured, 1_250, {
      logger: false,
    });
  });

  it("leaves non-WebM recordings unchanged", async () => {
    const captured = new Blob([new Uint8Array([1, 2, 3])], {
      type: "audio/mp4",
    });
    const fixDuration = vi.fn();

    await expect(
      prepareBrowserRecording(captured, 1_250, fixDuration),
    ).resolves.toBe(captured);
    expect(fixDuration).not.toHaveBeenCalled();
  });
});
