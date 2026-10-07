import { describe, expect, it } from "vitest";

import {
  afterAcceptedLearnerResponse,
  beginTargetedRetry,
  canAcceptLearnerResponse,
  canRequestHelp,
  completeTakeaway,
  endPractice,
  remainingLearnerResponses,
  startSimulation,
  type SessionTransitionState,
} from "@/lib/coaching/transitions";

const briefingState: SessionTransitionState = {
  status: "active",
  phase: "briefing",
  acceptedResponseCount: 0,
  terminationReason: null,
};

describe("five-response allowance", () => {
  it("reports the remaining responses from zero through five", () => {
    expect(
      [0, 1, 2, 3, 4, 5].map((count) =>
        remainingLearnerResponses(count),
      ),
    ).toEqual([
      5, 4, 3, 2, 1, 0,
    ]);
  });

  it("reports the current two-response allowance without exposing legacy capacity", () => {
    expect(
      [0, 1, 2].map((count) =>
        remainingLearnerResponses(count, 2),
      ),
    ).toEqual([2, 1, 0]);
    expect(
      canAcceptLearnerResponse({
        status: "active",
        phase: "initial_simulation",
        acceptedResponseCount: 2,
        responseLimit: 2,
      }),
    ).toBe(false);
  });

  it("accepts audio only in simulation and retry phases below five", () => {
    expect(
      canAcceptLearnerResponse({
        status: "active",
        phase: "initial_simulation",
        acceptedResponseCount: 0,
      }),
    ).toBe(true);
    expect(
      canAcceptLearnerResponse({
        status: "active",
        phase: "coaching_break",
        acceptedResponseCount: 3,
      }),
    ).toBe(false);
    expect(
      canAcceptLearnerResponse({
        status: "active",
        phase: "targeted_retry",
        acceptedResponseCount: 5,
      }),
    ).toBe(false);
  });
});

describe("coaching session phases", () => {
  it("starts only from a new active briefing", () => {
    expect(startSimulation(briefingState).phase).toBe(
      "initial_simulation",
    );
    expect(() =>
      startSimulation({ ...briefingState, acceptedResponseCount: 1 }),
    ).toThrow();
  });

  it("moves the third initial response into the coaching break", () => {
    expect(
      afterAcceptedLearnerResponse({
        currentPhase: "initial_simulation",
        acceptedResponseCount: 1,
      }),
    ).toMatchObject({
      nextPhase: "initial_simulation",
      shouldGenerateCoachingBreak: false,
    });
    expect(
      afterAcceptedLearnerResponse({
        currentPhase: "initial_simulation",
        acceptedResponseCount: 3,
      }),
    ).toEqual({
      nextPhase: "coaching_break",
      shouldGenerateCoachingBreak: true,
      shouldGenerateTakeaway: false,
      usesFinalFollowUp: false,
    });
  });

  it("moves the second response in a current practice directly to final feedback", () => {
    expect(
      afterAcceptedLearnerResponse({
        currentPhase: "initial_simulation",
        acceptedResponseCount: 2,
        responseLimit: 2,
      }),
    ).toEqual({
      nextPhase: "finalizing",
      shouldGenerateCoachingBreak: false,
      shouldGenerateTakeaway: true,
      usesFinalFollowUp: false,
    });
  });

  it("begins retry only after the three-response coaching break", () => {
    expect(
      beginTargetedRetry({
        status: "active",
        phase: "coaching_break",
        acceptedResponseCount: 3,
        terminationReason: null,
      }).phase,
    ).toBe("targeted_retry");
    expect(() => beginTargetedRetry(briefingState)).toThrow();
  });

  it("always continues to the final follow-up after response four", () => {
    expect(
      afterAcceptedLearnerResponse({
        currentPhase: "targeted_retry",
        acceptedResponseCount: 4,
      }),
    ).toMatchObject({
      nextPhase: "targeted_retry",
      shouldGenerateTakeaway: false,
      usesFinalFollowUp: true,
    });
  });

  it("always finalizes after the fifth response", () => {
    expect(
      afterAcceptedLearnerResponse({
        currentPhase: "targeted_retry",
        acceptedResponseCount: 5,
      }),
    ).toEqual({
      nextPhase: "finalizing",
      shouldGenerateCoachingBreak: false,
      shouldGenerateTakeaway: true,
      usesFinalFollowUp: true,
    });
  });

  it("allows help only while the learner is expected to respond", () => {
    expect(
      canRequestHelp({
        status: "active",
        phase: "initial_simulation",
      }),
    ).toBe(true);
    expect(
      canRequestHelp({ status: "active", phase: "targeted_retry" }),
    ).toBe(true);
    expect(
      canRequestHelp({ status: "active", phase: "coaching_break" }),
    ).toBe(false);
  });
});

describe("ending and takeaway transitions", () => {
  it("ends without comparative feedback when evidence is insufficient", () => {
    expect(
      endPractice({
        state: {
          ...briefingState,
          phase: "initial_simulation",
          acceptedResponseCount: 1,
        },
        substantiveResponseCount: 1,
      }),
    ).toEqual({
      state: {
        status: "ended",
        phase: "initial_simulation",
        acceptedResponseCount: 1,
        terminationReason: "user_exit",
      },
      shouldGeneratePartialTakeaway: false,
    });
  });

  it("moves early exit with evidence into partial takeaway generation", () => {
    expect(
      endPractice({
        state: {
          ...briefingState,
          phase: "initial_simulation",
          acceptedResponseCount: 2,
        },
        substantiveResponseCount: 2,
      }),
    ).toEqual({
      state: {
        status: "active",
        phase: "finalizing",
        acceptedResponseCount: 2,
        terminationReason: "user_exit",
      },
      shouldGeneratePartialTakeaway: true,
    });
  });

  it("completes a normal takeaway without changing the response count", () => {
    expect(
      completeTakeaway({
        state: {
          status: "active",
          phase: "finalizing",
          acceptedResponseCount: 4,
          terminationReason: null,
        },
      }),
    ).toEqual({
      status: "completed",
      phase: "final_takeaway",
      acceptedResponseCount: 4,
      terminationReason: "practice_completed",
    });
  });

  it("uses response-limit completion after five responses", () => {
    expect(
      completeTakeaway({
        state: {
          status: "active",
          phase: "finalizing",
          acceptedResponseCount: 5,
          terminationReason: null,
        },
      }).terminationReason,
    ).toBe("response_limit");
  });
});
