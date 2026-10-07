# Weekly speaking practice

> **Latest founder direction — takes precedence:** Follow [daily personal
> reflection](daily-self-discovery-practice.md). The public product now has one category,
> **Getting to Know Yourself**, with one question a day. It supersedes weekly
> themes, day-of-seven UI, and fixed speaking-pattern quotas below. The current
> source is `lib/story-practice/daily-questions.json`. Feedback supports English
> expression without interpreting the learner’s personality or self-knowledge.


> Founder direction: October 7, 2026. This supersedes the random-question entry,
> flat-catalog-only selection, question playback/replacement, and prohibition on
> daily themes in earlier product documents and repository guidance.

## Experience

The homepage and Practice entry show the current theme, day number (1–7), and
one daily question. The four starting themes are The Way You Do Things,
Decisions & Why You Make Them, Conversations & People, and Things That Happened.
Only theme summaries are shown ahead of time; future questions and private
coaching metadata are never sent to the browser.

One thoughtful question a day. A new theme every week. Feedback to help learners
say it more clearly and naturally. Questions mix describe, explain, recall,
reconstruct, conversation, react, and reflect in a different order each week.
These are internal editorial patterns, not learner classifications. Concrete
habits and reasons are allowed alongside stories; a past-event anchor and the
former 16-word limit are no longer mandatory for every question.

A small inline hint appears only on broader reconstruction/conversation prompts.
Help me shape my response and its separately hidden example remain available.
Questions are text-only. No playback, replacement, or random selection remains.
The public entry is daily practice; free sharing remains supported by the
existing API and retained sessions but is no longer a homepage choice.

## Schedule decision

The simplest account-free MVP uses one shared UTC calendar, starting October 7,
2026 at 00:00 UTC. Each new date advances one question; each seven-day period
advances the theme. After 28 days the four themes repeat. Adding a theme at the
end of the schedule extends the cycle; schedule edits should be made before the
next cycle because changing its length changes the modulo calculation.

Missed days do not delay the calendar or create catch-up work. There is no
streak, account, response quota per calendar day, or saved personal progression.
The server owns date selection. A session snapshots its question, guide,
coaching context, theme, date, and day when created. It does not change at midnight.
A page left open across midnight may show yesterday's preview until refreshed;
starting a session always uses the server's current date and displays that question
before recording begins. Dates before launch use the first question.

## Runtime and compatibility

Creation accepts `{ mode: "daily_question" }` (or the retained `free_share` API).
It rejects `random_question` and all client-supplied question, date, and theme
fields. The existing schema-7 `random_question` storage/feedback discriminator
now represents question-based feedback only; it does not invoke random selection.
This deliberately avoids a database migration and preserves retained sessions,
PDFs, grounded feedback validation, and provider schemas. New daily sessions add
an optional validated `daily` snapshot. Pre-existing sessions without it remain
readable. Replacement returns 409 and the retired speech endpoint returns 410
without a provider call. Versions 3–6 and their compatibility routes remain intact.

One English response of up to 60 seconds, local audio review, transcript preview,
re-recording, signed preview proof, idempotent submission, ownership checks,
atomic state transitions, moderation, evidence validation, seven-day retention,
and on-demand PDF downloads retain their existing contracts. No learner audio,
preview transcript, or generated PDF is persisted. Feedback addresses the actual
response and task, without demanding a story for a habit or explanation prompt.

## Editorial source and maintenance

`lib/story-practice/weekly-themes.json` is the source for the new weekly content.
It stores four themes with seven fixed authored questions each, stable IDs and
versions, internal speaking patterns, optional hints, individual response guides,
examples, and private coaching guidance. No model creates questions at runtime.
`lib/story-practice/weekly.ts` validates content and selects a single record.
Only public daily context and its question/guide reach the client; theme summaries
are rendered on the server. Keep IDs stable and increment a question version when
its wording or coaching contract changes. Existing sessions use their snapshot.
The former 15-record catalog remains historical, not a selection source.

## Editorial review — October 7, 2026

Seven question wordings were revised with founder authorization to improve
clarity and variety. Related guides and examples were aligned. Inline hints
now help recall a situation or set a low-pressure boundary rather than repeat
the expanded response guide. Examples include unresolved choices and attempts
that do not work out. Guidance does not assume a resolved misunderstanding or
curiosity as the reason to try something. Changed records increment their
versions; existing sessions keep their original snapshots.

## Starting question set

### The Way You Do Things

| Day | Pattern | Question |
| --- | --- | --- |
| 1 | describe | When you need to focus, what do you usually do to get started? |
| 2 | recall | Think about the last time you had too much to do. How did you decide what to do first? |
| 3 | explain | What is one everyday thing you do your own way, and why? |
| 4 | conversation | Tell me about a time someone suggested a different way to do something. |
| 5 | reconstruct | Think about the last time you looked for something you couldn’t find. What did you do? |
| 6 | react | Think about a recent change to your routine. How did you react? |
| 7 | reflect | What is one everyday habit you have changed over the years? |

### Decisions & Why You Make Them

| Day | Pattern | Question |
| --- | --- | --- |
| 1 | recall | Tell me about a small decision you made recently that made your day easier. |
| 2 | explain | When someone invites you somewhere, what helps you decide whether to go? |
| 3 | conversation | Tell me about a decision you talked through with someone before making it. |
| 4 | react | Tell me about a time you heard something that made you rethink a decision. |
| 5 | describe | When someone suggests doing something you haven’t tried before, how do you decide whether to give it a go? |
| 6 | reflect | When was the last time you changed your mind about something? |
| 7 | reconstruct | Walk me through a recent decision that took longer than you expected. |

### Conversations & People

| Day | Pattern | Question |
| --- | --- | --- |
| 1 | conversation | Tell me about a recent conversation that lasted longer than you expected. |
| 2 | describe | What do you usually do when you do not understand what someone means? |
| 3 | reconstruct | Think about a time you misunderstood someone. How did the conversation unfold? |
| 4 | explain | When you need someone’s help, how do you usually start the conversation? |
| 5 | recall | Tell me about a time you explained a choice that someone did not understand. |
| 6 | reflect | Think about a recent conversation. Is there anything you would explain differently now? |
| 7 | react | Tell me about a time someone said something that surprised you. |

### Things That Happened

| Day | Pattern | Question |
| --- | --- | --- |
| 1 | reconstruct | Tell me about an ordinary day when something unexpected happened. |
| 2 | react | Tell me about something that made you laugh recently. |
| 3 | conversation | Tell me about a time you shared unexpected news with someone. |
| 4 | recall | Tell me about a recent plan that turned out differently from what you expected. |
| 5 | describe | When something small goes wrong during your day, what do you usually do first? |
| 6 | reflect | Tell me about a small mistake that changed how you do something now. |
| 7 | explain | Think about something you tried for the first time recently. Why did you try it? |

