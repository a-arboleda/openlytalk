# OpenlyTalk Content Architecture

> Historical design: the 2026-09-29 practice-only scope in
> `docs/openlytalk-platform-definition.md` supersedes public Learn and publishing.

> **Status**: Approved foundation for the Learn area  
> **Version**: 1.0  
> **Confirmed**: 2026-09-09

## Objective

Build a durable editorial system that lets the founder publish continuously
without turning OpenlyTalk into a generic blog or making every piece depend on
AI. Content should help a B1-B2 English speaker notice, understand, and apply
one useful communication idea.

## Editorial unit

The primary unit is a **learning piece**. A learning piece is more useful than
a conventional blog post because it combines explanation with observation or
application.

Each substantial learning piece should contain:

1. **A recognizable situation** — where the communication problem appears.
2. **One central idea** — the single lesson the piece promises to clarify.
3. **A concrete example** — language or behavior the learner can inspect.
4. **A breakdown** — why the example helps or hinders the listener.
5. **A better option** — a meaning-preserving adjustment, when relevant.
6. **An exercise** — one small action the learner can complete.
7. **A takeaway** — one idea worth remembering outside OpenlyTalk.

A piece may omit a better option when it is exploratory rather than
corrective. It may link to speaking practice when the relationship is genuine;
every article does not need an AI interaction.

## Content formats

Launch with four formats. Formats describe how a piece teaches; pillars
describe what it teaches.

### Guide

Explains one communication principle and gives the learner a practical way to
apply it.

Example: **How to give context without overexplaining**.

### Breakdown

Examines two or more versions of a response, story, or interaction and helps
the learner notice the difference.

Example: **Why the second version is easier to follow**.

### Exercise

Leads with an activity and includes only the explanation needed to complete it
well.

Example: **Remove three details without changing the story**.

### Reflection

Invites the learner to observe communication in their own life without
requiring a submitted response.

Example: **What do you do while another person is speaking?**

Do not introduce more formats until repeated publishing shows a real need.

## Editorial pillars

Every learning piece has exactly one primary pillar and may have up to two
secondary pillars.

### Clarity

- identifying the main point;
- making references understandable;
- explaining reasons and relationships; and
- checking what the listener needs to know.

### Concision

- recognizing repetition;
- distinguishing context from detours;
- choosing useful details; and
- ending after the meaning is complete.

### Organization

- ordering information;
- opening with a useful frame;
- connecting ideas; and
- moving from point to support or example.

### Storytelling

- setting a scene economically;
- showing what happened or changed;
- selecting relevant people and events; and
- explaining why a moment mattered when the speaker expressed that meaning.

### Natural English

- choosing precise, familiar words;
- replacing translations that obscure meaning;
- using natural transitions; and
- improving high-value phrases without exhaustive correction.

### Presence and attention

- listening visibly and verbally;
- using pauses and pace intentionally;
- noticing posture and physical orientation; and
- giving another person enough space to respond.

Content in this pillar must describe observable behavior and situational
effects. It must not diagnose anxiety, confidence, personality, intent, or
mental state from posture, gaze, voice, or other behavior.

## Learner-facing information architecture

The first release uses four primary destinations:

```text
Home
├── Featured learning piece
├── Recent learning pieces
├── Start a speaking practice
└── About the OpenlyTalk method

Learn
├── All learning pieces
├── Filter by pillar
└── Individual learning piece
    ├── Explanation and examples
    ├── Exercise
    ├── Takeaway
    └── Relevant practice invitation, when available

Practice
├── Share anything
└── Receive a random approved question

About
├── Purpose
├── Method: Notice, Shape, Speak, Reflect
└── Founder and editorial point of view
```

Recommended public routes:

- `/` — editorial homepage;
- `/learn` — learning library;
- `/learn/[slug]` — individual learning piece;
- `/practice` — practice entry; and
- `/about` — purpose, method, and founder perspective.

Pillars may be query filters on `/learn` for the first release. Separate pillar
landing pages are unnecessary until the library is large enough to justify
them.

## Content record

Each published learning piece requires this editorial metadata:

| Field | Requirement |
| --- | --- |
| `id` | Stable internal identifier |
| `slug` | Stable, readable public path |
| `title` | One clear learner-facing promise or question |
| `description` | Short, concrete summary for discovery and metadata |
| `status` | `draft`, `in_review`, `approved`, `published`, or `retired` |
| `format` | `guide`, `breakdown`, `exercise`, or `reflection` |
| `primaryPillar` | Exactly one controlled editorial pillar |
| `secondaryPillars` | Zero to two controlled editorial pillars |
| `level` | `b1`, `b2`, or `b1_b2` |
| `publishedAt` | Required only when published |
| `updatedAt` | Date of the latest meaningful editorial revision |
| `readingMinutes` | Honest estimated reading time |
| `featured` | Editorial flag, not an automatic popularity score |
| `exercise` | Structured exercise or explicit `null` |
| `practiceConnection` | Approved practice reference or explicit `null` |

