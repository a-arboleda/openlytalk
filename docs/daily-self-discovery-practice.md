# Daily personal reflection — Getting to Know Yourself

> Current founder direction, October 7, 2026. Supersedes weekly themes and the
> earlier random-question product. One category, one personal question a day.

## Product and editorial direction

OpenlyTalk invites learners to explore their thoughts while practicing English.
The learner decides what an answer means to them. The coach helps express that
meaning clearly and naturally, without interpreting personality, diagnosing,
judging values, prescribing life changes, or assessing self-awareness.

The founder approved the tone of six sample questions about being understood,
changing priorities, feeling comfortable, making room for something, changing
wishes, and learning through other people. The collection expands that tone
with original English prompts. It uses the shared reflection theme of the
reference article, not its psychological claims, diagnostic questions, intimate
prompts, or wording as an imported catalog.

Reference: https://psicologiaymente.com/psicologia/preguntas-para-conocerte-mejor

Only today's question is learner-visible. There are no weekly themes, day-of-seven
labels, category choices, or required storytelling patterns. Optional hints help
recall or set a comfortable scope; the expandable guide and hidden example
support expression without imposing a correct answer. Uncertainty is welcome.

Homepage: “Get to know yourself, one answer at a time.”
Supporting copy: “Practice expressing your thoughts in English with one personal
question a day.” Preserve the compact first-viewport composition.

## Runtime and compatibility

`lib/story-practice/daily-questions.json` is the current editorial source, with
28 versioned records (STORY-201–228). `daily.ts` validates and selects one record
using the shared UTC calendar starting October 7, 2026. Midnight advances one
question. The 28-question cycle repeats; append future content at a deliberate
cycle boundary to avoid an unexpected change to modulo selection. No user
progress, accounts, streaks, or per-day submission quotas are introduced.

Creation still accepts `daily_question` and uses the existing schema-7
question-feedback storage discriminator. Its `daily` snapshot now contains
categoryId, categoryTitle, date, and supportPrompt. The old weekly snapshot
shape remains readable; opened sessions keep their exact question and guidance.
The former weekly JSON and document are historical, not a runtime selection source.

The English-only 60-second recording, local review, signed transcript preview,
idempotent submission, ownership, moderation, grounded feedback, retention,
and PDF contracts remain intact. No question audio or replacement is restored.
Feedback may reflect explicitly stated preferences or thoughts, but must not
infer hidden truths. Real-life suggestions are communication practice, not
instructions about how to live or a demand for more disclosure.

## Questions in scheduled order

1. What is something you wish people understood better about you?
2. What would you like to make more room for in your life?
3. When do you feel most comfortable being yourself?
4. What is a small thing about your life that you appreciate more now?
5. What is something you used to want but no longer do?
6. What kind of conversation makes you feel connected to someone?
7. What has become more important to you as you’ve grown older?
8. What do you enjoy even when you are not especially good at it?
9. What is a choice you are glad you made for yourself?
10. What helps you notice what you really think about something?
11. What have you learned about yourself through someone else?
12. What would you like an ordinary day in your future to feel like?
13. What is something you like about the way you see the world?
14. What have you changed your mind about as you’ve learned more about yourself?
15. What do you miss about an interest you used to have?
16. What makes you feel that your time has been well spent?
17. What is something you find easier to express in writing than aloud?
18. What would you like to try without worrying about being good at it?
19. What is a small way you like to show someone you care?
20. What part of your younger self would you like to keep?
21. What is something you are still figuring out about what you want?
22. What makes it easier for you to say what you really mean?
23. What is something you choose to do simply because it matters to you?
24. What do you notice about yourself when you spend time alone?
25. What is a compliment that means something to you, and why?
26. What would you like to be more honest with yourself about?
27. What is something you want to decide for yourself more often?
28. What is something about yourself that you would like to understand better?

## Launch operations

New sessions have a five-day access window, leaving room for the authenticated
Vercel daily cleanup before the public maximum of seven days. Previously stored
expiry timestamps are preserved. Cleanup covers retained schemas as well as
schema 7; no active retained session is removed early. Follow
[the deployment checklist](vercel-launch.md) for the first-run retention gate.

Audio remains limited to 60 seconds, with a 4 MB file cap and 4.2 MB multipart
cap. Shared database request counters protect public and retained paid routes.
Rate limiting counts HTTP attempts (including failures and retries), independently
of accepted spoken responses. A rejected attempt never consumes a response.
