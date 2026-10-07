# OpenlyTalk repository guidance

> **Latest founder direction — takes precedence:** Follow [daily personal
> reflection](docs/daily-self-discovery-practice.md). The public product now has one category,
> **Getting to Know Yourself**, with one question a day. It supersedes weekly
> themes, day-of-seven UI, and fixed speaking-pattern quotas below. The current
> source is `lib/story-practice/daily-questions.json`. Feedback supports English
> expression without interpreting the learner’s personality or self-knowledge.


## October 7, 2026 founder update — takes precedence

The public entry now offers one fixed daily question within a weekly theme.
Follow `docs/weekly-speaking-practice.md` for schedule, content, UI, and runtime
contracts. It supersedes the random-question, question-audio, replacement,
flat-catalog-only, and no-weekly-theme rules below. Keep response recording,
feedback, privacy, PDF, and retained-session protections. The new editorial
source is `lib/story-practice/weekly-themes.json`; previous catalog rules remain
historical. Schema-7 question-based feedback keeps its existing discriminator
for storage compatibility but never selects randomly.


## Product identity

OpenlyTalk is a speaking-practice product for B1-B2 English speakers at
**openlytalk.com**. Its promise is **Communicate more intentionally in English**.

The September 29, 2026 founder decision supersedes the former Learn + Practice
scope. Offer only speaking practice, with no public article library or standalone
exercises. The homepage starts practice directly. Former Learn URLs redirect to
Practice; editorial source files are historical material.

Practice offers free sharing or one random approved question, one spoken response,
and grounded feedback. Completed sessions offer a PDF of the submitted transcript,
optional question, and the recommendations already shown on screen. Generate it
on demand for the anonymous owner, without persisting audio or the PDF.

Use `.agents/skills/openlytalk/SKILL.md` for Practice work, with this newer
practice-only direction taking precedence over its former Learn scope.

## Canonical sources

- `docs/openlytalk-platform-definition.md` defines the platform purpose,
  audience, method, boundaries, and relationship between Learn and Practice.
- `docs/content-architecture.md` preserves the historical editorial design;
  its publishing scope is superseded by the practice-only platform definition.
- `docs/product-definition.md` defines the Practice learner journey and beta
  boundary.
- `docs/conversation-engine.md` defines schema-version-7 Practice runtime
  behavior.
- `docs/simple-practice-question-catalog.md` is the sole editorial source for
  learner-visible questions.
- `docs/intentional-communication-framework.md` defines the rationale.
- `docs/plans/openlytalk-v1.implementation-plan.md` defines Practice migration
  order.
- `docs/character-bible.md` preserves Sofia for a future optional mode.

The platform definition is the strategic umbrella. Existing Practice documents
remain canonical for that module until a deliberate migration changes them.
Treat conflicting implementation as legacy until migration is complete. Never
change canonical documents to justify old code.

## Platform rules

- Keep the public product focused on speaking practice.
- Write learner-facing copy in accessible English for B1-B2 speakers.
- Do not manufacture founder experience, testimonials, or research claims.
- Describe observable communication choices without inferring stable traits.
- Do not confuse concision with shortness or remove context needed for meaning.
- PDF downloads reproduce the submitted transcript and existing feedback;
  they do not generate a second evaluation or expose internal metadata.

## Non-negotiable Practice beta rules

- Inside Practice, offer only `free_share` and `random_question`; do not add
  categories, editorial pillars, families, lesson selection, custom situations,
  or learner-selected coaching classifications.
- Keep one spoken response and one focused text-feedback result.
- A free-sharing session has no invented question or preselected topic.
- Free-sharing feedback contains only a transcript-grounded concision result;
  do not add a coaching lens, guide, general improvement, English polish, or
  real-life action.
- Random questions come only from the flat approved catalog. AI never creates,
  rewrites, translates, repairs, or extends learner-visible wording.
- Every story question uses one central invitation and a natural time anchor.
- Allow at most two random-question replacements before answering. Replacement
  selects another approved record and consumes no response or model request.
- The coach appears as **Your coach**, has no biography, and never pretends to
  be a human friend. Sofia is deferred and is neither coach nor evaluator.
- Put communication feedback before English polish.
- Ground observations in actual learner language and describe choices in this
  response. Never infer a stable personality, hidden motive, diagnosis, value,
  feeling, or true identity.
- Never use overall numeric communication, confidence, fluency, grammar,
  pronunciation, or accent scores.
- English-only push-to-talk accepts exactly one response per new session.
  Invalid recordings, previews, re-recordings, duplicates, and failures consume
  nothing.
- Keep the 60-second recording boundary.
- Never persist learner audio, generated speech, or preview transcripts.
- New sessions target schema version 7. Keep versions 3–6 readable during their
  seven-day anonymous retention window.
- Do not delete retained Sofia data or compatibility routes before their
  migration and retention gates are explicitly satisfied.

## Approved Practice-question direction

Questions invite a real story about a moment, memory, person, decision, change,
first experience, or recent event. Prefer concrete recall over abstract opinion.

Use familiar B1-B2 language, normally 6–14 words and never more than 16. A time
anchor such as **recently**, **the last time**, **in the past six months**,
**when you were younger**, or **from childhood** should help retrieve one scene
without forcing an experience.

Avoid unrelated stacked questions, false choices, specialist knowledge,
advice-seeking, diagnosis, therapy framing, intimate pressure, and assumptions
about work, study, travel, driving, money, family structure, or a positive
childhood.

## Required Practice session flow

### Free sharing

1. Show a short static invitation to share anything.
2. Record one response and review local audio and transcript.
3. Submit once and receive concision-only text feedback.
4. Reopen the submitted transcript.

Do not show question playback, replacement, or question-specific guidance.

### Random question

1. Select one complete approved flat-catalog record.
2. Show it unchanged under **Practice question**.
3. Offer optional one-time **Play question**, up to two replacements, reviewed
   guidance, and a separately hidden example.
4. Record one response and review local audio and transcript.
5. Submit once and receive grounded text feedback.
6. Reopen the question and submitted transcript.

## Practice feedback

For free sharing, show only **Keep it concise**. Identify either what kept the
response focused or one evidenced repetition, detour, or unnecessary detail to
reduce. Give a next step and shorter meaning-preserving example only when
trimming would help. Do not classify the topic or derive a general coaching
focus.

For random questions, show in order:

1. What you practiced
2. What worked, only when supported
3. One improvement
4. Keep it concise
5. A meaning-preserving natural example
6. Zero to two English-polish items
7. Try it in real life

Every response receives a transcript-grounded concision observation. Do not
reward shortness alone or remove context needed for meaning. For random
questions, demonstrate useful trimming in the natural example.

It is valid to describe observable choices **in this response**. It is not
valid to label the learner funny, reserved, dramatic, direct, reflective, or
another stable type of person.

## Technical baseline

Use Next.js App Router, React, Tailwind CSS, TypeScript, PostgreSQL/Neon, and
server-side provider calls under `app/api/`. Separate catalog validation,
selection, editorial content, session orchestration, transcription, feedback,
persistence, and UI.

Treat public input and model output as untrusted. Use runtime validation,
anonymous ownership, idempotent submission, strict ordering, stale-write
protection, atomic updates, and at most seven-day retention. Never expose
prompts, private metadata, provider output, credentials, or secrets.

Keep accounts, billing, saved progress, cross-session memory, weekly plans,
camera analysis, realtime full-duplex speech, multi-turn practice, and Sofia
mode out of the initial platform release unless later product evidence and an
explicit scope decision bring them in.
