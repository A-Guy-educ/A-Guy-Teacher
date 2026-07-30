import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import mountQuestionSelect from "../widgets/question-select/widget.js";

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.style = { cssText: "" };
    this.attributes = {};
    this.onclick = null;
    this._textContent = "";
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  replaceChildren(...children) {
    this._textContent = "";
    this.children = children;
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
  }

  set textContent(value) {
    this._textContent = value;
    this.children = [];
  }

  get textContent() {
    return (
      this._textContent +
      this.children.map((child) => child.textContent).join("")
    );
  }
}

function buttonsWithin(element) {
  return [
    ...(element.tagName === "button" ? [element] : []),
    ...element.children.flatMap(buttonsWithin),
  ];
}

function mountQuestion(question, overrides = {}) {
  const element = new FakeElement("root");
  const completions = [];
  const replies = [];
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElement: (tagName) => new FakeElement(tagName),
  };
  const cleanup = mountQuestionSelect(element, {
    data: question,
    theme: "light",
    cms: {
      list: async () => ({ docs: [], total: 0, limit: 10, offset: 0 }),
      get: async () => ({}),
    },
    reply: (message) => replies.push(message),
    complete: (actionId, result) => completions.push({ actionId, result }),
    ...overrides,
  });
  return {
    element,
    completions,
    replies,
    cleanup: () => {
      cleanup?.();
      globalThis.document = previousDocument;
    },
  };
}

test("demo lesson uses the teacher question widget and branches on its result", async () => {
  const lesson = JSON.parse(
    await readFile(
      new URL("../guided-flows/demo-addition.json", import.meta.url),
      "utf8",
    ),
  );
  const exercise = JSON.parse(
    await readFile(
      new URL(
        "../guided-flows/demo-addition-exercise.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const nestedStep = lesson.steps.find((step) => step.id === "exercise");
  const questionStep = exercise.steps.find((step) => step.id === "question");

  assert.deepEqual(nestedStep, {
    id: "exercise",
    type: "flow",
    title: "Addition exercise",
    explanation: "Complete the guided addition exercise.",
    flowId: exercise.id,
    flowVersion: exercise.version,
  });
  assert.equal(questionStep.rendererSlug, "question-select");
  assert.deepEqual(questionStep.rendererData.question, {
    title: "Quick check",
    prompt: "What is 2 + 2?",
    options: [
      { id: "three", label: "3" },
      { id: "four", label: "4", correct: true },
      { id: "five", label: "5" },
    ],
  });
  assert.deepEqual(questionStep.transitions, {
    incorrect: "hint",
  });
  assert.equal(
    exercise.steps.find((step) => step.id === "hint").transitions.retry,
    "question",
  );
});

test("question-select reports an incorrect option without choosing the next step", () => {
  const mounted = mountQuestion({
    prompt: "What is 2 + 2?",
    options: [
      { id: "three", label: "3" },
      { id: "four", label: "4", correct: true },
    ],
  });

  try {
    const wrongButton = buttonsWithin(mounted.element).find(
      (button) => button.textContent === "3",
    );
    assert.ok(wrongButton);
    wrongButton.onclick();
    assert.deepEqual(mounted.completions, [
      {
        actionId: "incorrect",
        result: { selectedOptionId: "three" },
      },
    ]);
  } finally {
    mounted.cleanup();
  }
});

test("question-select reports the correct option", () => {
  const mounted = mountQuestion({
    prompt: "What is 2 + 2?",
    options: [
      { id: "three", label: "3" },
      { id: "four", label: "4", correct: true },
    ],
  });

  try {
    const correctButton = buttonsWithin(mounted.element).find(
      (button) => button.textContent === "4",
    );
    assert.ok(correctButton);
    correctButton.onclick();
    assert.deepEqual(mounted.completions, [
      {
        actionId: "correct",
        result: { selectedOptionId: "four" },
      },
    ]);
    correctButton.onclick();
    assert.equal(mounted.completions.length, 1);
  } finally {
    mounted.cleanup();
  }
});

test("new widget-feedback lesson keeps incorrect feedback inside the widget", async () => {
  const lesson = JSON.parse(
    await readFile(
      new URL(
        "../guided-flows/demo-widget-feedback.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const questionStep = lesson.steps.find((step) => step.id === "question");

  assert.equal(lesson.id, "demo-widget-feedback");
  assert.equal(questionStep.rendererSlug, "question-select");
  assert.equal(questionStep.rendererData.question.retryIncorrect, true);
  assert.equal(
    questionStep.rendererData.question.cmsContext.collection,
    "lessons",
  );
  assert.deepEqual(questionStep.allowedActions, ["continue"]);
  assert.equal(questionStep.transitions, undefined);
});

test("question-select replies after a wrong answer and stays active", () => {
  const mounted = mountQuestion({
    prompt: "What is 3 + 4?",
    retryIncorrect: true,
    completionAction: "continue",
    feedback: {
      incorrect: "Not quite. Count forward four steps and try again.",
      correct: "Correct — 3 + 4 is 7.",
    },
    options: [
      { id: "six", label: "6" },
      { id: "seven", label: "7", correct: true },
    ],
  });

  try {
    const buttons = buttonsWithin(mounted.element);
    const wrongButton = buttons.find((button) => button.textContent === "6");
    const correctButton = buttons.find((button) => button.textContent === "7");
    assert.ok(wrongButton);
    assert.ok(correctButton);

    wrongButton.onclick();
    assert.deepEqual(mounted.replies, [
      "Not quite. Count forward four steps and try again.",
    ]);
    assert.deepEqual(mounted.completions, []);

    correctButton.onclick();
    assert.deepEqual(mounted.replies, [
      "Not quite. Count forward four steps and try again.",
      "Correct — 3 + 4 is 7.",
    ]);
    assert.deepEqual(mounted.completions, [
      {
        actionId: "continue",
        result: { selectedOptionId: "seven" },
      },
    ]);
  } finally {
    mounted.cleanup();
  }
});

test("question-select displays lesson context loaded through its CMS client", async () => {
  const calls = [];
  const mounted = mountQuestion(
    {
      prompt: "What is 3 + 4?",
      options: [{ id: "seven", label: "7", correct: true }],
      cmsContext: {
        collection: "lessons",
        labelField: "title",
        prefix: "Lesson source",
      },
    },
    {
      cms: {
        list: async (collection, query) => {
          calls.push({ collection, query });
          return {
            docs: [{ _id: "lesson-1", title: "Adding whole numbers" }],
            total: 1,
            limit: 1,
            offset: 0,
          };
        },
        get: async () => ({}),
      },
    },
  );

  try {
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.deepEqual(calls, [
      { collection: "lessons", query: { limit: 1 } },
    ]);
    assert.match(
      mounted.element.textContent,
      /Lesson source: Adding whole numbers/,
    );
  } finally {
    mounted.cleanup();
  }
});

test("question-select fails safely when question options are missing", () => {
  const mounted = mountQuestion(null);

  try {
    assert.match(mounted.element.textContent, /no answer options/i);
    assert.equal(buttonsWithin(mounted.element).length, 0);
    assert.deepEqual(mounted.completions, []);
  } finally {
    mounted.cleanup();
  }
});

test("question renderer embeds the matching tenant widget", async () => {
  const renderer = JSON.parse(
    await readFile(
      new URL("../views/renderers/question-select.json", import.meta.url),
      "utf8",
    ),
  );

  assert.equal(renderer.slug, "question-select");
  assert.deepEqual(renderer.ui, {
    type: "widget",
    widget: "question-select",
    data: "$question",
  });
  assert.equal(renderer.data.question.type, "json");
});
