# OpenlyTalk Story-First Coaching Engine

> **Latest founder direction — takes precedence:** Follow [daily personal
> reflection](daily-self-discovery-practice.md). The public product now has one category,
> **Getting to Know Yourself**, with one question a day. It supersedes weekly
> themes, day-of-seven UI, and fixed speaking-pattern quotas below. The current
> source is `lib/story-practice/daily-questions.json`. Feedback supports English
> expression without interpreting the learner’s personality or self-knowledge.


> **October 7, 2026 update:** [Weekly speaking practice](weekly-speaking-practice.md) supersedes
> the earlier entry/selection rules below: new public practice uses a shared
> daily question within a seven-day theme, with text-only questions and no
> replacement. The old catalog and random-question sections below are historical.
> Recording, privacy, feedback, PDF, and retained-session protections still apply.


> **Status**: Canonical target runtime contract  
> **Version**: 2.2  
> **Confirmed**: 2026-09-02

## Purpose

This document defines new schema-version-7 practices. Versions 3–6 remain
retained compatibility modes during the seven-day anonymous retention window.

The engine supports two entry modes:

- `free_share`: accept one learner-chosen spoken response without a question.
- `random_question`: select one approved story question from a flat catalog.

Both modes produce one grounded text-feedback result. Free sharing receives
only concision feedback; random-question mode receives the full reviewed
coaching result. The engine never asks a model to create a learner-visible
question, run an AI dialogue, infer a personality, or generate feedback speech.

## Public creation input

```ts
type CreateStoryPracticeRequest =
  | { mode: "free_share" }
  | { mode: "random_question" };
```

Reject unknown keys and unknown mode values. The client never submits a
question ID, topic, family, communication skill, technique, rubric, or feedback
field.

## Approved question contract

Questions live in a versioned server-owned flat catalog:

```ts
type TechniqueId =
  | "scene_event_response"
  | "expectation_change_outcome"
  | "first_attempt_outcome"
  | "choice_reason_outcome"
  | "lesson_origin_application"
  | "view_change_reason";

type StoryPracticeQuestion = {
  id: string;
  text: string;
  coachingLens:
    | "explaining_clearly"
    | "responding_naturally"
    | "expressing_yourself"
    | "speaking_assertively";
  techniqueId: TechniqueId;
  responseGuide: {
    steps: [string, string, string?];
    example: string;
  };
  feedbackGuidance: {
    observe: [string, ...string[]];
    avoid: [string, ...string[]];
  };
  status: "draft" | "wording_approved" | "approved" | "retired";
  version: number;
};
```

Only complete `approved` records can be selected. Draft and
`wording_approved` records are never selectable. Retired records resolve only
for retained sessions already referencing their exact ID and version.

The complete catalog is validated at build or startup. Invalid, duplicate,
unapproved, unknown-technique, invalid-guide, or overlength records cannot
enter the selectable index. Learner-visible wording must match
`docs/simple-practice-question-catalog.md` exactly.

## Internal session setup

A random-question session persists the selected question reference and its
private reviewed coaching metadata. Selection uses a fresh server-generated
variation seed, excludes bounded recent question IDs for the anonymous owner,
and makes no model request.

A free-sharing session persists no question reference or preselected coaching
metadata. Its public view uses a fixed interface invitation, not an invented
practice question. No topic, coaching lens, or general communication focus is
selected before or after submission.

The learner never sees a coaching lens, target behavior, technique, rubric,
classification, prompt, or provider output.

## State

New sessions use:

```ts
schemaVersion = 7
responseLimit = 1
entryMode = "free_share" | "random_question"
status = "active" | "completed" | "ended"
phase =
  | "briefing"
  | "initial_simulation" // retained internal name for the response stage
  | "finalizing"
  | "final_takeaway"

questionReference: { id: string; version: number } | null
privateCoachingMetadata: ReviewedCoachingMetadata | null
replacementCount: number
```

For free sharing, `questionReference` and `privateCoachingMetadata` are
`null`, and `replacementCount` remains zero. Raw learner audio, generated
speech, and transcript previews are never persisted.

## Mode-specific briefing

### Free sharing

Show a short fixed invitation to speak about anything the learner wants to
share. Do not show question playback, question replacement, or a
question-specific response guide. Starting the response makes no provider call.

