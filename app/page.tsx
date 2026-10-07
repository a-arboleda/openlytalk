import { getTodayCard } from "@/lib/story-practice/daily";

export const dynamic = "force-dynamic";
import { StoryLauncher } from "@/components/practice/story-launcher";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { COACHING_BETA_RULES } from "@/lib/coaching/product-rules";

export default function Home() {
  return (
    <div className="editorial-page practice-entry reference-home min-h-screen">
      <SiteHeader />
      <main>
        <section className="site-shell reference-hero py-12 sm:py-16 lg:py-20">
          <div className="mx-auto max-w-5xl text-center">
            <p className="eyebrow">One personal question a day.</p>
            <h1 className="display-title mt-5">Get to know yourself, one answer at a time.</h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted sm:text-xl">Practice expressing your thoughts in English with one personal question a day.</p>
            <StoryLauncher today={getTodayCard()} showCategory={false} />
            <div className="practice-notes">
              <span>◷ One response · Up to {COACHING_BETA_RULES.maxRecordingSeconds} seconds</span>
              <span>Review before sending</span>
              <span>Your audio is not saved</span>
            </div>
          </div>
        </section>
        <section className="border-y border-line bg-paper-deep">
          <div className="site-shell grid gap-6 py-8 sm:grid-cols-3 sm:py-10">
            {[
              ["01 / Speak", "Start with your own words.", "Take a moment with today’s question. Share what comes to mind, in your own words."],
              ["02 / Reflect", "Review before you send.", "Listen to your audio, read the transcript, and make sure it says what you meant."],
              ["03 / Keep", "Take one adjustment with you.", "Get focused feedback and download your response and recommendations as a PDF."],
            ].map(([label, title, copy]) => <div key={label}><p className="eyebrow">{label}</p><h2 className="font-editorial mt-3 text-2xl leading-tight text-ink">{title}</h2><p className="mt-3 leading-7 text-muted">{copy}</p></div>)}
          </div>
        </section>
        <section className="site-shell max-w-3xl py-8 sm:py-10">
          <p className="eyebrow">Getting to Know Yourself</p>
          <h2 className="section-title mt-4">Make space for your own thoughts.</h2>
          <p className="mt-5 text-lg leading-8 text-muted">Explore what matters to you, what you want, and how your views have changed. You do not need a perfect answer. You can be unsure, think aloud, and choose how much to share.</p>
          <p className="mt-4 leading-7 text-muted">Your coach helps you express your meaning more clearly and naturally in English. You decide what your answer means to you.</p>
        </section>
        <section className="site-shell max-w-3xl py-8 text-center sm:py-10">
          <p className="eyebrow">Communicate more intentionally in English</p>
          <h2 className="section-title mt-4">Your meaning comes first.</h2>
          <p className="mt-5 text-lg leading-8 text-muted">For intermediate English speakers who want room to think, speak, and reflect. One response at a time.</p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
