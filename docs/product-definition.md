# OpenlyTalk Product Definition

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


> **Status**: Canonical for the story-first coaching beta  
> **Version**: 2.2  
> **Confirmed**: 2026-09-02

## Product promise

OpenlyTalk is an AI communication coach for B1-B2 English learners. Its promise
is:

> **Communicate more intentionally in English.**

The beta gives learners a low-pressure way to speak about their real lives and
notice one useful choice in how they communicated their meaning. It reflects
observable language from one response; it does not infer a fixed personality,
hidden motive, mental state, diagnosis, value, feeling, or true identity.

OpenlyTalk is English-only and communication-first. It is not a grammar course,
pronunciation scorer, exam tool, open-ended chatbot, personality assessment, or
therapy product.

## Primary learner

The learner understands substantial English but has too few ordinary speaking
opportunities. They want to speak about their life and understand how they
express themselves without overthinking grammar. They need useful practice, not
inflated praise, personality labels, or exhaustive correction.

## Confirmed homepage setup

The learner chooses one of two entry modes:

1. **Free sharing** — speak about anything they want to share.
2. **Random question** — receive one approved story question selected from the
   flat catalog.

The exact learner-facing button copy remains subject to UX review. The public
selection contains only the entry mode. There are no learner-visible categories,
families, lessons, communication-focus choices, coaching techniques, rubrics,
custom-situation fields, step builders, daily cards, or Sofia entry point.

The normal mobile setup should fit within the viewport, with overflow only as
an accessibility fallback. The interface distinguishes the two choices clearly
without turning them into a catalog to browse.

## Free sharing

Free sharing provides a static invitation to speak about whatever the learner
chooses. It does not ask AI to invent a question, infer a topic before the
response, or require the learner to type an explanation.

The learner records one response and reviews local audio and the transcript
before submission. Question playback, question replacement, and question-based
response guidance are absent. Feedback is based only on the submitted
transcript and must not pretend that a question was asked.

## Random question

`docs/simple-practice-question-catalog.md` is the sole editorial source for
learner-visible questions. The server selects one complete approved record from
the flat catalog. AI never generates, rewrites, expands, translates, repairs, or
personalizes the visible wording.

Questions invite a real story and use a natural time anchor to help the learner
recall a concrete scene. Each exact wording has a stable ID and version plus
private reviewed coaching metadata.

The learner may request at most two alternatives before answering. Each
replacement selects another approved question, excludes the current and bounded
recent IDs, and consumes no response or model request.

## Question practice screen

The random-question screen shows:

- One short reminder to prioritize meaning over perfect grammar.
- The unchanged catalog text labeled **Practice question**.
- Optional one-time **Play question** audio through the configured ElevenLabs
  female voice.
- **Try another question** while a replacement remains.
- Optional reviewed **Help me shape my response** steps with a separately hidden
  example.
- One primary **Respond aloud** action.
- An always-available **End practice** action.

Playback is manual, never loops or autoplays, and is available once per exact
question in the current tab. Generated question speech is request-scoped and
never persisted. The guide is flexible support, not a correct script, and makes
no provider request.

## Spoken response

Both entry modes use the same response boundary:

- One English push-to-talk recording of at most 60 seconds.
- Automatically stop at the limit and keep the captured audio in the tab for
  review. A failed transcript preview keeps the audio available for retry.
- Local audio and a server-generated read-only transcript before submission.
- Re-recording or submission after review.
- No response consumption for preview, re-recording, invalid audio, duplicate
  requests, or failed provider operations.
- One idempotent accepted submission per session.
- No persisted learner audio.

## Feedback

One accepted response produces concise text-only feedback. There is no partner
reply, simulated dialogue, retry, feedback speech, or personality result.

### Free sharing

Free sharing produces only **Keep it concise**. The result:

- Identifies one choice that kept the response focused, or one evidenced
  repetition, detour, or unnecessary detail that could be reduced.
- Gives one concrete next step only when trimming would help.
- May show one shorter meaning-preserving version only when trimming would
  help.

