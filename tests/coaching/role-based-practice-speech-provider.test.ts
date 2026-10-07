import { describe, expect, it, vi } from "vitest";

import type { PracticeSpeechProvider } from "@/lib/coaching/provider-contracts";
import { RoleBasedPracticeSpeechProvider } from "@/lib/providers/role-based-practice-speech-provider";

describe("role-based practice speech provider", () => {
  it("keeps coach and simulation-partner providers separate", async () => {
    const coach: PracticeSpeechProvider = {
      synthesize: vi.fn(async () => ({
        audio: Uint8Array.from([1]),
        contentType: "audio/mpeg" as const,
      })),
    };
    const partner: PracticeSpeechProvider = {
      synthesize: vi.fn(async () => ({
        audio: Uint8Array.from([2]),
        contentType: "audio/mpeg" as const,
      })),
    };
    const provider = new RoleBasedPracticeSpeechProvider({ coach, partner });
    const request = {
      speechId: "partner-1",
      text: "What happened next?",
      role: "partner" as const,
      format: "mp3" as const,
    };

    await expect(provider.synthesize(request)).resolves.toEqual({
      audio: Uint8Array.from([2]),
      contentType: "audio/mpeg",
    });
    expect(partner.synthesize).toHaveBeenCalledWith(request);
    expect(coach.synthesize).not.toHaveBeenCalled();
  });
});