The body remains authored prose. Metadata exists for validation, discovery,
accessibility, and future migration; it must not make the writing feel like a
database template.

## Exercise contract

An exercise contains:

- one observable objective;
- one clear instruction;
- an example only when it reduces ambiguity;
- an estimated completion time; and
- a completion state that does not require an account.

Exercises should take roughly two to ten minutes in the initial release. They
must not promise to assess a stable trait or require learners to disclose
sensitive personal information.

The first release supports three exercise modes:

- **Notice** — compare, underline, identify, or observe;
- **Shape** — reorder, trim, choose, or draft; and
- **Speak** — say a response aloud, with an optional link to the bounded
  practice studio when technically supported.

“Reflect” is the final prompt or takeaway across these modes rather than a
separate scored activity.

## Relationship to speaking practice

Content and practice share principles, not unrestricted data.

- A learning piece may link to the general practice entry.
- A future content-linked practice must use an approved invitation and an
  explicit runtime contract.
- Publishing an article must never create or change learner-visible practice
  questions automatically.
- Editorial pillars must not become learner-selected classifications in the
  current story-first practice setup.
- AI feedback must remain grounded in the submitted transcript and preserve
  the learner's meaning.
- Reading behavior must not be used to infer a learner's personality, hidden
  motives, feelings, or identity.

## Language and voice

Launch content is English-first and written for B1-B2 comprehension. Use:

- short paragraphs and descriptive headings;
- familiar words before specialist terminology;
- natural examples that adults might actually say;
- one central idea per piece;
- a warm, thoughtful, non-academic voice; and
- enough nuance to be honest without overwhelming the learner.

Do not simplify an idea until it becomes false. Explain necessary terminology
in the piece. Translation and multilingual publishing remain later editorial
decisions rather than automatic machine-generated variants.

## Editorial safety and quality rules

Every piece must:

- distinguish observable communication from personality judgment;
- avoid diagnosing confidence, anxiety, attention disorders, motives, or
  relationships;
- avoid treating one culture's body language as universally correct;
- avoid claiming that brevity is always better;
- preserve necessary context and the speaker's intended meaning;
- present English alternatives as useful options, not the only valid voice;
- make examples accessible without assuming work, study, travel, money,
  family structure, or a positive childhood; and
- disclose when a claim requires evidence or professional expertise beyond
  OpenlyTalk's editorial scope.

## Publishing workflow

Use this workflow for every learning piece:

1. **Idea** — capture the learner situation and central communication idea.
2. **Draft** — write the piece and its exercise.
3. **Communication review** — confirm the advice is precise and
   meaning-preserving.
4. **Learner-language review** — confirm B1-B2 accessibility and natural
   English.
5. **Safety and assumptions review** — apply the editorial quality rules.
6. **Approve** — freeze the title, slug, metadata, and publication-ready body.
7. **Publish** — release intentionally; AI never publishes autonomously.
8. **Revise or retire** — record meaningful revisions without silently
   replacing the argument of a published piece.

For the first release, store approved content as version-controlled MDX in the
repository. This keeps authorship, review, and publication explicit. Revisit a
CMS only when non-technical publishing frequency or collaboration makes the
repository workflow a demonstrated constraint.

## Initial foundation collection

Create these six pieces before expanding the library:

1. **Know your point before you start speaking**  
   Pillar: Clarity · Format: Guide · Exercise: state one point in one sentence.
2. **Give context without overexplaining**  
   Pillar: Concision · Format: Breakdown · Exercise: separate necessary context
   from optional detail.
3. **Put your ideas in an order people can follow**  
   Pillar: Organization · Format: Guide · Exercise: reorder a short response.
4. **Tell a story around what changed**  
   Pillar: Storytelling · Format: Guide · Exercise: identify before, change,
   and after.
5. **Choose natural English that keeps your meaning**  
   Pillar: Natural English · Format: Breakdown · Exercise: compare literal and
   meaning-preserving alternatives.
6. **Use pauses to give your ideas shape**  
   Pillar: Presence and attention · Format: Exercise · Exercise: mark and speak
   a short response with intentional pauses.

Together these pieces introduce every pillar, demonstrate the four formats,
and establish the editorial standard before publication volume becomes the
goal.

## Success signals

Early content success is shown when learners:

- reach and complete the exercise;
- move naturally from a learning piece into relevant practice;
- return to read or practice again;
- can state the central idea after completing a piece; and
- report that examples and adjustments preserved the intended meaning.

Page views and reading time may inform discovery, but they are not sufficient
evidence that a piece helped someone communicate better.

## Exit gate for content architecture

The architecture is ready for implementation when:

- the platform definition and six pillars are approved;
- the four launch formats and learning-piece structure are accepted;
- the first six titles have an owner and intended exercise;
- the English-first decision is confirmed;
- the initial routes are accepted; and
- the repository-based MDX workflow is accepted for the first release.

