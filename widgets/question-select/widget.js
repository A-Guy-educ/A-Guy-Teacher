const EXERCISES_COLLECTION = "exercises";
const MAX_REFERENCE_LENGTH = 200;

const COPY = {
  loading: "Loading question…",
  unavailable: "Question unavailable.",
  noSelection: "בחרו לפחות תשובה אחת.",
  incorrect: "התשובה אינה נכונה. נסו שוב.",
  correct: "נכון.",
  check: "בדיקה",
  trueLabel: "נכון",
  falseLabel: "לא נכון",
};

const COLORS = {
  light: {
    text: "#23261f",
    border: "#d6d8cc",
    surface: "#f6f6f1",
    selected: "#ece9ff",
    selectedBorder: "#6d5bd0",
    feedback: "#55584f",
  },
  dark: {
    text: "#e6e7df",
    border: "#3a3d33",
    surface: "#242720",
    selected: "#35304f",
    selectedBorder: "#9b8cf2",
    feedback: "#c7c9bf",
  },
};

/**
 * Widget-owned demo input. Kody treats this value as opaque data.
 * The IDs point to an existing A-Guy exercise and question block.
 */
export const previewData = {
  exerciseId: "69ec7dfa21b3121ed3fbb48c",
  questionId: "b-def5678",
};

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Resolves the narrow Kody capabilities used by this widget.
 *
 * The top-level fallback keeps the already-published host compatible during
 * the coordinated migration. New hosts and all new widget code use props.kody.
 */
export function resolveKodyApi(props) {
  if (
    isRecord(props?.kody) &&
    typeof props.kody.postToChat === "function" &&
    typeof props.kody.submitResult === "function"
  ) {
    return {
      postToChat: props.kody.postToChat,
      submitResult: props.kody.submitResult,
    };
  }

  if (
    typeof props?.reply === "function" &&
    typeof props?.complete === "function"
  ) {
    return {
      postToChat: ({ content }) => props.reply(content),
      submitResult: ({ actionId, data }) => props.complete(actionId, data),
    };
  }

  throw new Error("Kody widget API is unavailable.");
}

function requireReferencePart(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > MAX_REFERENCE_LENGTH) return null;
  return normalized;
}

/**
 * Parses the A-Guy-owned input carried inside Kody's generic widget data.
 */
export function parseQuestionReference(value) {
  if (!isRecord(value)) {
    throw new Error("Invalid question reference.");
  }
  const exerciseId = requireReferencePart(value.exerciseId);
  const questionId = requireReferencePart(value.questionId);
  if (!exerciseId || !questionId) {
    throw new Error("Invalid question reference.");
  }
  return { exerciseId, questionId };
}

function questionReferenceForMount(value) {
  if (
    value === undefined ||
    value === null ||
    (isRecord(value) && Object.keys(value).length === 0)
  ) {
    return parseQuestionReference(previewData);
  }
  return parseQuestionReference(value);
}

function readRequiredRichText(value) {
  if (!isRecord(value)) return null;
  if (value.type !== "rich_text" || value.format !== "md-math-v1") return null;
  if (typeof value.value !== "string" || !value.value.trim()) return null;
  return value.value.trim();
}

function readOptionalRichText(value) {
  if (value === undefined || value === null) return undefined;
  const text = readRequiredRichText(value);
  return text || undefined;
}

function readExerciseId(exercise) {
  return (
    requireReferencePart(exercise.cmsDocumentId) ??
    requireReferencePart(exercise._id) ??
    requireReferencePart(exercise.id)
  );
}

