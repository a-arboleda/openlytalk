import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

export const metadata: Metadata = {
  title: "About",
  description: "Get to know yourself while practicing English. One personal question a day, space to think, and feedback to help you express your meaning.",
};

export default function AboutPage() {
  return (
    <div className="editorial-page min-h-screen">
      <SiteHeader active="about" />
      <main>
        <section className="site-shell py-8 sm:py-12">
          <p className="eyebrow">About OpenlyTalk</p>
          <h1 className="font-editorial mt-4 max-w-4xl text-4xl leading-tight text-ink sm:text-5xl lg:text-6xl">Get to know yourself, one answer at a time.</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-muted">OpenlyTalk is a space to explore your own thoughts while practicing English. One personal question a day gives you something meaningful to say — and a moment to find your own words.</p>
        </section>

        <section className="border-y border-line bg-paper-deep" aria-label="How practice works">
          <div className="site-shell grid gap-6 py-7 sm:grid-cols-3">
            {[
              ["01 / Think", "Make room for a thought.", "Read today’s question and take a moment. Optional guidance can help you get started."],
              ["02 / Speak", "Say it in your own words.", "Record up to 60 seconds in English. Listen back, review the transcript, and record again if you want to before sending."],
              ["03 / Reflect", "Find a clearer way to say it.", "Get feedback based on your response. You can download your words and recommendations as a PDF."],
            ].map(([label, title, copy]) => <div key={label}><p className="eyebrow">{label}</p><h2 className="font-editorial mt-3 text-2xl text-ink">{title}</h2><p className="mt-3 leading-7 text-muted">{copy}</p></div>)}
          </div>
        </section>

        <section className="site-shell grid gap-6 py-9 sm:py-12 lg:grid-cols-[0.65fr_1.35fr] lg:gap-12">
          <div><p className="eyebrow">Getting to Know Yourself</p><h2 className="font-editorial mt-3 text-3xl leading-tight text-ink">Your thoughts are worth putting into words.</h2></div>
          <div className="space-y-4 text-lg leading-8 text-muted">
            <p>Our questions invite you to explore what matters to you, what you want, how your views have changed, and what you are still figuring out. Some answers may come easily. Others may take a little thought.</p>
            <p>You can start with an ordinary detail, share an experience, or explain an idea you are unsure about. Choose how much you want to share. There is no right personal answer.</p>
            <p>For intermediate English speakers, this is a chance to practice expressing more of what they actually think. As you put a thought into words, you may notice something you had not considered before.</p>
          </div>
        </section>

        <section className="site-shell grid gap-6 border-t border-line py-9 sm:py-12 lg:grid-cols-[0.65fr_1.35fr] lg:gap-12">
          <div><p className="eyebrow">Your coach</p><h2 className="font-editorial mt-3 text-3xl leading-tight text-ink">Support for expressing your meaning.</h2></div>
          <div className="space-y-4 text-lg leading-8 text-muted">
            <p>Your coach uses AI to give feedback on how you communicated in this response: what was clear, what could be easier to follow, and how to say it more naturally in English.</p>
            <p>You decide what your answer means to you. The feedback focuses on your words and preserves your meaning, including uncertainty. It does not judge your choices or tell you what kind of person you are.</p>
            <p>Your audio is processed for transcription and is not saved. Submitted responses and feedback expire within seven days, and you can delete a completed practice sooner. A downloaded PDF stays on your device.</p>
          </div>
        </section>

        <section className="practice-invitation">
          <div className="site-shell flex flex-col gap-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:py-10">
            <h2 className="font-editorial max-w-2xl text-3xl leading-tight text-ink">What might you discover in your own words?</h2>
            <Link href="/practice" className="forest-button">Explore today’s question</Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
