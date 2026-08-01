import assert from "node:assert/strict";
import test from "node:test";

import mountQuestionSelect, {
  parseQuestionReference,
  resolveKodyApi,
  toQuestionSelectModel,
} from "../widgets/question-select/widget.js";

const EXERCISE_ID = "69ec7dfa21b3121ed3fbb48c";
const QUESTION_ID = "b-def5678";

function richText(value) {
  return {
    type: "rich_text",
    format: "md-math-v1",
    value,
    mediaIds: [],
  };
}

function exerciseDocument(overrides = {}) {
  return {
    _id: EXERCISE_ID,
    title: "תרגיל 2",
    content: {
      blocks: [
        {
          id: QUESTION_ID,
          type: "question_select",
          variant: "mcq",
          selectionMode: "single",
          prompt: richText("איזה מספר הוא מקדם המתאם $r$?"),
          answer: {
            multiSelect: false,
            options: [
              { id: "opt-1", content: richText("$0.959$") },
              { id: "opt-2", content: richText("$1$") },
              { id: "opt-3", content: richText("$-0.959$") },
            ],
            correctOptionIds: ["opt-1"],
          },
          hint: richText("שימו לב לסימן ולקשר החיובי."),
          solution: richText("מקדם המתאם הוא $0.959$."),
        },
      ],
    },
    ...overrides,
  };
}

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.style = { cssText: "" };
    this.attributes = {};
    this.disabled = false;
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
    this.attributes[name] = String(value);
  }

  set textContent(value) {
    this._textContent = String(value);
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

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function flushAsyncWork() {
  await new Promise((resolve) => setImmediate(resolve));
}

function mountCmsQuestion({
  data = { exerciseId: EXERCISE_ID, questionId: QUESTION_ID },
  cmsGet = async () => exerciseDocument(),
} = {}) {
  const element = new FakeElement("root");
  const completions = [];
  const replies = [];
  const cmsCalls = [];
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElement: (tagName) => new FakeElement(tagName),
  };
  const cleanup = mountQuestionSelect(element, {
    data,
    theme: "light",
    cms: {
      list: async () => ({ docs: [], total: 0, limit: 0, offset: 0 }),
      get: async (collection, id) => {
        cmsCalls.push({ collection, id });
        return cmsGet(collection, id);
      },
    },
    kody: {
      postToChat: ({ content }) => replies.push(content),
      submitResult: ({ actionId, data }) =>
        completions.push({ actionId, result: data }),
    },
  });

  return {
    element,
    completions,
    replies,
    cmsCalls,
    cleanup: () => {
      cleanup?.();
      globalThis.document = previousDocument;
    },
  };
}

test("uses the new namespaced Kody widget API", () => {
  const posted = [];
  const submitted = [];
  const kody = resolveKodyApi({
    kody: {
      postToChat: (request) => posted.push(request),
      submitResult: (request) => submitted.push(request),
    },
  });

  kody.postToChat({ content: "Try again." });
  kody.submitResult({ actionId: "correct", data: { attempts: 2 } });

  assert.deepEqual(posted, [{ content: "Try again." }]);
  assert.deepEqual(submitted, [
    { actionId: "correct", data: { attempts: 2 } },
  ]);
});

test("keeps the current deployed host compatible during migration", () => {
  const replies = [];
  const completions = [];
  const kody = resolveKodyApi({
    reply: (message) => replies.push(message),
    complete: (actionId, result) => completions.push({ actionId, result }),
  });

  kody.postToChat({ content: "Try again." });
  kody.submitResult({ actionId: "correct", data: { attempts: 2 } });

  assert.deepEqual(replies, ["Try again."]);
  assert.deepEqual(completions, [
    { actionId: "correct", result: { attempts: 2 } },
  ]);
});

test("parses the A-Guy question reference from opaque widget data", () => {
  assert.deepEqual(
    parseQuestionReference({
      exerciseId: ` ${EXERCISE_ID} `,
      questionId: ` ${QUESTION_ID} `,
      ignoredByWidget: true,
    }),
    {
      exerciseId: EXERCISE_ID,
      questionId: QUESTION_ID,
    },
  );
});

test("rejects malformed question references before accessing the CMS", () => {
  assert.throws(
    () => parseQuestionReference({ exerciseId: EXERCISE_ID }),
    /question reference/i,
  );
  assert.throws(() => parseQuestionReference(null), /question reference/i);
});

