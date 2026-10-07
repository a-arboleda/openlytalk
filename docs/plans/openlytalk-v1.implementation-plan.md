# OpenlyTalk Story-First Beta Implementation Plan

> **Latest founder direction — takes precedence:** Follow [daily personal
> reflection](../daily-self-discovery-practice.md). The public product now has one category,
> **Getting to Know Yourself**, with one question a day. It supersedes weekly
> themes, day-of-seven UI, and fixed speaking-pattern quotas below. The current
> source is `lib/story-practice/daily-questions.json`. Feedback supports English
> expression without interpreting the learner’s personality or self-knowledge.


> **October 7, 2026 update:** [Weekly speaking practice](../weekly-speaking-practice.md) supersedes
> the earlier entry/selection rules below: new public practice uses a shared
> daily question within a seven-day theme, with text-only questions and no
> replacement. The old catalog and random-question sections below are historical.
> Recording, privacy, feedback, PDF, and retained-session protections still apply.


> **Status**: Active migration plan  
> **Version**: 2.2  
> **Updated**: 2026-09-02

## Objective

Ship the smallest useful loop for **Communicate more intentionally in
English**:

> choose free sharing or a random approved question → speak once → review the
> transcript → receive one evidence-based communication adjustment.

New sessions target schema version 7. The current schema-version-6 generated
simulation is legacy until this migration is complete. Versions 3–6 remain
readable during the seven-day anonymous retention window. The documented but
unlaunched family-based version-7 design is superseded and needs no
compatibility path.

## Implementation checkpoint — 2026-09-25

The public `/practice` buttons now create version-7 sessions through
`/api/story-practices`; `/practice/story/[id]` handles both modes. An additive
`story_practices` table keeps this state separate from retained versions 3–6.
The 15 complete approved catalog records are validated at startup and tested
against their exact canonical wording and metadata. The recorder remains shared.

Implemented: mode validation, server catalog selection, two briefing-only
replacements, reviewed guidance, request-scoped transcript preview, signed
preview binding, one-response reservation and atomic commit, mode-specific
feedback, transcript review, anonymous ownership, expiry checks and deletion.
The local database migration and existing compatibility tests pass. Synthetic
live checks cover transcription, feedback and duplicate replay for both modes.

Remaining release checks: fix the configured ElevenLabs credential (the provider
returns `invalid_api_key`), manually exercise a real microphone across target
browsers, evaluate feedback quality with diverse learner responses, and connect
scheduled production retention cleanup before deployment. These are release
checks, not evidence that all original migration checklist items are complete.

## Confirmed product decisions

- [x] Keep **Communicate more intentionally in English** as the promise.
- [x] Offer two entry modes: free sharing and random question.
- [x] Remove learner-visible categories and families.
- [x] Use one flat, team-approved question catalog.
- [x] Focus questions on real stories rather than abstract opinions.
- [x] Give each question a natural time anchor.
- [x] Prohibit runtime AI generation or rewriting of visible questions.
- [x] Approve the first 15 exact story-question wordings.
- [x] Keep one spoken response and grounded text feedback.
- [x] Prevent response-level observations from becoming personality labels.
- [x] Make concision the only feedback in free sharing.
- [x] Include a transcript-grounded concision section in random-question
  feedback.
- [x] Keep Sofia deferred and separate from coaching.

## Phase 1 — Complete the launch catalog

- [x] Assign stable IDs to the 15 approved wordings.
- [x] Complete and approve private metadata for `STORY-001` through `STORY-015`.
- [x] Review the six controlled story techniques as editorial contracts.
- [ ] Implement and verify the six controlled story techniques as runtime
  contracts.
- [x] Review each complete record for B1-B2 language, time anchor, assumptions,
  emotional pressure, and answer diversity.
- [x] Mark records `approved` only after their private metadata is complete.
- [ ] Define the minimum number of complete records required for launch.

Exit gate: the flat catalog passes deterministic validation and contains enough
complete approved records for useful random variation.

## Phase 2 — Introduce story-first schema version 7

- [ ] Add `free_share` and `random_question` to shared and server validation.
- [ ] Reject client-supplied family, topic, question, skill, technique, rubric,
  and metadata fields.
- [ ] Add the flat versioned story-question record and startup validator.
- [ ] Add random server-side selection using a fresh variation seed and bounded
  recent-question avoidance.
- [ ] Persist entry mode and nullable question reference/private metadata.
- [ ] Enforce response limit one and version-specific database constraints.
- [ ] Keep versions 3–6 parseable and renderable during retention.
- [ ] Return a retryable availability error when no approved question exists.
- [ ] Ensure free sharing never calls a question-generation model.

Exit gate: both modes create valid version-7 sessions; only random-question mode
selects a catalog record, and neither mode generates visible text with AI.

