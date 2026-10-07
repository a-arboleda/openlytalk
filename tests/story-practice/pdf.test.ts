import { describe, expect, it } from "vitest";
import { createPracticePdf, practiceReportSections } from "@/lib/story-practice/pdf";
import { reportFixture } from "@/tests/helpers/story-report";

describe("practice PDF", () => {
  it("includes only the transcript and supported concision feedback for free sharing", () => {
    const sections = practiceReportSections(reportFixture());
    expect(sections.map(s => s.title)).toEqual(["Your response", "Keep it concise"]);
    expect(sections[0].paragraphs).toEqual([reportFixture().transcript]);
    expect(JSON.stringify(sections)).not.toContain("learnerMessageId");
  });
  it("exports the question and all displayed random-question recommendations in order", () => {
    const session = reportFixture("random_question");
    const sections = practiceReportSections(session);
    expect(sections.map(s => s.title)).toEqual(["Practice question", "Your response", "What you practiced", "What worked", "One improvement", "Keep it concise", "A natural example", "English polish", "Try it in real life"]);
    expect(sections[0].paragraphs).toEqual([session.question!.text]);
    expect(JSON.stringify(sections)).not.toContain("responseGuide");
  });
  it("omits unsupported praise and empty English polish", () => {
    const session = reportFixture("random_question");
    if (session.feedback?.entryMode !== "random_question") throw new Error("Invalid fixture");
    session.feedback.whatWorked = null; session.feedback.englishPolish = [];
    expect(practiceReportSections(session).map(s => s.title)).not.toContain("What worked");
    expect(practiceReportSections(session).map(s => s.title)).not.toContain("English polish");
  });
  it("rejects incomplete sessions", async () => {
    await expect(createPracticePdf({ ...reportFixture(), status: "active", feedback: null })).rejects.toThrow("Complete your practice");
  });
  it.each(["free_share", "random_question"] as const)("renders valid PDF bytes for %s with long text and accented names", async mode => {
    const session = reportFixture(mode);
    session.transcript = session.transcript!.repeat(30);
    const pdf = await createPracticePdf(session);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.subarray(-6).toString()).toContain("%%EOF");
    expect(pdf.length).toBeGreaterThan(1000);
  });
});
