# OpenlyTalk Story Question Catalog

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


> **Status**: Canonical flat catalog; all 15 records approved  
> **Version**: 1.4  
> **Confirmed**: 2026-09-02

## Purpose

This file is the sole editorial source for learner-visible practice questions.
OpenlyTalk uses one flat catalog: the learner does not choose or see categories,
families, lessons, coaching lenses, techniques, or rubrics.

Every question is written and explicitly approved by the OpenlyTalk team. AI
never creates, rewrites, translates, repairs, expands, or personalizes a
learner-visible question at runtime.

The earlier family-based catalog and its approved entries were superseded by
explicit cofounder decision on 2026-09-02. Do not archive, import, or silently
carry those entries into this catalog. A former idea must be reviewed and
approved again as a new exact wording before it can return.

## Question direction

Questions help the learner tell a real story from their life. They point toward
a concrete moment, memory, person, change, decision, first experience, or recent
event rather than requesting a broad abstract opinion.

Each question includes a natural time anchor, such as **recently**, **in the
past six months**, **in the past year**, **when you were younger**, **from
childhood**, **a few years ago**, or **the last time**. The anchor should help
the learner retrieve one scene without making the question unnecessarily hard
to answer.

Each approved question:

- Contains one central storytelling invitation.
- Uses one direct question or one short **Tell me about...** invitation.
- Normally contains 6–14 words and never more than 16 words.
- Uses familiar B1-B2 English and no explanatory preamble.
- Encourages concrete details while letting the learner control disclosure.
- Is answerable through more than one possible experience.
- Avoids unrelated stacked questions, abstract diagnosis, advice-seeking,
  specialist knowledge, intimate pressure, and hidden instructions.
- Does not assume employment, travel, study, driving, disposable income, one
  family structure, or a positive childhood.
- Never tells the learner what the story is supposed to reveal about their
  personality or identity.

A question may mention childhood or another sensitive period only neutrally and
must remain easy to replace.

## Catalog record

Each entry uses this private server-owned shape:

