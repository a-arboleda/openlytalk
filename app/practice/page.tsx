import { getTodayCard } from "@/lib/story-practice/daily";

export const dynamic = "force-dynamic";
import { COACHING_BETA_RULES } from "@/lib/coaching/product-rules";
import type { Metadata } from "next";

import { StoryLauncher } from "@/components/practice/story-launcher";

import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

export const metadata: Metadata = {
  title: "Practice",
  description: "Speak about something real and notice one useful communication choice.",
};

export default function PracticePage() {
  return (
    <div className="editorial-page practice-entry min-h-screen">
      <SiteHeader active="practice" />
      <main className="site-shell py-12 sm:py-16 lg:py-20">
        <section className="mx-auto max-w-5xl text-center">
          <p className="eyebrow">Practice</p>
          <h1 className="display-title mt-5">One question. Your own words.</h1>
          <p className="mt-5 text-lg leading-8 text-muted sm:text-xl">Get to know yourself through one personal question a day.</p>

          <StoryLauncher today={getTodayCard()} />

          <div className="practice-notes">
            <span>◷ One response · Up to {COACHING_BETA_RULES.maxRecordingSeconds} seconds</span>
            <span>▢ Your audio stays in this tab for review</span>
          </div>
          <p className="mt-6 text-sm text-muted">Speak in English. Review your response before sending.</p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
