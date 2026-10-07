"use client";
import { COACHING_BETA_RULES } from "@/lib/coaching/product-rules";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { SiteHeader } from "@/components/site/site-header";
import { PracticeRecorder, type PracticePendingRecording } from "@/components/practice/practice-recorder";
import { publicStoryResponseSchema, type PublicStory, type StoryFeedback } from "@/lib/story-practice/contracts";

async function body(response: Response, fallback = "Practice is temporarily unavailable. Please try again.") {
  let value;
  try { value = await response.json(); } catch { throw new Error("We could not reach Practice. Please try again."); }
  if (!response.ok) throw new Error(value.error?.message ?? fallback);
  return value;
}
function Feedback({ feedback: f }: { feedback: StoryFeedback }) {
  const section = (title: string, content: React.ReactNode) => <section className="rounded-2xl border border-line bg-white/60 p-6"><h2 className="font-editorial text-2xl text-ink">{title}</h2><div className="mt-3 space-y-3 leading-7 text-muted">{content}</div></section>;
  return <div className="space-y-4">
    {f.entryMode === "random_question" && <>
      {section("What you practiced", <p>{f.whatYouPracticed}</p>)}
      {f.whatWorked && section("What worked", <p>{f.whatWorked.text}</p>)}
      {section("One improvement", <p>{f.oneImprovement.text}</p>)}
    </>}
    {section("Keep it concise", <>
      <p>{f.concision.observation.text}</p>
      {f.concision.nextStep && <p>{f.concision.nextStep}</p>}
      {f.entryMode === "free_share" && f.concision.conciseExample && <blockquote className="border-l-2 border-sage pl-4">{f.concision.conciseExample.text}</blockquote>}
    </>)}
    {f.entryMode === "random_question" && <>
      {section("A natural example", <blockquote>{f.naturalExample.text}</blockquote>)}
      {f.englishPolish.length > 0 && section("English polish", <ul className="space-y-4">{f.englishPolish.map((item, index) => <li key={index}><p><span>{item.original}</span> → <strong className="font-semibold text-ink">{item.suggestion}</strong></p><p>{item.explanation}</p></li>)}</ul>)}
      {section("Try it in real life", <p>{f.tryItInRealLife}</p>)}
    </>}
  </div>;
}
export function StoryExperience({ id }: { id: string }) {
  const endpoint = `/api/story-practices/${id}`;
  const [session, setSession] = useState<PublicStory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const preview = useRef<{ blob: Blob; transcript: string; proof: string } | null>(null);
  const actionLock = useRef(false);
  const pendingAction = useRef<{ action: string; idempotencyKey: string; expectedUpdatedAt: string } | null>(null);
  const refresh = useCallback(async () => {
    const next = publicStoryResponseSchema.parse(await body(await fetch(endpoint, { cache: "no-store" })));
    setSession(next.session);
    return next.session;
  }, [endpoint]);
  useEffect(() => {
    let active = true;
    fetch(endpoint, { cache: "no-store" }).then(body).then(data => {
      if (active) setSession(publicStoryResponseSchema.parse(data).session);
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [endpoint]);
  async function action(name: "start" | "end") {
    if (!session || actionLock.current) return;
    actionLock.current = true;
    setBusy(true); setError(null);
    const pending = pendingAction.current;
    const request = pending?.action === name ? pending : { action: name, idempotencyKey: crypto.randomUUID(), expectedUpdatedAt: session.updatedAt };
    pendingAction.current = request;
    try {
      setSession(publicStoryResponseSchema.parse(await body(await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) }))).session);
      pendingAction.current = null;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
      const refreshed = await refresh().catch(() => null);
      if (refreshed) pendingAction.current = null;
    } finally { actionLock.current = false; setBusy(false); }
  }
  async function sendAudio(recording: PracticePendingRecording, action: "preview" | "submit") {
    if (!session) throw new Error("Open your practice again.");
    const form = new FormData();
    form.set("audio", recording.blob, "response");
    form.set("action", action); form.set("idempotencyKey", recording.idempotencyKey);
    form.set("expectedUpdatedAt", session.updatedAt); form.set("expectedLearnerSequence", String(session.expectedLearnerSequence));
    if (action === "submit" && preview.current?.blob === recording.blob) {
      form.set("transcript", preview.current.transcript); form.set("proof", preview.current.proof);
    }
    try { return await body(await fetch(`${endpoint}/audio`, { method: "POST", body: form }), "Your recording is safe to retry. Check your connection and send it again."); }
    catch (e) {
      // Recover the committed result after a lost response, keeping the recording for a failed provider call.
      const current = await refresh().catch(() => null);
      if (action === "submit" && current?.status === "completed") return { session: current };
      throw e;
    }
  }
  async function downloadPdf() {
    if (downloading) return;
    setDownloading(true); setError(null);
    try {
      const response = await fetch(`${endpoint}/pdf`, { cache: "no-store" });
      if (!response.ok) { await body(response); return; }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url; link.download = "openlytalk-practice.pdf";
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "We could not download your PDF. Please try again.");
    } finally { setDownloading(false); }
  }
  async function remove() {
    if (actionLock.current) return;
    actionLock.current = true; setBusy(true); setError(null);
    try { await body(await fetch(endpoint, { method: "DELETE" })); preview.current = null; setSession(null); setDeleted(true); }
    catch (e) { setError(e instanceof Error ? e.message : "Please try again."); }
    finally { actionLock.current = false; setBusy(false); }
  }
  const question = session?.question;
  const questionKey = question ? `${question.id}:${question.version}` : "";
  return <div className="editorial-page min-h-screen">
    <SiteHeader active="practice" />
    <main className={`site-shell max-w-3xl py-8 sm:py-12 ${session?.phase === "initial_simulation" && session.status === "active" ? "pb-80" : ""}`}>
      <div className="mb-8 flex items-center justify-between gap-4">
        <Link href="/practice" className="text-link">← Practice</Link>
        {session?.status === "active" && <button type="button" className="text-link" disabled={busy || submitting} onClick={() => void action("end")}>End practice</button>}
      </div>
      {error && <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p>{error}</p>{!session && !deleted && <button className="mt-3 underline" onClick={() => { setError(null); void refresh().catch(e => setError(e.message)); }}>Try again</button>}</div>}
      {!session && !deleted && !error && <p role="status">Opening your practice…</p>}
      {deleted && <><h1 className="section-title">Practice deleted</h1><p className="mt-4 text-muted">Your response and feedback have been removed.</p><Link className="forest-button mt-6" href="/practice">Start a new practice</Link></>}
      {session?.status === "ended" && <><h1 className="section-title">Practice ended</h1><p className="mt-4 text-muted">You can start again whenever you are ready.</p><Link className="forest-button mt-6" href="/practice">Start a new practice</Link></>}
      {session?.status === "active" && <>
        {session.daily && <div className="mb-8"><p className="eyebrow">Your practice</p><h2 className="font-editorial mt-2 text-3xl text-ink">{"categoryTitle" in session.daily ? session.daily.categoryTitle : session.daily.themeTitle}</h2></div>}
        <p className="eyebrow">{question ? "Practice question" : "Share anything"}</p>
        <h1 className="font-editorial mt-5 text-4xl leading-tight text-ink sm:text-5xl">{question?.text ?? "What would you like to share?"}</h1>
        {session.daily?.supportPrompt && <p className="mt-4 leading-7 text-muted">{session.daily.supportPrompt}</p>}
        <p className="mt-5 leading-7 text-muted">{question ? "Take a moment to think. Then explain it in your own words." : "Speak about anything on your mind. Your coach will help you notice what keeps your response focused."}</p>
        {session.phase === "briefing" && <>
          {question && <>
            <details key={questionKey} className="mt-8 rounded-2xl border border-line p-5"><summary className="cursor-pointer font-semibold text-forest">Help me shape my response</summary><ol className="mt-4 list-decimal space-y-2 pl-5 leading-7 text-muted">{question.responseGuide.steps.map(step => <li key={step}>{step}</li>)}</ol><details className="mt-5"><summary className="cursor-pointer text-sm font-semibold text-forest">Show an example</summary><p className="mt-3 leading-7 text-muted">{question.responseGuide.example}</p></details></details>
          </>}
          <button className="forest-button mt-9 disabled:opacity-50" disabled={busy} onClick={() => void action("start")}>{busy ? "Opening…" : "Respond aloud"} <span aria-hidden="true">→</span></button>
          <p className="mt-5 text-sm leading-6 text-muted">One response in English · Up to {COACHING_BETA_RULES.maxRecordingSeconds} seconds<br />Review your audio and transcript before sending. Your audio stays in this tab for review.</p>
        </>}
        {session.phase === "initial_simulation" && <PracticeRecorder disabled={busy} onSubmittingChange={setSubmitting}
          onPreview={async ({ blob }) => {
            const result = z.object({ transcript: z.string().min(1), proof: z.string().min(1) }).parse(await sendAudio({ blob, idempotencyKey: crypto.randomUUID() }, "preview"));
            preview.current = { blob, ...result }; return result.transcript;
          }}
          onSubmit={async recording => {
            const result = publicStoryResponseSchema.parse(await sendAudio(recording, "submit"));
            preview.current = null; setSession(result.session);
          }} />}
      </>}
      {session?.status === "completed" && session.feedback && <>
        <p className="eyebrow">Your coach</p><h1 className="section-title mb-8 mt-4">A moment to reflect.</h1>
        <Feedback feedback={session.feedback} />
        <div className="mt-6 rounded-2xl border border-line p-6">
          <h2 className="font-editorial text-2xl text-ink">Keep your practice</h2>
          <p className="mt-2 text-sm leading-6 text-muted">Download your response and recommendations. Your downloaded copy stays on your device after this practice expires.</p>
          <button type="button" onClick={() => void downloadPdf()} disabled={downloading || busy} className="outline-forest-button mt-4 disabled:opacity-50">{downloading ? "Preparing PDF…" : "Download PDF"}</button>
        </div>
        <details className="mt-6 rounded-2xl border border-line p-6"><summary className="cursor-pointer font-semibold text-forest">View response</summary>{question && <div className="mt-5"><h2 className="eyebrow">Practice question</h2><p className="mt-2 leading-7">{question.text}</p></div>}<h2 className="eyebrow mt-5">Your response</h2><p className="mt-2 whitespace-pre-wrap leading-7 text-muted">{session.transcript}</p></details>
        <Link className="forest-button mt-8" href="/practice">Start a new practice</Link>
      </>}
      {session && session.status !== "active" && <div className="mt-8 text-sm text-muted"><p>Responses and feedback expire within seven days.</p><button onClick={() => void remove()} disabled={busy} className="mt-3 underline">{busy ? "Deleting…" : "Delete this practice"}</button></div>}
    </main>
  </div>;
}