### Random question

Show the exact catalog wording under **Practice question**. Offer:

- Manual **Play question** once per exact question in the current tab.
- Up to two **Try another question** replacements before answering.
- Reviewed **Help me shape my response** steps.
- A separately hidden reviewed example.

These actions consume no response. Selection, replacement, and guidance make no
model request. Question audio is request-scoped and never persisted.

## Lifecycle

### 1. Create

1. Validate the entry mode.
2. For `free_share`, persist an active briefing with no question or coaching
   metadata.
3. For `random_question`, validate the catalog, obtain a bounded recent-ID
   avoidance list, select one complete approved record, and persist its exact
   question reference and private metadata.
4. Persist response count zero and replacement count zero.

Creation fails without persistence when random-question mode has no selectable
question.

### 2. Replace question

Replacement exists only for a random-question briefing. Authenticate the
anonymous owner, require a fresh expected timestamp, enforce the two-replacement
limit, and select another approved record excluding current and bounded recent
IDs. An idempotent duplicate returns the committed result.

### 3. Start responding

Move to `initial_simulation`. Learner-facing UI calls this **Practice** or
**Respond aloud**, never Simulation. Starting consumes nothing and makes no
speech or model request.

### 4. Transcript preview

The preview operation:

1. Verifies anonymous ownership and a state that accepts a response.
2. Validates request-scoped audio.
3. Transcribes with an English hint.
4. Returns normalized read-only transcript text without persistence.

Recording automatically stops at 60 seconds and retains the captured audio in
the tab for review. Server validation allows one second of timer/encoder
overshoot. A failed preview preserves local audio and offers transcript retry;
submission waits for transcript review. Re-recording discards the local
recording. A failed preview consumes nothing.

### 5. Submit response

Reserve `(practiceSessionId, idempotencyKey, expectedLearnerSequence)` before
provider work. Revalidate audio, use the reviewed normalized transcript when
supplied, and otherwise transcribe. Create one learner message, increment the
accepted response count to one, and move to `finalizing`.

For random-question mode, the full-feedback provider receives the exact
approved question, private coaching metadata, and transcript. For free sharing,
a dedicated concision-only provider receives only the entry mode and transcript;
it receives no invented question, topic classification, coaching lens, guide,
or question metadata.

Runtime-validate provider output and require every evidence reference to
resolve to the learner message. Atomically commit the learner message,
completed state, feedback, and receipt. Generate no partner turn or speech.

A committed duplicate returns the same receipt. Reject in-progress, stale,
wrong-owner, exhausted, and second-response requests before accepting another
response. Release the reservation after provider failure.

### 6. Feedback and review

The completed phase is `final_takeaway`. Free sharing shows one **Keep it
concise** section. Random-question mode shows the seven feedback sections.
Both offer **View response**. Response review always shows the submitted
transcript and shows the exact question only for random-question mode.

### 7. Download a practice PDF

`GET /api/story-practices/[id]/pdf` authenticates the anonymous owner and checks
session expiry through the existing repository before rendering. Only completed
sessions can export. Return a private, non-cacheable PDF attachment containing
the submitted transcript, the optional public question, and the exact displayed
feedback sections. Exclude private coaching metadata, internal evidence IDs,
audio, and preview transcripts. Generate in memory with no provider request or
persisted PDF. A failed download leaves the completed session available to retry.

## Transcript safety check

Before feedback generation, the server checks the temporary normalized transcript
with the moderation provider and lightweight email/phone detection. It blocks
harassment, hate, explicit sexual content, self-harm, violence, illicit
instructions, and direct contact details. Ordinary sensitive stories remain
eligible for grounded feedback. A blocked transcript is never persisted, never
sent to the feedback provider, and does not consume the response; the recording
remains local so the learner can record another response. An isolated swear word
is not an automatic block without abusive or explicit context.

## Feedback validation

The schema-version-7 output is a discriminated union:

