# OpenlyTalk Platform Definition

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


> **Status**: Approved strategic direction
> **Version**: 2.0
> **Confirmed**: 2026-09-29

## Purpose

OpenlyTalk is a speaking-practice product for B1-B2 English speakers who want
to organize their thoughts and communicate more intentionally in English.

> **Communicate more intentionally in English.**

The founder's September 29 scope decision replaces the previous Learn + Practice
platform. The public product contains speaking practice only: no article library,
learning-piece publication, or standalone exercises. Existing editorial source
files may remain archived, but are not part of the public experience. Former
Learn URLs redirect to Practice.

## Learner journey

- Start from the homepage or `/practice`.
- Share anything or receive one team-approved random question.
- Record one English response for up to 60 seconds. Automatic stop preserves
  the recording in the tab for review.
- Review local audio and the transcript before submitting.
- Receive focused, evidence-based feedback about this response.
- Download a PDF containing the question when applicable, the submitted
  transcript, and the same recommendations displayed on screen.

The PDF is generated on demand for the session's anonymous owner. It adds no
AI request, stored server-side document, or audio persistence. Downloaded copies
are controlled by the learner and are not removed when the session expires.

## Feedback and boundaries

`docs/product-definition.md` and `docs/conversation-engine.md` remain canonical
for feedback and runtime behavior. A further change to the feedback emphasis
is awaiting clarification; do not derive new feedback requirements from an
unclear dictated request.

Feedback describes observable choices in this response, preserves meaning,
and never infers personality, hidden motives, feelings, or diagnoses. No
numeric communication, confidence, grammar, pronunciation, or accent scores.
AI supports the reviewed product direction and never authors catalog questions
at runtime.

Notice → Shape → Speak → Reflect remains an optional conceptual method, not a
mandatory interface sequence. Practice setup has only `free_share` and
`random_question`, with one submitted response and no multi-turn conversation.

## Public surface

- `/`: practice-first homepage with both starting options.
- `/practice`: dedicated practice entry.
- `/practice/story/[id]`: the existing session experience.
- `/about`: a short explanation of the practice product.

Accounts, billing, saved progress, courses, cross-session memory, camera
analysis, realtime dialogue, and Sofia mode remain deferred. Retained session
compatibility and seven-day anonymous retention rules remain in force.

## Canonical sources

- `docs/product-definition.md`: learner journey and feedback contract.
- `docs/conversation-engine.md`: runtime behavior and validation.
- `docs/simple-practice-question-catalog.md`: approved question wording.
- `docs/content-architecture.md`: historical editorial design, superseded for
  the public product by this practice-only scope decision.
