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

function normalizeQuestion(data) {
  if (!Array.isArray(data)) {
    return data && typeof data === "object" ? data : {};
  }
  const fields = new Map(
    data
      .filter((field) => field && typeof field.name === "string")
      .map((field) => [field.name, field]),
  );
  return {
    title: fields.get("title")?.value,
    prompt: fields.get("prompt")?.value,
    options: data.flatMap((field) => {
      if (!field?.name?.startsWith("option:")) return [];
      return [
        {
          id: field.name.slice("option:".length),
          label: field.label,
          correct: field.value === "correct",
        },
      ];
    }),
  };
}

export default function mount(element, props) {
  const question = normalizeQuestion(props.data);
  const options = Array.isArray(question.options) ? question.options : [];
  const colors = props.theme === "light" ? COLORS.light : COLORS.dark;
  let completed = false;

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
      completed = true;
      for (const candidate of optionList.children) candidate.disabled = true;
      props.complete(option.correct === true ? "correct" : "incorrect", {
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
  return () => element.replaceChildren();
}