```ts
type StoryPracticeFeedback =
  | {
      entryMode: "free_share";
      kind: "full" | "partial";
      concision: {
        observation: EvidenceObservation;
        nextStep: string | null;
        conciseExample: MeaningPreservingExample | null;
      };
    }
  | {
      entryMode: "random_question";
      kind: "full" | "partial";
      whatYouPracticed: string;
      whatWorked: EvidenceObservation | null;
      oneImprovement: EvidenceObservation;
      concision: {
        observation: EvidenceObservation;
        nextStep: string | null;
      };
      naturalExample: MeaningPreservingExample;
      englishPolish: EnglishPolishItem[]; // 0..2
      tryItInRealLife: string;
    };
```

Feedback:

- Always evaluates concision. It identifies either a
  focus-preserving choice or one evidenced repetition, detour, or unnecessary
  detail to reduce.
- Uses `concision.nextStep = null` when the response is already appropriately
  concise. In free sharing, `concision.conciseExample` is also `null` in that
  case. It never recommends removing context required for understanding.
- Rejects non-concision fields in free-sharing output. Free sharing does not
  produce `whatYouPracticed`, `whatWorked`, `oneImprovement`, `naturalExample`,
  `englishPolish`, or `tryItInRealLife`.
- In random-question mode, recognizes a concrete success only when supported
  and selects one high-value communication adjustment.
- Preserves the learner's meaning and voice.
- Uses a free-sharing `conciseExample` or random-question `naturalExample` to
  model a shorter response when trimming is recommended, without changing the
  learner's meaning.
- Keeps random-question English polish secondary and limited to zero to two
  items.
- Describes observable choices in this response rather than personality traits.
- Does not mention a partner reply, retry, before-and-after improvement, or
  multiple attempts.
- Does not infer hidden motives, mental state, diagnosis, unstated values,
  unstated feelings, or true identity.

## Privacy and security

- Entry mode, optional question reference, transcript, state, and feedback
  expire within seven days.
- Learner audio, generated question speech, and preview transcripts are
  request-scoped and never persisted.
- Never log full audio, transcript, question text, feedback, private metadata,
  or provider output.
- Protect ownership, idempotency, ordering, duplicate submission, reservations,
  and stale writes server-side.
- Public responses expose only the mode, optional visible question and guide,
  response state, transcript after submission, and feedback.

## Failures

| Failure | State effect | Learner result |
|---|---|---|
| Invalid mode or unknown field | Create nothing | Correct the request |
| No selectable question | Create nothing | Retryable practice-unavailable error |
| Invalid catalog metadata | Create nothing | Retryable practice-unavailable error |
| Replacement conflict or exhaustion | No partial update | Keep or refresh the question |
| Replacement requested in free sharing | No state change | Action unavailable |
| Microphone denied | No reservation | Explain permission recovery |
| Invalid or unclear audio | No accepted response | Re-record; consume nothing |
| Preview transcription failure | No state change | Retry or re-record |
| Duplicate submit | No duplicate count | Return committed receipt |
| Feedback failure | Release reservation | Keep recording safe to retry |
| Second response attempt | Reject before provider work | Practice already complete |
| Database outage | No claimed success | Retryable availability error |

## Required tests

- Both public mode values validate; unknown keys and values are rejected.
- Public creation rejects question IDs, families, topics, skills, and metadata.
- Free sharing persists no question or preselected coaching metadata.
- Free sharing offers no question playback, replacement, or question guide.
- Free-sharing feedback contains only the concision object and rejects every
  general-coaching, question-specific, and English-polish field.
- Every selectable question is complete, approved, unique, correctly versioned,
  16 words or fewer, time-anchored, and mapped to valid private metadata.
- Selection and replacement make no question-generation model call.
- Repeated selection excludes current and bounded recent question IDs.
- Replacement is random-question-only, briefing-only, capped at two, and
  idempotent.
- Question playback is manual, once per exact question, and consumes nothing.
- Schema version 7 requires response limit one.
- Preview consumes no response and persists no audio or transcript.
- One submission completes with no partner generation or speech URL.
- Evidence references resolve to the single learner message.
- Feedback never converts response-level observations into personality labels.
- Every feedback result contains a transcript-grounded concision observation;
  shortness alone is never treated as sufficient communication quality.
- Random-question feedback contains all seven sections and uses only its exact
  approved question and private reviewed metadata.
- Duplicate, invalid, stale, wrong-owner, and second submissions consume no
  additional allowance.
- Versions 3–6 continue to parse and render during retention.