function normalizeMcqQuestion(block) {
  if (!isRecord(block.answer) || !Array.isArray(block.answer.options)) {
    return null;
  }
  const options = block.answer.options.map((option) => {
    if (!isRecord(option)) return null;
    const id = requireReferencePart(option.id);
    const label = readRequiredRichText(option.content);
    return id && label ? { id, label } : null;
  });
  if (options.length < 2 || options.some((option) => option === null)) {
    return null;
  }
  const optionIds = new Set(options.map((option) => option.id));
  if (optionIds.size !== options.length) return null;

  const correctOptionIds = Array.isArray(block.answer.correctOptionIds)
    ? block.answer.correctOptionIds
        .map(requireReferencePart)
        .filter((id) => id !== null)
    : [];
  if (
    correctOptionIds.length === 0 ||
    new Set(correctOptionIds).size !== correctOptionIds.length ||
    correctOptionIds.some((id) => !optionIds.has(id))
  ) {
    return null;
  }

  const selectionMode =
    block.selectionMode === "multiple" || block.answer.multiSelect === true
      ? "multiple"
      : "single";
  if (selectionMode === "single" && correctOptionIds.length !== 1) return null;

  return {
    selectionMode,
    options,
    correctOptionIds,
  };
}

function normalizeTrueFalseQuestion(block) {
  if (!isRecord(block.answer)) return null;
  const correctOptionId = requireReferencePart(block.answer.correctOptionId);
  if (correctOptionId !== "true" && correctOptionId !== "false") return null;

  const configuredOptions = Array.isArray(block.options)
    ? block.options.map((option) => {
        if (!isRecord(option)) return null;
        const id = requireReferencePart(option.id);
        const label = readRequiredRichText(option.label);
        return id && label ? { id, label } : null;
      })
    : [];
  const options =
    configuredOptions.length === 2 &&
    configuredOptions.every((option) => option !== null) &&
    configuredOptions.some((option) => option.id === "true") &&
    configuredOptions.some((option) => option.id === "false")
      ? configuredOptions
      : [
          { id: "true", label: COPY.trueLabel },
          { id: "false", label: COPY.falseLabel },
        ];

  return {
    selectionMode: "single",
    options,
    correctOptionIds: [correctOptionId],
  };
}

/**
 * Converts one untrusted CMS document into the minimal model used by this
 * widget. No CMS-specific shape escapes this boundary.
 */
export function toQuestionSelectModel(exercise, questionId) {
  if (!isRecord(exercise) || !isRecord(exercise.content)) {
    throw new Error("Invalid question data.");
  }
  const exerciseId = readExerciseId(exercise);
  const normalizedQuestionId = requireReferencePart(questionId);
  const blocks = Array.isArray(exercise.content.blocks)
    ? exercise.content.blocks
    : [];
  const block = blocks.find(
    (candidate) => isRecord(candidate) && candidate.id === normalizedQuestionId,
  );
  if (
    !exerciseId ||
    !normalizedQuestionId ||
    !isRecord(block) ||
    block.type !== "question_select"
  ) {
    throw new Error("Invalid question data.");
  }

  const prompt = readRequiredRichText(block.prompt);
  const answer =
    block.variant === "mcq"
      ? normalizeMcqQuestion(block)
      : block.variant === "true_false"
        ? normalizeTrueFalseQuestion(block)
        : null;
  if (!prompt || !answer) {
    throw new Error("Invalid question data.");
  }

  return {
    exerciseId,
    exerciseTitle:
      typeof exercise.title === "string" ? exercise.title.trim() : "",
    questionId: normalizedQuestionId,
    variant: block.variant,
    selectionMode: answer.selectionMode,
    prompt,
    options: answer.options,
    correctOptionIds: answer.correctOptionIds,
    hint: readOptionalRichText(block.hint),
    solution:
      readOptionalRichText(block.fullSolution) ??
      readOptionalRichText(block.solution),
  };
}

/**
 * Saved version-1 flows carried the complete question inline. Keep that
 * historical input at the widget boundary so persisted flows remain usable
 * while new definitions use the CMS reference contract.
 */
