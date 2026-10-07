import { describe, expect, it } from "vitest";

import { partnerRolePhrase } from "@/lib/coaching/partner-role-label";

describe("natural partner role headings", () => {
  it.each([
    ["Sibling", "your sibling"],
    ["project colleague", "your project colleague"],
    ["Your manager", "your manager"],
    ["The interviewer", "the interviewer"],
    ["interviewer", "the interviewer"],
    ["A trusted friend", "a trusted friend"],
    ["employee", "an employee"],
    ["barista", "a barista"],
  ])("formats %s as %s", (roleLabel, expected) => {
    expect(partnerRolePhrase(roleLabel)).toBe(expected);
  });
});
