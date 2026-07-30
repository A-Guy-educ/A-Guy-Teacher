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

function mountQuestion(question) {
  const element = new FakeElement("root");
  const completions = [];
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElement: (tagName) => new FakeElement(tagName),
  };
  const cleanup = mountQuestionSelect(element, {
    data: question,
    theme: "light",
    complete: (actionId, result) => completions.push({ actionId, result }),
  });
  return {
    element,
    completions,
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
    transitions: { complete: "complete" },
  });
  assert.equal(questionStep.rendererSlug, "question-select");
  assert.deepEqual(questionStep.transitions, {
    correct: "complete",
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
});