export function toInlineQuestionModel(value) {
  if (
    !isRecord(value) ||
    typeof value.prompt !== "string" ||
    !value.prompt.trim() ||
    !Array.isArray(value.options)
  ) {
    return null;
  }
  const options = value.options.map((option) => {
    if (!isRecord(option)) return null;
    const id = requireReferencePart(option.id);
    if (!id) return null;
    const label =
      typeof option.label === "string" && option.label.trim()
        ? option.label.trim()
        : id;
    return { id, label, correct: option.correct === true };
  });
  if (options.length === 0 || options.some((option) => option === null)) {
    return null;
  }
  const optionIds = new Set(options.map((option) => option.id));
  if (optionIds.size !== options.length) return null;

  const feedback = isRecord(value.feedback) ? value.feedback : {};
  return {
    exerciseTitle:
      typeof value.title === "string" ? value.title.trim() : "",
    prompt: value.prompt.trim(),
    selectionMode: "single",
    options: options.map(({ id, label }) => ({ id, label })),
    correctOptionIds: options
      .filter((option) => option.correct)
      .map((option) => option.id),
    hint:
      typeof feedback.incorrect === "string"
        ? feedback.incorrect.trim()
        : undefined,
    solution:
      typeof feedback.correct === "string"
        ? feedback.correct.trim()
        : undefined,
    retryIncorrect: value.retryIncorrect === true,
    completionAction:
      typeof value.completionAction === "string" &&
      value.completionAction.trim()
        ? value.completionAction.trim()
        : undefined,
  };
}

function createElement(tagName, styles, text) {
  const element = document.createElement(tagName);
  element.style.cssText = styles;
  if (text !== undefined) element.textContent = text;
  return element;
}

function orderedSelection(question, selectedOptionIds) {
  return question.options
    .map((option) => option.id)
    .filter((id) => selectedOptionIds.has(id));
}

function isCorrectSelection(question, selectedOptionIds) {
  const selected = orderedSelection(question, selectedOptionIds);
  const expected = new Set(question.correctOptionIds);
  return (
    selected.length === expected.size &&
    selected.every((optionId) => expected.has(optionId))
  );
}

function renderStatus(element, colors, message, role = "status") {
  const status = createElement(
    "p",
    `margin:0;color:${colors.feedback};font-size:13px;line-height:1.5;`,
    message,
  );
  status.setAttribute("role", role);
  element.replaceChildren(status);
}