## Phase 3 — Replace homepage and briefing UI

- [ ] Replace the focus/topic or family setup with the two entry modes.
- [ ] Review the exact learner-facing labels for both choices.
- [ ] Keep the first screen compact, accessible, and mobile friendly.
- [ ] Give free sharing one static invitation and one **Respond aloud** action.
- [ ] Show random catalog text unchanged under **Practice question**.
- [ ] Preserve manual one-time **Play question** for random-question mode.
- [ ] Keep up to two random-question replacements from the flat catalog.
- [ ] Render reviewed guidance and the separately hidden example without a
  provider request.
- [ ] Hide playback, replacement, and question guidance in free-sharing mode.
- [ ] Keep **End practice** available.

Exit gate: a learner can begin either path without choosing a category or
exposing private metadata.

## Phase 4 — Preserve the one-response loop

- [ ] Keep English push-to-talk and the 60-second recording boundary.
- [ ] Keep transcript preview request-scoped and show local audio before submit.
- [ ] Revalidate audio on final submit and accept exactly one response.
- [ ] Preserve ownership, idempotency, monotonic sequence, reservation, and
  atomic commit behavior.
- [ ] For random questions, send the exact question, private metadata, and
  transcript to feedback generation.
- [ ] For free sharing, send only the mode and transcript to a dedicated
  concision-only provider; invent no question, topic classification, coaching
  lens, or general communication focus.
- [ ] Generate no partner turn or feedback speech.
- [ ] Let the learner reopen the transcript and optional question.

Exit gate: invalid audio, preview, re-recording, duplicate requests, and
provider failures consume nothing; one successful submission completes either
mode.

## Phase 5 — Align feedback and evaluation

- [ ] For free sharing, return only **Keep it concise** with one grounded
  observation, a nullable next step, and a nullable shorter example.
- [ ] Reject every general-coaching, question-specific, and English-polish field
  from free-sharing feedback.
- [ ] For random questions, keep communication feedback before English polish.
- [ ] For random questions, require one supported strength when evidence
  exists, one improvement, one meaning-preserving example, zero to two polish
  items, one real-life action, and **Keep it concise**.
- [ ] Identify either a focus-preserving choice or one specific repetition,
  detour, or unnecessary detail to reduce.
- [ ] Make concise examples preserve necessary context and learner meaning.
- [ ] For random questions, evaluate story clarity, sequence, relevant detail,
  and expressed reactions only when transcript evidence supports them.
- [ ] Prohibit converting response-level choices into personality claims.
- [ ] Reject hidden-motive, diagnosis, unstated-feeling, unstated-value, and true
  identity inferences.
- [ ] Add fixtures for short, detailed, unclear, sensitive, humorous, and
  non-narrative responses.
- [ ] Add fixtures for repetitive, off-topic, appropriately concise, and
  too-short-to-understand responses.
- [ ] Add fixtures proving each approved question supports materially different
  answers.

Exit gate: all evidence references resolve to the single learner message and
feedback preserves the learner's meaning.

## Verification gates

- [ ] Catalog validation covers exact wording, status, unique IDs, versions,
  time anchors, word count, coaching lens, technique, and guide.
- [ ] API tests cover both modes and reject deprecated setup fields.
- [ ] Selection and replacement never call a question model.
- [ ] Free sharing persists no question or preselected coaching metadata.
- [ ] Free-sharing feedback validates as concision-only; random-question
  feedback validates all seven sections.
- [ ] One-response, preview, idempotency, failure, and privacy tests pass.
- [ ] Versions 3–6 continue to render for retained sessions.
- [ ] Typecheck, lint, unit tests, production build, and database tests pass.
- [ ] Manual browser testing covers both modes, random replacement, playback,
  recording, preview, submission, feedback, response review, mobile, keyboard,
  and reduced motion.
- [ ] Public responses expose no hidden metadata, prompts, provider output,
  credentials, or secrets.
- [ ] No learner recording, generated speech, or preview transcript persists.

## Migration and removal boundary

Do not delete retained Sofia data or version-3–6 parsing and rendering while an
eligible anonymous session may still exist. After the seven-day window:

1. Confirm production records have expired or migrated.
2. Remove unreachable legacy new-session UI and generation paths separately.
3. Retain only compatibility code still justified by live data.

The superseded family catalog was a pre-launch design. Do not implement,
archive, or transfer its entries unless the cofounder reviews a wording again
for the flat story catalog.

## Deferred questions

Revisit after measuring completion, repeat use, and per-session cost:

- Whether learners prefer free sharing or random questions.
- Whether more than two replacements improve completion.
- Whether a second response improves outcomes.
- Whether accounts, saved feedback, plans, or subscriptions improve retention.
- Whether Sofia should return as optional conversation practice.
