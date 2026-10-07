import { describe, expect, it } from "vitest";

import {
  canAcceptResponse,
  isNormalStageTransitionAllowed,
  reduceTrust,
  responseWindowAfterAcceptance,
} from "@/lib/conversation-engine/transitions";

describe("response windows", () => {
  it.each([
    [1, "develop"],
    [3, "develop"],
    [4, "outcome_eligible"],
    [6, "outcome_eligible"],
    [7, "closure_pressure"],
    [8, "must_close"],
  ] as const)("maps response %s to %s", (count, expected) => {
    expect(responseWindowAfterAcceptance(count)).toBe(expected);
  });

  it("rejects a ninth response before processing", () => {
    expect(canAcceptResponse(7)).toBe(true);
    expect(canAcceptResponse(8)).toBe(false);
  });
});

describe("normal stage transitions", () => {
  it("allows only the forward canonical path", () => {
    expect(isNormalStageTransitionAllowed("opening", "developing")).toBe(
      true,
    );
    expect(isNormalStageTransitionAllowed("developing", "resolving")).toBe(
      true,
    );
    expect(isNormalStageTransitionAllowed("resolving", "closing")).toBe(
      true,
    );
  });

  it("rejects backward transitions and dialogue after closing", () => {
    expect(isNormalStageTransitionAllowed("resolving", "developing")).toBe(
      false,
    );
    expect(isNormalStageTransitionAllowed("closing", "developing")).toBe(
      false,
    );
  });
});

describe("trust transitions", () => {
  it("requires two distinct supportive responses for a normal increase", () => {
    const first = reduceTrust({
      currentLevel: "comfortable",
      supportStreak: 0,
      evidence: "supportive",
    });
    expect(first).toEqual({ level: "comfortable", supportStreak: 1 });

    const second = reduceTrust({
      currentLevel: first.level,
      supportStreak: first.supportStreak,
      evidence: "supportive",
    });
    expect(second).toEqual({ level: "open", supportStreak: 0 });
  });

  it("allows one meaningful repair to increase trust by one level", () => {
    expect(
      reduceTrust({
        currentLevel: "cautious",
        supportStreak: 0,
        evidence: "meaningful_repair",
      }),
    ).toEqual({ level: "comfortable", supportStreak: 0 });
  });

  it("decreases one level for a clear concern", () => {
    expect(
      reduceTrust({
        currentLevel: "comfortable",
        supportStreak: 1,
        evidence: "clear_concern",
      }),
    ).toEqual({ level: "cautious", supportStreak: 0 });
  });

  it("moves directly to guarded for severe evidence", () => {
    expect(
      reduceTrust({
        currentLevel: "open",
        supportStreak: 1,
        evidence: "severe",
      }),
    ).toEqual({ level: "guarded", supportStreak: 0 });
  });

  it("does not change trust without qualifying evidence", () => {
    expect(
      reduceTrust({
        currentLevel: "comfortable",
        supportStreak: 0,
        evidence: "none",
      }),
    ).toEqual({ level: "comfortable", supportStreak: 0 });
  });
});