function renderQuestion(
  element,
  kody,
  question,
  colors,
  behavior = {
    retryIncorrect: true,
    correctAction: "correct",
    incorrectAction: "incorrect",
    legacyResult: false,
    replyOnCorrect: true,
  },
) {
  let completed = false;
  let attempts = 0;
  const selectedOptionIds = new Set();
  const optionButtons = [];

  const container = createElement(
    "section",
    `direction:rtl;text-align:right;color:${colors.text};display:flex;flex-direction:column;gap:12px;font-family:inherit;`,
  );
  container.setAttribute("aria-label", question.exerciseTitle || "Question");

  if (question.exerciseTitle) {
    container.appendChild(
      createElement(
        "h3",
        "font-size:15px;font-weight:700;line-height:1.4;margin:0;",
        question.exerciseTitle,
      ),
    );
  }
  container.appendChild(
    createElement(
      "p",
      "font-size:14px;line-height:1.7;margin:0;white-space:pre-wrap;",
      question.prompt,
    ),
  );

  const feedback = createElement(
    "p",
    `min-height:18px;margin:0;color:${colors.feedback};font-size:13px;line-height:1.5;white-space:pre-wrap;`,
    "",
  );
  feedback.setAttribute("aria-live", "polite");

  function updateOptionAppearance(button, isSelected) {
    button.setAttribute("aria-pressed", isSelected ? "true" : "false");
    button.style.cssText = `display:block;width:100%;text-align:right;padding:10px 12px;border-radius:8px;border:1px solid ${
      isSelected ? colors.selectedBorder : colors.border
    };background:${
      isSelected ? colors.selected : colors.surface
    };color:inherit;cursor:pointer;font-size:14px;`;
  }

  function finish(selectedIds) {
    if (completed) return;
    attempts += 1;
    const correct = isCorrectSelection(question, new Set(selectedIds));
    if (!correct && behavior.retryIncorrect) {
      const message = question.hint || COPY.incorrect;
      feedback.textContent = message;
      kody.postToChat({ content: message });
      return;
    }

    completed = true;
    if (correct && behavior.replyOnCorrect) {
      const message = question.solution || COPY.correct;
      feedback.textContent = message;
      kody.postToChat({ content: message });
    }
    optionButtons.forEach((button) => {
      button.disabled = true;
    });
    kody.submitResult({
      actionId: correct ? behavior.correctAction : behavior.incorrectAction,
      data: behavior.legacyResult
        ? { selectedOptionId: selectedIds[0] }
        : {
            exerciseId: question.exerciseId,
            questionId: question.questionId,
            selectedOptionIds: selectedIds,
            correct,
            attempts,
          },
    });
  }

  const optionList = createElement(
    "div",
    "display:flex;flex-direction:column;gap:8px;",
  );
  for (const option of question.options) {
    const button = createElement("button", "", option.label);
    button.type = "button";
    updateOptionAppearance(button, false);
    button.onclick = () => {
      if (completed) return;
      if (question.selectionMode === "single") {
        finish([option.id]);
        return;
      }

      if (selectedOptionIds.has(option.id)) {
        selectedOptionIds.delete(option.id);
      } else {
        selectedOptionIds.add(option.id);
      }
      updateOptionAppearance(button, selectedOptionIds.has(option.id));
    };
    optionButtons.push(button);
    optionList.appendChild(button);
  }
  container.appendChild(optionList);

  if (question.selectionMode === "multiple") {
    const checkButton = createElement(
      "button",
      "align-self:flex-start;padding:9px 16px;border:0;border-radius:8px;background:#6d5bd0;color:#fff;cursor:pointer;font-size:14px;",
      COPY.check,
    );
    checkButton.type = "button";
    checkButton.onclick = () => {
      if (completed) return;
      const selectedIds = orderedSelection(question, selectedOptionIds);
      if (selectedIds.length === 0) {
        feedback.textContent = COPY.noSelection;
        return;
      }
      finish(selectedIds);
      if (completed) checkButton.disabled = true;
    };
    optionButtons.push(checkButton);
    container.appendChild(checkButton);
  }

  container.appendChild(feedback);
  element.replaceChildren(container);
}

/**
 * Mounts the widget in any compatible host. It has no GuidedFlow dependency.
 */
export default function mount(element, props) {
  const colors = props.theme === "light" ? COLORS.light : COLORS.dark;
  let disposed = false;
  let reference;
  let kody;

  try {
    kody = resolveKodyApi(props);
  } catch {
    renderStatus(element, colors, COPY.unavailable, "alert");
    return () => element.replaceChildren();
  }

  const inlineQuestion = toInlineQuestionModel(props.data);
  if (inlineQuestion) {
    renderQuestion(element, kody, inlineQuestion, colors, {
      retryIncorrect: inlineQuestion.retryIncorrect,
      correctAction: inlineQuestion.completionAction || "correct",
      incorrectAction: "incorrect",
      legacyResult: true,
      replyOnCorrect: Boolean(inlineQuestion.solution),
    });
    return () => element.replaceChildren();
  }

  try {
    reference = questionReferenceForMount(props.data);
  } catch {
    renderStatus(element, colors, COPY.unavailable, "alert");
    return () => element.replaceChildren();
  }

  renderStatus(element, colors, COPY.loading);
  Promise.resolve(props.cms.get(EXERCISES_COLLECTION, reference.exerciseId))
    .then((exercise) => {
      if (disposed) return;
      const question = toQuestionSelectModel(exercise, reference.questionId);
      renderQuestion(element, kody, question, colors);
    })
    .catch(() => {
      if (!disposed) {
        renderStatus(element, colors, COPY.unavailable, "alert");
      }
    });

  return () => {
    disposed = true;
    element.replaceChildren();
  };
}
