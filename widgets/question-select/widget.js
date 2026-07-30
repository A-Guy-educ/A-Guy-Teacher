const COLORS = {
  light: {
    text: "#23261f",
    border: "#d6d8cc",
    surface: "#f6f6f1",
  },
  dark: {
    text: "#e6e7df",
    border: "#3a3d33",
    surface: "#242720",
  },
};

function createElement(tagName, styles, text) {
  const element = document.createElement(tagName);
  element.style.cssText = styles;
  if (text !== undefined) element.textContent = text;
  return element;
}

export default function mount(element, props) {
  const question =
    props.data && typeof props.data === "object" && !Array.isArray(props.data)
      ? props.data
      : {};
  const options = Array.isArray(question.options) ? question.options : [];
  const feedback =
    question.feedback &&
    typeof question.feedback === "object" &&
    !Array.isArray(question.feedback)
      ? question.feedback
      : {};
  const cmsContext =
    question.cmsContext &&
    typeof question.cmsContext === "object" &&
    !Array.isArray(question.cmsContext)
      ? question.cmsContext
      : null;
  const colors = props.theme === "light" ? COLORS.light : COLORS.dark;
  let completed = false;
  let disposed = false;

  const container = createElement(
    "section",
    `direction:rtl;text-align:right;color:${colors.text};display:flex;flex-direction:column;gap:12px;font-family:inherit;`,
  );
  container.setAttribute("aria-label", question.title || "Question");

  if (question.title) {
    container.appendChild(
      createElement(
        "h3",
        "font-size:15px;font-weight:700;line-height:1.4;margin:0;",
        question.title,
      ),
    );
  }
  container.appendChild(
    createElement(
      "p",
      "font-size:14px;line-height:1.6;margin:0;white-space:pre-wrap;",
      question.prompt || "",
    ),
  );

  if (
    cmsContext &&
    typeof cmsContext.collection === "string" &&
    typeof props.cms?.list === "function"
  ) {
    const contextLine = createElement(
      "p",
      "font-size:12px;line-height:1.5;margin:0;opacity:.75;",
      "Loading lesson context…",
    );
    container.appendChild(contextLine);
    props.cms
      .list(cmsContext.collection, { limit: 1 })
      .then((result) => {
        if (disposed) return;
        const document = result.docs[0];
        const labelField =
          typeof cmsContext.labelField === "string"
            ? cmsContext.labelField
            : "title";
        const label =
          document && typeof document[labelField] === "string"
            ? document[labelField]
            : null;
        const prefix =
          typeof cmsContext.prefix === "string"
            ? cmsContext.prefix
            : "Lesson source";
        contextLine.textContent = label
          ? `${prefix}: ${label}`
          : `${prefix}: no matching lesson`;
      })
      .catch(() => {
        if (!disposed) contextLine.textContent = "Lesson context unavailable.";
      });
  }

  const optionList = createElement(
    "div",
    "display:flex;flex-direction:column;gap:8px;",
  );
  for (const option of options) {
    if (!option || typeof option.id !== "string") continue;
    const button = createElement(
      "button",
      `display:block;width:100%;text-align:right;padding:10px 12px;border-radius:8px;border:1px solid ${colors.border};background:${colors.surface};color:inherit;cursor:pointer;font-size:14px;`,
      typeof option.label === "string" ? option.label : option.id,
    );
    button.type = "button";
    button.onclick = () => {
      if (completed) return;
      const isCorrect = option.correct === true;
      if (!isCorrect && question.retryIncorrect === true) {
        props.reply(
          typeof feedback.incorrect === "string"
            ? feedback.incorrect
            : "Not quite. Try again.",
        );
        return;
      }
      completed = true;
      for (const candidate of optionList.children) candidate.disabled = true;
      if (isCorrect && typeof feedback.correct === "string") {
        props.reply(feedback.correct);
      }
      const completionAction =
        typeof question.completionAction === "string"
          ? question.completionAction
          : isCorrect
            ? "correct"
            : "incorrect";
      props.complete(completionAction, {
        selectedOptionId: option.id,
      });
    };
    optionList.appendChild(button);
  }
  container.appendChild(optionList);

  if (options.length === 0) {
    container.appendChild(
      createElement(
        "p",
        "font-size:12px;color:#b05a2a;margin:0;",
        "This question has no answer options.",
      ),
    );
  }

  element.replaceChildren(container);
  return () => {
    disposed = true;
    element.replaceChildren();
  };
}
