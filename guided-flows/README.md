# Demo lesson

`demo-addition.json` is a small GuidedFlow lesson that calls
`demo-addition-exercise.json`. The exercise is derived from A-Guy-Web's
`tests/qa/student/fixtures/exercise-content/mcq-with-hint.json` fixture.

The question text, answer choices, and correct answer are defined together in
`demo-addition-exercise.json` under
`steps[question].rendererData.question`. A correct answer completes the nested
exercise and its parent lesson immediately; only an incorrect answer branches
to the hint step.

It proves the consumer boundary:

- A-Guy-Teacher owns the lesson, answer, hint, and question widget.
- Kody owns nesting, progress, branching, resume, and completion.
- The question widget returns only `correct` or `incorrect`; the GuidedFlow
  decides which lesson step follows.
