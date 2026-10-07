---
name: openlytalk
description: Define, create, implement, or review OpenlyTalk's learning content, editorial platform, and story-first speaking practice for B1-B2 English learners. Use for product behavior, content, exercises, questions, coaching, UX, architecture, prompts, migrations, and compatibility work.
---

# OpenlyTalk

## Platform direction

Build OpenlyTalk as a founder-led learning and practice platform around one
promise: **Communicate more intentionally in English.**

The platform has two connected areas:

- **Learn** publishes articles, examples, breakdowns, reflections, and
  exercises that help learners notice and shape communication.
- **Practice** lets a learner share anything or receive one random
  team-approved question, speak once, and receive evidence-based feedback.

Use **Notice → Shape → Speak → Reflect** as a flexible method, not a score or
mandatory interface sequence. AI may support bounded practice and editorial
work, but it does not define the point of view, publish autonomously, or replace
founder judgment.

OpenlyTalk is not a grammar course, scorecard, exam tool, open chatbot, or
therapy product. Do not infer a fixed personality, hidden motive, mental state,
diagnosis, value, feeling, or identity claim that the learner did not express.

## Read the canonical source for the task

Treat these documents as authoritative and load only those relevant to the
work:

- Platform purpose, audience, method, boundaries, and relationship between
  Learn and Practice: `docs/openlytalk-platform-definition.md`
- Editorial pillars, formats, learning-piece structure, exercises, routes,
  metadata, and publishing workflow: `docs/content-architecture.md`
- Practice scope, learner journey, UI, feedback, and privacy:
  `docs/product-definition.md`
- Practice runtime contracts, validation, lifecycle, failures, and required
  tests:
  `docs/conversation-engine.md`
- Practice-question authoring, approval, and private catalog metadata:
  `docs/simple-practice-question-catalog.md`
- Product rationale and communication model:
  `docs/intentional-communication-framework.md`
- Migration sequence and removal gates:
  `docs/plans/openlytalk-v1.implementation-plan.md`
- Retained or future Sofia work only: `docs/character-bible.md`

The platform definition is the strategic umbrella. Existing Practice documents
remain canonical for the bounded story-first module until a deliberate
migration changes them. When implementation conflicts with the canonical
schema-version-7 Practice direction, treat it as legacy and migrate it
deliberately. Never rewrite canonical product documents to justify old
behavior.

## Learn area

Create English-first content for B1-B2 comprehension within six editorial
pillars: clarity, concision, organization, storytelling, natural English, and
presence and attention. These pillars support content discovery; they are not
learner classifications or Practice setup choices.

Prefer a learning piece over a generic blog post. Teach one central idea using
a recognizable situation, concrete example, useful breakdown, small exercise,
and takeaway when appropriate. Preserve nuance, learner meaning, and authorial
voice. Do not require every piece to lead to AI practice.

For claims about posture, gaze, listening, pace, or other nonverbal behavior,
describe observable choices and situational effects. Do not universalize one
culture's norms or diagnose confidence, anxiety, attention, intent, or
personality.

AI may help brainstorm, edit, validate structure, or prepare metadata. It must
not publish autonomously, manufacture founder experience, or turn the library
into generic AI-written content. Keep approval and publishing intentional.

## Practice setup and approved questions

Inside Practice, offer only two entry modes: free sharing or a random question
from one flat catalog. Do not expose or request categories, editorial pillars,
families, topics, coaching lenses, techniques, rubrics, custom situations, step
builders, daily cards, or lessons in this flow. Free sharing has no invented
question or preselected topic.

`docs/simple-practice-question-catalog.md` is the sole editorial source for
learner-visible questions. Every selectable record must be team-approved. Never
generate, paraphrase, translate, repair, or extend its visible wording with AI
at runtime. Do not restore or reuse entries from the intentionally deleted
curated prompt catalog without fresh cofounder approval.

Questions invite a real story and use a natural time anchor to help the learner
recall one concrete experience. For exact wording, length, safety, metadata,
status, and review rules, follow the catalog rather than duplicating them here.

