import path from "node:path";
import PDFDocument from "pdfkit";
import { publicStorySchema, type PublicStory } from "@/lib/story-practice/contracts";

export function practiceReportSections(input: PublicStory) {
  // Strip private fields and validate before composing a learner-owned export.
  const session = publicStorySchema.parse(input);
  if (session.status !== "completed" || !session.transcript || !session.feedback) {
    throw new Error("Complete your practice before downloading your feedback.");
  }
  const sections: { title: string; paragraphs: string[] }[] = [];
  if (session.question) sections.push({ title: "Practice question", paragraphs: [session.question.text] });
  sections.push({ title: "Your response", paragraphs: [session.transcript] });
  const f = session.feedback;
  if (f.entryMode === "random_question") {
    sections.push({ title: "What you practiced", paragraphs: [f.whatYouPracticed] });
    if (f.whatWorked) sections.push({ title: "What worked", paragraphs: [f.whatWorked.text] });
    sections.push({ title: "One improvement", paragraphs: [f.oneImprovement.text] });
  }
  sections.push({ title: "Keep it concise", paragraphs: [
    f.concision.observation.text,
    ...(f.concision.nextStep ? [f.concision.nextStep] : []),
    ...(f.entryMode === "free_share" && f.concision.conciseExample ? [f.concision.conciseExample.text] : []),
  ] });
  if (f.entryMode === "random_question") {
    sections.push({ title: "A natural example", paragraphs: [f.naturalExample.text] });
    if (f.englishPolish.length) sections.push({ title: "English polish", paragraphs: f.englishPolish.flatMap(item => [
      `You said: ${item.original}`, `Try: ${item.suggestion}`, item.explanation,
    ]) });
    sections.push({ title: "Try it in real life", paragraphs: [f.tryItInRealLife] });
  }
  return sections;
}

export async function createPracticePdf(session: PublicStory): Promise<Buffer> {
  const sections = practiceReportSections(session);
  const regular = path.join(process.cwd(), "assets/fonts/DejaVuSans.ttf");
  const bold = path.join(process.cwd(), "assets/fonts/DejaVuSans-Bold.ttf");
  const doc = new PDFDocument({
    size: "A4", margins: { top: 64, bottom: 64, left: 52, right: 52 },
    font: regular, bufferPages: true,
    info: { Title: "Your OpenlyTalk practice", Author: "OpenlyTalk" },
  });
  doc.registerFont("Body", regular);
  doc.registerFont("Heading", bold);
  const result = new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", chunk => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  const width = doc.page.width - 104;
  doc.fillColor("#294F40").font("Heading").fontSize(12).text("OpenlyTalk");
  doc.moveDown(0.7).fontSize(25).text("Your speaking practice");
  doc.moveDown(0.4).font("Body").fontSize(10).fillColor("#59605B")
    .text(`${session.entryMode === "free_share" ? "Share anything" : "Practice question"}  |  ${session.updatedAt.slice(0, 10)}`);
  doc.moveDown(1.4);

  for (const section of sections) {
    if (doc.y > doc.page.height - 155) doc.addPage();
    doc.font("Heading").fontSize(13).fillColor("#294F40").text(section.title, { width });
    doc.moveDown(0.5).font("Body").fontSize(10.5).fillColor("#252C27");
    for (const paragraph of section.paragraphs) {
      doc.text(paragraph, { width, lineGap: 4 });
      doc.moveDown(0.6);
    }
    doc.moveDown(0.7);
  }
  const { count } = doc.bufferedPageRange();
  for (let page = 0; page < count; page++) {
    doc.switchToPage(page);
    // Footer sits below the body margin without causing PDFKit to add a page.
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font("Body").fontSize(8).fillColor("#59605B")
      .text(`OpenlyTalk | Your response and recommendations     ${page + 1} / ${count}`, 52, doc.page.height - 40, { width, lineBreak: false });
    doc.page.margins.bottom = bottomMargin;
  }
  doc.end();
  return result;
}