test("maps one real A-Guy question_select block into a small widget model", () => {
  assert.deepEqual(toQuestionSelectModel(exerciseDocument(), QUESTION_ID), {
    exerciseId: EXERCISE_ID,
    exerciseTitle: "תרגיל 2",
    questionId: QUESTION_ID,
    variant: "mcq",
    selectionMode: "single",
    prompt: "איזה מספר הוא מקדם המתאם $r$?",
    options: [
      { id: "opt-1", label: "$0.959$" },
      { id: "opt-2", label: "$1$" },
      { id: "opt-3", label: "$-0.959$" },
    ],
    correctOptionIds: ["opt-1"],
    hint: "שימו לב לסימן ולקשר החיובי.",
    solution: "מקדם המתאם הוא $0.959$.",
  });
});

test("rejects a question whose answer references an unknown option", () => {
  const exercise = exerciseDocument();
  exercise.content.blocks[0].answer.correctOptionIds = ["missing"];

  assert.throws(
    () => toQuestionSelectModel(exercise, QUESTION_ID),
    /question data/i,
  );
});

test("loads the exercise through the generic CMS client and renders the selected block", async () => {
  const mounted = mountCmsQuestion();

  try {
    assert.match(mounted.element.textContent, /loading/i);
    await flushAsyncWork();

    assert.deepEqual(mounted.cmsCalls, [
      { collection: "exercises", id: EXERCISE_ID },
    ]);
    assert.match(mounted.element.textContent, /מקדם המתאם/);
    assert.deepEqual(
      buttonsWithin(mounted.element).map((button) => button.textContent),
      ["$0.959$", "$1$", "$-0.959$"],
    );
  } finally {
    mounted.cleanup();
  }
});

test("uses the widget-owned demo question when Chat opens it without payload data", async () => {
  const mounted = mountCmsQuestion({ data: {} });

  try {
    await flushAsyncWork();

    assert.deepEqual(mounted.cmsCalls, [
      { collection: "exercises", id: EXERCISE_ID },
    ]);
    assert.match(mounted.element.textContent, /מקדם המתאם/);
  } finally {
    mounted.cleanup();
  }
});