It does not add a coaching lens, response guide, general communication
improvement, English polish, or real-life action. It does not classify what the
learner shared or infer a topic before generating feedback.

### Random question

Random-question feedback appears in this order:

1. What you practiced
2. What worked, only when supported
3. One improvement for next time
4. Keep it concise
5. A meaning-preserving natural example
6. English polish with zero to two high-value alternatives
7. Try it in real life

Random-question feedback may use the exact question and its private coaching
metadata. **Keep it concise** also appears in every random-question result. It
identifies either one choice that kept the response focused or one specific
repetition, detour, or unnecessary detail to reduce. When trimming would help,
the natural example demonstrates a shorter way to preserve the learner's main
meaning. Brevity alone is not success: the response still needs enough context
and detail to be understandable.

Feedback may say that the learner used humor, kept details brief, organized
events clearly, expressed a reaction directly, or made another observable
choice in this response. It must not convert that observation into a stable
claim such as saying the learner is funny, reserved, dramatic, direct, or
reflective as a person.

The learner can reopen the submitted transcript and, when applicable, the exact
question from feedback. A completed session also offers a PDF download with
the submitted transcript, optional question, and exactly the feedback shown on
screen. The PDF is generated on demand without another model call or server-side
file storage. Downloaded copies remain on the learner's device after session
expiry or deletion.

## Coach identity

Learner-facing guidance and feedback are labeled **Your coach**. The coach is
unnamed, has no biography, never pretends to be a human friend, and does not
become a fictional conversation partner. Sofia remains deferred in
`docs/character-bible.md` and is not the coach or evaluator.

## Privacy, safety, and retention

- Entry mode, optional question reference, transcript, state, and feedback
  expire within seven days.
- Learner audio, generated question speech, and preview transcripts are never
  persisted.
- Protect every operation with anonymous ownership, idempotency, ordering,
  stale-state checks, and atomic updates.
- Treat public input, transcripts, and provider output as untrusted.
- Never expose private coaching metadata, hidden rubrics, prompts, safety
  classifications, provider credentials, or secrets.
- Explicit deletion removes all retained session content.
- Safety overrides may stop processing immediately.

## Compatibility boundary

New story-first sessions target schema version 7. Versions 3–6 remain readable
during their seven-day anonymous retention window. Their former setup choices,
generated prompts, simulation behavior, captions, speech, coaching breaks,
retries, and takeaways must not be removed while an eligible retained session
can reference them.

The superseded family-based version-7 design was documented but not launched.
Do not implement or preserve family selection as a compatibility mode.

## Beta scope

In scope: free sharing, flat-catalog random questions, up to two alternatives,
optional question playback and reviewed guidance, one spoken response,
transcript confirmation, grounded text feedback, anonymous persistence,
deletion, responsive UI, and operational cost measurement.

Deferred: accounts, subscriptions, billing, saved progress, cross-session
memory, weekly plans, streaks, realtime speech, learner voice selection,
additional AI voices, camera analysis, pronunciation scoring, native mobile
apps, and **Practice with Sofia**.

## Success signals

- Learners can start speaking without first classifying what they want to say.
- Free sharing feels open without becoming a chatbot.
- Random questions quickly bring a concrete personal story to mind.
- Questions feel varied, accessible, and personal without pressure.
- Learners record, review, and submit one response without confusion.
- Feedback references actual language and gives one useful adjustment.
- Latency, failures, and cost are measurable without logging private content.

## Future speaking allowance

The current practice limit is 60 seconds. Longer recording time is a candidate
benefit for a future paid subscription; its duration and entitlement rules remain
undefined. This does not introduce subscriptions, billing, accounts, or paid-tier
controls into the current release. Automatic stop must preserve captured audio
for review at any future limit.

## Transcript safety

Before feedback, a temporary transcript safety check blocks abusive or hateful
language, explicit sexual content, self-harm, violence, illicit instructions,
and direct email or phone details. Ordinary sensitive stories can still receive
communication feedback. Blocked transcripts are not persisted, do not consume
the response, and leave the local recording available for another attempt.