```ts
type StoryTechniqueId =
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
  techniqueId: StoryTechniqueId;
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

The coaching lens, technique, guide, example, and feedback guidance are private
editorial metadata. `wording_approved` means the exact learner-visible English
is approved but the private record is incomplete. Only a fully validated
`approved` record is runtime-selectable.

## Universal concision guidance

Every question record inherits a required concision check in addition to its
question-specific feedback guidance. The coach must:

- Identify one choice that kept the response focused, or one evidenced
  repetition, detour, or unnecessary detail that could be reduced.
- Give one concrete trimming strategy when the response needs it.
- Use no numeric brevity, fluency, or communication score.
- Preserve context, sequence, personal meaning, and the learner's voice.
- Avoid treating a very short but unclear response as successful merely because
  it is brief.
- Make the natural example more concise when trimming is recommended.

Random-question feedback uses this guidance alongside the record's full private
metadata; it does not need to be duplicated inside each record's
`feedbackGuidance`. Free sharing has no catalog record and uses this concision
rubric as its entire feedback result. It receives no coaching lens, technique,
guide, question-specific observation, English polish, or real-life action.

## Controlled story techniques

The approved catalog uses six reusable story structures:

| Technique ID | Private structure | Purpose |
|---|---|---|
| `scene_event_response` | Context → key moment → reaction or meaning | Make one remembered scene understandable and personally meaningful. |
| `expectation_change_outcome` | Original expectation → unexpected change → outcome | Explain a change clearly without losing the original plan. |
| `first_attempt_outcome` | First attempt → what happened → outcome or reflection | Give a short, ordered account of trying something new. |
| `choice_reason_outcome` | Decision → main reason → outcome | Explain a decision without getting lost in every possible factor. |
| `lesson_origin_application` | Learning → origin → current use | Connect something learned in the past to one concrete present use. |
| `view_change_reason` | Initial view → influence or event → current view | Explain a change of mind and the reason behind it. |

These are private coaching tools, not learner-visible categories. A question's
reviewed guide may adapt the wording of the steps while preserving the
technique's structure.

## Selection and review

The server selects from all complete approved records using a fresh variation
seed and excludes the current and bounded recent question IDs. A learner may
request at most two alternatives before answering. Replacement consumes no
response and makes no model request.

Review decisions are:

- **Approve wording**: preserve the exact English below.
- **Complete metadata**: add and review the private coaching record.
- **Revise**: preserve the idea only; review the new wording again.
- **Remove**: delete the candidate without retaining it here.
- **Retire**: stop new selection while preserving an existing retained session.

## Approved wordings

These exact learner-visible wordings were approved by the cofounder on
2026-09-02. All 15 records also have approved private metadata and are complete.

| ID | Status | Approved question |
|---|---|---|
| `STORY-001` | `approved` | Tell me about a small moment you remember clearly from childhood. |
| `STORY-002` | `approved` | Tell me about a time in the past six months when your plans changed unexpectedly. |
| `STORY-003` | `approved` | When was the last time something unexpected made you laugh? |
| `STORY-004` | `approved` | Tell me about when you first met someone important to you. |
| `STORY-005` | `approved` | Tell me about something you tried for the first time recently. |
| `STORY-006` | `approved` | What’s a mistake from a few years ago you can laugh about now? |
| `STORY-007` | `approved` | Tell me about a difficult decision you’ve made in the past six months. |
| `STORY-008` | `approved` | What did someone teach you when you were younger that you still use? |
| `STORY-009` | `approved` | Tell me about a place you visited years ago and still remember clearly. |
| `STORY-010` | `approved` | When was the last time you felt proud of something you did? |
| `STORY-011` | `approved` | Was there a time last year when you changed your mind about something? |
| `STORY-012` | `approved` | What is one of the earliest moments you can remember? |
| `STORY-013` | `approved` | Tell me about a recent day that didn’t go as planned. |
| `STORY-014` | `approved` | What ordinary moment from the past month became a good memory? |
| `STORY-015` | `approved` | Tell me about a time in the past year when someone surprised you. |

## Approved complete records

### STORY-001

- **Version**: `1`
- **Coaching lens**: `expressing_yourself`
- **Technique**: `scene_event_response`
- **Guide**:
  1. Say when and where it happened.
  2. Describe one detail you still remember.
  3. Say why the moment stayed with you.
- **Example**: “When I was eight, I helped my grandfather water his plants. He
  gave me the big watering can, and I remember feeling very grown-up.”
- **Observe**: stated time or place, one concrete remembered detail, and any
  meaning the learner explicitly gives the moment.
- **Avoid**: assuming the learner's childhood was happy, difficult, safe, or
  formative; inventing why the memory matters.

### STORY-002

- **Version**: `1`
- **Coaching lens**: `explaining_clearly`
- **Technique**: `expectation_change_outcome`
- **Guide**:
  1. Explain what you originally planned.
  2. Describe what changed unexpectedly.
  3. Say what happened after the change.
- **Example**: “I planned to stay home that weekend, but a friend invited me on
  a short trip. I changed my plans and had a memorable weekend.”
- **Observe**: a clear contrast between the original plan and the change,
  logical order, and an explicitly stated outcome.
- **Avoid**: inventing why the change happened or how the learner felt about it.

### STORY-003

- **Version**: `1`
- **Coaching lens**: `expressing_yourself`
- **Technique**: `scene_event_response`
- **Guide**:
  1. Set up the situation briefly.
  2. Describe the unexpected moment.
  3. Share how you reacted.
- **Example**: “Last week, I sent a voice message to the wrong group. My
  explanation made everyone laugh, including me.”
- **Observe**: enough setup to understand the moment, the unexpected detail,
  and the learner's stated reaction.
- **Avoid**: claiming the learner is funny or has a humorous personality.

### STORY-004

- **Version**: `1`
- **Coaching lens**: `expressing_yourself`
- **Technique**: `scene_event_response`
- **Guide**:
  1. Say when and where you met.
  2. Describe your first interaction.
  3. Explain how that person later became important.
- **Example**: “I met one of my friends in a language class three years ago. We
  worked together on an exercise and continued talking after class.”
- **Observe**: context for the meeting, one concrete interaction, and only the
  importance or connection the learner explicitly describes.
- **Avoid**: assuming the type, closeness, duration, or meaning of the
  relationship.

### STORY-005

- **Version**: `1`
- **Coaching lens**: `explaining_clearly`
- **Technique**: `first_attempt_outcome`
- **Guide**:
  1. Name what you decided to try.
  2. Describe what happened during your first attempt.
  3. Say how it ended or what you thought afterward.
- **Example**: “I tried baking bread for the first time last month. It looked
  strange, but it tasted good, and I wanted to try again.”
- **Observe**: an understandable sequence, the stated outcome, and any reaction
  or reflection the learner includes.
- **Avoid**: labeling the learner brave, curious, confident, adventurous, or
  another stable type of person.

### STORY-006

- **Version**: `1`
- **Coaching lens**: `expressing_yourself`
- **Technique**: `scene_event_response`
- **Guide**:
  1. Say when the mistake happened.
  2. Describe what went wrong.
  3. Explain why you can laugh about it now.
- **Example**: “A few years ago, I arrived at a birthday dinner on the wrong
  day. I felt embarrassed then, but now my friends and I laugh about it.”
- **Observe**: sufficient context, a concrete mistake, and the learner's stated
  change in reaction.
- **Avoid**: labeling the learner careless or assuming they no longer regret
  the mistake.

### STORY-007

- **Version**: `1`
- **Coaching lens**: `explaining_clearly`
- **Technique**: `choice_reason_outcome`
- **Guide**:
  1. Explain what you had to decide.
  2. Give the main reason for your choice.
  3. Say what happened after the decision.
- **Example**: “Earlier this year, I had to choose between two evening classes.
  I chose the closer one because it fit my schedule, and the decision worked
  well.”
- **Observe**: an identifiable decision, the learner's main stated reason, and
  the stated result.
- **Avoid**: judging whether the decision was right or attributing unstated
  values or motives.

### STORY-008

- **Version**: `1`
- **Coaching lens**: `explaining_clearly`
- **Technique**: `lesson_origin_application`
- **Guide**:
  1. Say who taught you and when.
  2. Explain what they taught you.
  3. Give one example of how you use it today.
- **Example**: “When I was younger, a teacher showed me how to divide a big task
  into smaller steps. I still use that idea when something feels difficult.”
- **Observe**: the explained learning, clear attribution, and one current
  example.
- **Avoid**: assuming the relationship's importance or claiming the person
  transformed the learner.

### STORY-009

- **Version**: `1`
- **Coaching lens**: `expressing_yourself`
- **Technique**: `scene_event_response`
- **Guide**:
  1. Say when and where you visited.
  2. Describe one or two details you remember.
  3. Explain why the place remains memorable.
- **Example**: “Ten years ago, I visited a small town near the sea. I still
  remember the quiet streets and the orange light at sunset.”
- **Observe**: stated time and location, concrete details, and any meaning the
  learner explicitly expresses.
- **Avoid**: assuming frequent travel or attributing unstated nostalgia or
  emotion.

### STORY-010

- **Version**: `1`
- **Coaching lens**: `expressing_yourself`
- **Technique**: `scene_event_response`
- **Guide**:
  1. Say what you did and when.
  2. Describe one challenge or important action.
  3. Explain why it made you feel proud.
- **Example**: “Last month, I gave a short presentation in English. I prepared
  carefully and finished without reading every sentence, which made me feel
  proud.”
- **Observe**: a concrete event, one relevant action, and the learner's explicit
  reason for feeling proud.
- **Avoid**: labeling the learner confident, ambitious, or generally successful.

### STORY-011

- **Version**: `1`
- **Coaching lens**: `explaining_clearly`
- **Technique**: `view_change_reason`
- **Guide**:
  1. Say what you originally thought.
  2. Describe what happened or what you learned.
  3. Explain how your opinion changed.
- **Example**: “Last year, I thought cooking was too difficult. After making a
  simple meal with a friend, I changed my mind because I enjoyed the process.”
- **Observe**: a clear contrast between the learner's earlier and later views,
  plus one concrete stated reason for the change.
- **Avoid**: judging which opinion was correct or labeling the learner
  open-minded, stubborn, or indecisive.

### STORY-012

- **Version**: `1`
- **Coaching lens**: `expressing_yourself`
- **Technique**: `scene_event_response`
- **Guide**:
  1. Say approximately when it happened.
  2. Describe one detail from the moment.
  3. Explain what you still remember clearly.
- **Example**: “I remember sitting on the kitchen floor when I was about four,
  arranging colorful cups. I don’t remember much else, but the colors are still
  clear.”
- **Observe**: an approximate time reference, one concrete detail, and honest
  limits on what the learner remembers.
- **Avoid**: treating the memory as completely accurate or claiming it shaped
  the learner's childhood or identity.

### STORY-013

- **Version**: `1`
- **Coaching lens**: `explaining_clearly`
- **Technique**: `expectation_change_outcome`
- **Guide**:
  1. Explain what you planned or expected.
  2. Describe what changed.
  3. Say how the day ended.
- **Example**: “Last Tuesday, I planned to finish some errands, but heavy rain
  delayed me. I went home earlier and completed them the next morning.”
- **Observe**: a clear contrast between the plan and what happened, an
  understandable sequence, and an explicit outcome.
- **Avoid**: blaming the learner or inferring that they handle unexpected events
  well or badly.

### STORY-014

- **Version**: `1`
- **Coaching lens**: `expressing_yourself`
- **Technique**: `scene_event_response`
- **Guide**:
  1. Set up the ordinary situation.
  2. Describe one detail from the moment.
  3. Explain what made it a good memory.
- **Example**: “Last weekend, I drank coffee by the window while it rained.
  Nothing special happened, but the quiet moment stayed with me.”
- **Observe**: an everyday context, one concrete detail, and only the positive
  meaning the learner explicitly gives the moment.
- **Avoid**: labeling the learner grateful, mindful, or naturally positive.

### STORY-015

- **Version**: `1`
- **Coaching lens**: `responding_naturally`
- **Technique**: `scene_event_response`
- **Guide**:
  1. Say when it happened and who was involved.
  2. Describe what surprised you.
  3. Explain how you responded.
- **Example**: “A few months ago, a friend brought me my favorite snack during
  a busy day. I didn’t expect it, and I smiled immediately.”
- **Observe**: sufficient context, the unexpected element, and the learner's
  stated response.
- **Avoid**: assuming the surprise was positive, attributing an unstated
  intention to the other person, or exaggerating its emotional effect.
