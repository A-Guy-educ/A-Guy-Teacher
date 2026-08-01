import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { previewData as questionSelectPreviewData } from "../widgets/question-select/widget.js";

async function readJson(relativePath) {
  return JSON.parse(
    await readFile(new URL(relativePath, import.meta.url), "utf8"),
  );
}

test("demo lesson composes a nested flow without knowing the widget payload", async () => {
  const lesson = await readJson("../guided-flows/demo-correlation.json");
  const questionFlow = await readJson(
    "../guided-flows/demo-correlation-question.json",
  );
  const nestedStep = lesson.steps.find((step) => step.id === "exercise");
  const questionStep = questionFlow.steps.find(
    (step) => step.id === "question",
  );

  assert.deepEqual(nestedStep, {
    id: "exercise",
    type: "flow",
    title: "Correlation question",
    explanation: "Answer the CMS-backed question.",
    flowId: questionFlow.id,
    flowVersion: questionFlow.version,
  });
  assert.equal(questionStep.rendererSlug, "question-select");
  assert.deepEqual(
    questionStep.rendererData.question,
    questionSelectPreviewData,
  );
  assert.deepEqual(questionStep.allowedActions, ["correct"]);
  assert.equal(questionStep.transitions, undefined);
});

test("direct feedback demo passes the same opaque CMS reference", async () => {
  const lesson = await readJson("../guided-flows/demo-widget-feedback.json");
  const questionStep = lesson.steps.find((step) => step.id === "question");

  assert.equal(lesson.id, "demo-widget-feedback");
  assert.equal(questionStep.rendererSlug, "question-select");
  assert.deepEqual(
    questionStep.rendererData.question,
    questionSelectPreviewData,
  );
  assert.deepEqual(questionStep.allowedActions, ["correct"]);
  assert.equal(questionStep.transitions, undefined);
});

test("question renderer embeds the tenant widget without a GuidedFlow contract", async () => {
  const renderer = await readJson("../views/renderers/question-select.json");

  assert.equal(renderer.slug, "question-select");
  assert.deepEqual(renderer.ui, {
    type: "widget",
    widget: "question-select",
    data: "$question",
  });
  assert.equal(renderer.data.question.type, "json");
});
