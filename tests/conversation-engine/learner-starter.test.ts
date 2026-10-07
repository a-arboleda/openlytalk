import { describe, expect, it } from "vitest";

import { buildLearnerStarter } from "@/lib/conversation-engine/learner-starter";
import {
  CONTEXT_VALUES,
  CONVERSATION_TYPE_VALUES,
} from "@/lib/product-rules";

describe("learner starter", () => {
  it("supports every type and context pair with three optional ideas", () => {
    for (const conversationType of CONVERSATION_TYPE_VALUES) {
      for (const context of CONTEXT_VALUES) {
        const starter = buildLearnerStarter({
          conversationId: "conversation-1",
          conversationType,
          context,
        });
        expect(starter.prompt.length).toBeGreaterThan(20);
        expect(starter.ideas).toHaveLength(3);
      }
    }
  });

  it("is stable for one conversation but varies its phrasing across IDs", () => {
    const input = {
      conversationType: "Sharing Experiences" as const,
      context: "Daily Life" as const,
    };
    const first = buildLearnerStarter({ conversationId: "a", ...input });
    const repeated = buildLearnerStarter({ conversationId: "a", ...input });
    const different = buildLearnerStarter({ conversationId: "b", ...input });

    expect(repeated).toEqual(first);
    expect(different.prompt).not.toBe(first.prompt);
  });

  it("keeps difficult-conversation invitations low pressure", () => {
    const starter = buildLearnerStarter({
      conversationId: "conversation-2",
      conversationType: "Difficult Conversations",
      context: "Relationships",
    });

    expect(starter.prompt).toMatch(/Start wherever feels easiest|small problem|part you want to talk through/);
  });

  it("invites explanations of events, processes, steps, and reasons", () => {
    const processStarter = buildLearnerStarter({
      conversationId: "a",
      conversationType: "Sharing Experiences",
      context: "Daily Life",
    });
    const sequenceStarter = buildLearnerStarter({
      conversationId: "b",
      conversationType: "Sharing Experiences",
      context: "Daily Life",
    });

    expect(processStarter.prompt).toContain("what you do first");
    expect(processStarter.prompt).toContain("what comes next");
    expect(processStarter.prompt).toContain("why you do it that way");
    expect(processStarter.ideas).toContain("Your routine, step by step");
    expect(sequenceStarter.prompt).toContain("what happened first");
    expect(sequenceStarter.prompt).toContain("why it mattered");
  });

  it("invites beliefs, common social questions, and current topics", () => {
    const dailyLife = buildLearnerStarter({
      conversationId: "conversation-2",
      conversationType: "Expressing Yourself",
      context: "Daily Life",
    });
    const lifeMoments = buildLearnerStarter({
      conversationId: "conversation-3",
      conversationType: "Expressing Yourself",
      context: "Life Moments",
    });

    expect(dailyLife.ideas).toContain("Something people are discussing lately");
    expect(lifeMoments.ideas).toContain("Something happening in the world");
    expect(lifeMoments.ideas).toContain("A belief you have changed");
  });
});