Learn content may link to the general Practice entry. A content-linked practice
needs an explicit reviewed contract and approved learner-visible invitation;
never derive or change Practice questions automatically from article metadata.

## Internal coaching metadata

Each approved question maps privately to one controlled coaching lens:
`explaining_clearly`, `responding_naturally`, `expressing_yourself`, or
`speaking_assertively`, plus one controlled technique, a two- or three-step guide,
one short possible response, and feedback guidance. Keep these classifications
server-side and hidden from the learner.

Random selection and up to two briefing-only replacements choose from all
approved records, exclude the current and bounded recent IDs, and make no model
request. Draft and wording-only records are never selectable. Retired records
resolve only for sessions already referencing their exact ID and version.

## Session flow

Keep both lifecycles narrow. Free sharing uses a static invitation, one reviewed
English response, and text feedback. Random-question mode adds one approved
**Practice question** with optional playback, replacement, and reviewed guide.
Generate no partner reply or feedback speech. Keep the 60-second recording
boundary and let the learner reopen the submitted transcript and optional
question.

Question playback is manual and once per exact question in the tab. It is absent
from free sharing. Guidance, replacement, transcript preview, re-recording,
invalid audio, duplicates, and failed provider operations consume no response.

## Feedback rules

Use an unnamed **Your coach** voice: warm, calm, concise, honest, and
evidence-based. Free sharing returns only a transcript-grounded concision
result: recognize focus or identify one repetition, detour, or unnecessary
detail to reduce, with a next step and shorter meaning-preserving example only
when useful. Do not assign it a coaching lens, guide, general improvement,
English polish, real-life action, or inferred topic.

Random-question feedback uses the exact approved question and private metadata,
puts communication before zero to two optional English-polish items, and
includes the same concision check alongside the complete coaching result. In
both modes, do not reward shortness alone or remove context needed for meaning.
Ground every observation in the transcript and preserve the learner's meaning.
Do not imply a dialogue,
retry, before-and-after improvement, personality discovery, or unsupported
value, feeling, reason, or identity claim. Never use overall numeric
communication, confidence, fluency, grammar, pronunciation, or accent scores.

## Safety, privacy, compatibility, and scope

- New sessions target schema version 7 with `free_share` or
  `random_question`. Keep versions 3–6 readable for retained anonymous
  sessions within seven days, but never create them from the new homepage. Do
  not remove their routes or data before the migration removal gate.
- Never persist learner recordings, generated speech, or preview transcripts.
  Protect anonymous ownership, idempotency, ordering, duplicates, and stale
  writes with atomic server-side transitions.
- Treat all model output as untrusted and runtime-validate it.
- Never expose prompts, private metadata, provider output, credentials, or
  safety classifications.
- Sofia remains a future optional **Practice with Sofia** mode. Do not use her
  as coach or evaluator and do not delete her retained canon or data.
- Defer accounts, billing, saved progress, cross-session memory, weekly plans,
  camera analysis, realtime full-duplex speech, and multi-turn role-play.

## Implementation work

Use Next.js App Router, React, Tailwind CSS, TypeScript, PostgreSQL/Neon, and
server-side provider calls through Route Handlers under `app/api/`. Separate
editorial content, catalog validation and selection, setup validation,
orchestration, transcription, feedback generation, persistence, and UI. Use
strict runtime validation, idempotent submission, monotonic ordering, and
atomic state updates.

Store the first approved learning pieces as version-controlled MDX. Revisit a
CMS only when the publishing workflow demonstrates a need. Keep articles and
their metadata validated, but do not force prose into an inflexible template.

Inspect implementation before editing and keep affected docs, catalog, schemas,
persistence, routes, UI, prompts, tests, and evaluations aligned. Ask a focused
question only when ambiguity would materially change learner experience,
public contracts, privacy, cost, editorial authorship, or safety. Verify changes
in proportion to risk.
