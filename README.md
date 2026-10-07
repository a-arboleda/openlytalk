# OpenlyTalk

OpenlyTalk is an AI communication coach for B1-B2 English learners with one
promise: **Communicate more intentionally in English.**

Practice offers one personal question a day in **Getting to Know Yourself**.
The 28-question collection invites learners to explore and express their own
thoughts in English. The shared calendar starts October 7, 2026, changes at
midnight UTC, and repeats after 28 days. Only today's question is revealed.

Learners record one response, review local audio and transcript, and receive
grounded communication feedback. The coach helps expression without interpreting
personality or judging self-awareness. See [daily personal reflection](docs/daily-self-discovery-practice.md)
for the current product, content, and scheduling contract.

## Product status

The public Practice entry uses the story-first schema-version-7 flow.
Versions 3–6 remain readable through the retained compatibility routes during
the anonymous retention window.

Sofia's Character Bible is preserved for a future optional **Practice with
Sofia** mode. Sofia is not the beta coach.

## Canonical documents

- `docs/product-definition.md` defines the product and beta boundaries.
- `docs/conversation-engine.md` defines session behavior and state.
- `docs/simple-practice-question-catalog.md` is the sole source for visible
  questions.
- `docs/intentional-communication-framework.md` defines the rationale.
- `docs/plans/openlytalk-v1.implementation-plan.md` defines migration order.
- `docs/character-bible.md` preserves Sofia for the deferred optional mode.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Provider setup

The legacy implementation still uses server-side OpenAI calls for prompt
generation. Version 7 uses AI only for transcription and feedback, never to
create learner-visible questions. Free sharing does not invent a question.

Keep API keys server-only and never expose them through `NEXT_PUBLIC_`
variables. See `.env.example` for the active OpenAI, ElevenLabs, and database
configuration.

## Database setup

OpenlyTalk uses PostgreSQL through Neon and Drizzle. Put the pooled development
connection in `DATABASE_URL` and the direct migration connection in
`DATABASE_MIGRATION_URL` inside `.env.local`.

```bash
npm run db:check
npm run db:migrate
```

After a schema change:

```bash
npm run db:generate
```

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

With a connected Neon development branch:

```bash
npm run test:db
```

## Story-first Practice (schema version 7)

The daily practice button at `/` or `/practice` creates an anonymous session
through `/api/story-practices` with `mode: "daily_question"`.
`/practice/story/[id]` renders the snapshotted category, question, optional
guidance, recording, transcript review, and one text-feedback result.
`/practice/new` redirects to the current entry. Existing `/practice/[id]` and
legacy APIs still read retained version-3–6 sessions.

The additive `story_practices` table stores validated version-7 state separately
from legacy simulations. Apply migrations before using the new entry. State
updates use timestamp comparisons and submission leases to fence concurrent
workers. Failed requests release their lease; duplicate committed requests
return the same result. Preview transcripts are signed and bound to the owner,
session and recording without storing their contents. Audio stays request-scoped.

`lib/story-practice/daily-questions.json` contains the 28 questions with
individual guides, examples, and private coaching metadata. The server selects
one record by date; future questions never reach the client. Former catalogs
remain historical. Schema-7 storage and feedback stay compatible, and both old
weekly and new category snapshots remain readable. No database migration is
required. OpenAI never generates or changes the daily question.

OpenAI transcription and the configured reflection model power the response
loop. Questions are text-only; no question speech provider is required.
Model replies use Structured Outputs and
additional evidence validation; see the [official Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs).

New sessions expire after five days, leaving headroom for the daily retention
cleanup before the public seven-day maximum. Existing expiry timestamps remain
unchanged. `vercel.json` schedules authenticated `GET /api/cron/retention` daily;
it deletes expired current and retained sessions, dependent records, unreferenced
expired anonymous owners, and expired abuse counters. Local setup does not run
Vercel cron. See [the deployment checklist](docs/vercel-launch.md) for activation,
secrets, monitoring, and the initial retained-session cleanup gate.

Audio is limited to 4,000,000 bytes; the whole multipart request is bounded at
4,200,000 bytes, below Vercel's 4.5 MB ceiling. Browsers request 64 kbps audio and
still enforce the 60-second duration limit. A shared PostgreSQL request limiter
protects all practice POSTs and retained speech GETs before provider calls.
Configure `RATE_LIMIT_SECRET`; missing protection fails closed.

Run `npm run test:db` for database integration coverage. The opt-in synthetic
provider check is `RUN_LIVE_STORY_TESTS=1 npx vitest run tests/story-practice/live-feedback.test.ts`;
it uses the configured API account.
