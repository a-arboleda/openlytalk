import { describe, expect, it } from "vitest";

import { partnerVoiceProfile } from "@/lib/coaching/partner-voice-profile";

describe("partner voice profile", () => {
  it.each(["Your boyfriend", "Your husband", "Your brother"])(
    "maps %s to a masculine voice",
    (roleLabel) => {
      expect(partnerVoiceProfile(roleLabel)).toBe("masculine");
    },
  );

  it.each(["Your girlfriend", "Your wife", "Your sister"])(
    "maps %s to a feminine voice",
    (roleLabel) => {
      expect(partnerVoiceProfile(roleLabel)).toBe("feminine");
    },
  );

  it.each(["Your partner", "Your manager", "The interviewer"])(
    "keeps %s neutral when gender is not explicit",
    (roleLabel) => {
      expect(partnerVoiceProfile(roleLabel)).toBe("neutral");
    },
  );

  it("uses explicit situation context when the generated label is generic", () => {
    expect(
      partnerVoiceProfile("Your partner", [
        "The learner is speaking with her boyfriend.",
      ]),
    ).toBe("masculine");
  });

  it("stays neutral when fallback context contains conflicting relationships", () => {
    expect(
      partnerVoiceProfile("Your family member", [
        "The situation mentions both a brother and a sister.",
      ]),
    ).toBe("neutral");
  });
});