test("keeps saved inline questions usable after the CMS-backed upgrade", () => {
  const mounted = mountCmsQuestion({
    data: {
      title: "Quick check",
      prompt: "What is 2 + 2?",
      options: [
        { id: "three", label: "3" },
        { id: "four", label: "4", correct: true },
      ],
    },
    cmsGet: async () => {
      throw new Error("saved inline questions must not access the CMS");
    },
  });

  try {
    assert.match(mounted.element.textContent, /What is 2 \+ 2\?/);
    assert.deepEqual(mounted.cmsCalls, []);

    buttonsWithin(mounted.element)
      .find((button) => button.textContent === "3")
      .onclick();

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

test("preserves saved inline retry feedback and completion actions", () => {
  const mounted = mountCmsQuestion({
    data: {
      prompt: "What is 3 + 4?",
      retryIncorrect: true,
      completionAction: "continue",
      feedback: {
        incorrect: "Count forward four steps and try again.",
        correct: "Correct — 3 + 4 is 7.",
      },
      options: [
        { id: "six", label: "6" },
        { id: "seven", label: "7", correct: true },
      ],
    },
  });

  try {
    const buttons = buttonsWithin(mounted.element);
    buttons.find((button) => button.textContent === "6").onclick();
    assert.deepEqual(mounted.replies, [
      "Count forward four steps and try again.",
    ]);
    assert.deepEqual(mounted.completions, []);

    buttons.find((button) => button.textContent === "7").onclick();
    assert.deepEqual(mounted.replies, [
      "Count forward four steps and try again.",
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

test("keeps the question active after a wrong answer and completes once after the correct answer", async () => {
  const mounted = mountCmsQuestion();

  try {
    await flushAsyncWork();
    const buttons = buttonsWithin(mounted.element);
    const wrongButton = buttons.find((button) => button.textContent === "$1$");
    const correctButton = buttons.find(
      (button) => button.textContent === "$0.959$",
    );
    assert.ok(wrongButton);
    assert.ok(correctButton);

    wrongButton.onclick();
    assert.deepEqual(mounted.replies, ["שימו לב לסימן ולקשר החיובי."]);
    assert.deepEqual(mounted.completions, []);

    correctButton.onclick();
    correctButton.onclick();

    assert.deepEqual(mounted.replies, [
      "שימו לב לסימן ולקשר החיובי.",
      "מקדם המתאם הוא $0.959$.",
    ]);
    assert.deepEqual(mounted.completions, [
      {
        actionId: "correct",
        result: {
          exerciseId: EXERCISE_ID,
          questionId: QUESTION_ID,
          selectedOptionIds: ["opt-1"],
          correct: true,
          attempts: 2,
        },
      },
    ]);
  } finally {
    mounted.cleanup();
  }
});

test("supports the full multiple-selection behavior of question_select", async () => {
  const exercise = exerciseDocument();
  const block = exercise.content.blocks[0];
  block.selectionMode = "multiple";
  block.answer.multiSelect = true;
  block.answer.correctOptionIds = ["opt-1", "opt-3"];
  const mounted = mountCmsQuestion({ cmsGet: async () => exercise });

  try {
    await flushAsyncWork();
    const buttons = buttonsWithin(mounted.element);
    buttons.find((button) => button.textContent === "$0.959$").onclick();
    buttons.find((button) => button.textContent === "$-0.959$").onclick();
    buttons.find((button) => button.textContent === "בדיקה").onclick();

    assert.deepEqual(mounted.completions, [
      {
        actionId: "correct",
        result: {
          exerciseId: EXERCISE_ID,
          questionId: QUESTION_ID,
          selectedOptionIds: ["opt-1", "opt-3"],
          correct: true,
          attempts: 1,
        },
      },
    ]);
  } finally {
    mounted.cleanup();
  }
});

test("supports the true-false variant with CMS-owned labels", async () => {
  const exercise = exerciseDocument();
  exercise.content.blocks[0] = {
    id: QUESTION_ID,
    type: "question_select",
    variant: "true_false",
    selectionMode: "single",
    prompt: richText("מקדם מתאם חיובי מתאר קשר חיובי."),
    options: [
      { id: "true", value: true, label: richText("נכון") },
      { id: "false", value: false, label: richText("לא נכון") },
    ],
    answer: { correctOptionId: "true" },
    solution: richText("נכון — סימן חיובי מתאר קשר חיובי."),
  };
  const mounted = mountCmsQuestion({ cmsGet: async () => exercise });

  try {
    await flushAsyncWork();
    const buttons = buttonsWithin(mounted.element);
    assert.deepEqual(
      buttons.map((button) => button.textContent),
      ["נכון", "לא נכון"],
    );
    buttons.find((button) => button.textContent === "נכון").onclick();

    assert.equal(mounted.completions[0].actionId, "correct");
    assert.deepEqual(mounted.completions[0].result.selectedOptionIds, ["true"]);
  } finally {
    mounted.cleanup();
  }
});

test("requires a selection before checking a multiple-selection question", async () => {
  const exercise = exerciseDocument();
  exercise.content.blocks[0].selectionMode = "multiple";
  exercise.content.blocks[0].answer.multiSelect = true;
  const mounted = mountCmsQuestion({ cmsGet: async () => exercise });

  try {
    await flushAsyncWork();
    buttonsWithin(mounted.element)
      .find((button) => button.textContent === "בדיקה")
      .onclick();

    assert.match(mounted.element.textContent, /בחרו לפחות תשובה אחת/);
    assert.deepEqual(mounted.replies, []);
    assert.deepEqual(mounted.completions, []);
  } finally {
    mounted.cleanup();
  }
});

test("renders a safe generic error when CMS loading fails", async () => {
  const mounted = mountCmsQuestion({
    cmsGet: async () => {
      throw new Error("mongodb://secret-host/internal");
    },
  });

  try {
    await flushAsyncWork();
    assert.match(mounted.element.textContent, /question unavailable/i);
    assert.doesNotMatch(mounted.element.textContent, /mongodb|secret-host/i);
    assert.deepEqual(mounted.completions, []);
  } finally {
    mounted.cleanup();
  }
});

test("ignores a late CMS response after the widget is unmounted", async () => {
  const request = deferred();
  const mounted = mountCmsQuestion({ cmsGet: () => request.promise });
  mounted.cleanup();

  request.resolve(exerciseDocument());
  await flushAsyncWork();

  assert.equal(mounted.element.textContent, "");
  assert.deepEqual(mounted.completions, []);
  assert.deepEqual(mounted.replies, []);
});
