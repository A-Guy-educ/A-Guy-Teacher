// A-Guy exercise player — kody widget (contract v1: default export mount).
// props: { data: { title, progress, questions: [...] }, theme, complete }
// question: { type: "select"|"free", prompt, options?: [{id,label,correct}],
//             hint?, solution? }
export default function mount(element, props) {
  const d = props.data ?? {};
  const questions = Array.isArray(d.questions) ? d.questions : [];
  const dark = props.theme !== "light";
  const state = { index: 0, wrong: 0, answers: {}, correct: 0 };

  const css = {
    box: `direction:rtl;text-align:right;font-family:inherit;color:${dark ? "#e6e7df" : "#23261f"};display:flex;flex-direction:column;gap:12px;`,
    title: "font-size:15px;font-weight:700;margin:0;",
    meta: `font-size:12px;opacity:.7;`,
    prompt: "font-size:14px;line-height:1.6;margin:0;white-space:pre-wrap;",
    btn: `display:block;width:100%;text-align:right;padding:10px 12px;margin:0 0 8px;border-radius:8px;border:1px solid ${dark ? "#3a3d33" : "#d6d8cc"};background:${dark ? "#242720" : "#f6f6f1"};color:inherit;cursor:pointer;font-size:14px;`,
    good: "border-color:#4f8f3f;background:rgba(79,143,63,.15);",
    bad: "border-color:#b05a2a;background:rgba(176,90,42,.12);",
    hint: `padding:10px 12px;border-radius:8px;background:rgba(176,90,42,.12);border:1px solid #b05a2a;font-size:13px;line-height:1.6;`,
    sol: `padding:10px 12px;border-radius:8px;background:rgba(79,143,63,.12);border:1px solid #4f8f3f;font-size:13px;line-height:1.6;white-space:pre-wrap;`,
    input: `width:100%;box-sizing:border-box;padding:10px 12px;border-radius:8px;border:1px solid ${dark ? "#3a3d33" : "#d6d8cc"};background:transparent;color:inherit;font-size:14px;`,
    primary: `padding:10px 16px;border-radius:8px;border:none;background:#6d5bd0;color:#fff;font-size:14px;cursor:pointer;`,
  };

  const el = (tag, style, text) => {
    const node = document.createElement(tag);
    if (style) node.style.cssText = style;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  function finish() {
    props.complete("done", {
      answers: state.answers,
      correct: state.correct,
      total: questions.length,
      wrongAttempts: state.wrong,
    });
  }

  function render() {
    element.textContent = "";
    const box = el("div", css.box);
    const q = questions[state.index];
    if (!q) return finish();

    box.appendChild(el("div", css.meta, `${d.progress ?? ""} · שאלה ${state.index + 1} מתוך ${questions.length}`));
    if (d.title) box.appendChild(el("h4", css.title, d.title));
    box.appendChild(el("p", css.prompt, q.prompt ?? ""));

    const showHint = state.attemptsWrong > 0 && q.hint;
    if (showHint) box.appendChild(el("div", css.hint, `רמז: ${q.hint}`));

    const next = (wasCorrect) => {
      if (wasCorrect) state.correct += 1;
      state.index += 1;
      state.attemptsWrong = 0;
      render();
    };

    if (q.type === "select") {
      for (const opt of q.options ?? []) {
        const b = el("button", css.btn, opt.label);
        b.onclick = () => {
          state.answers[`q${state.index + 1}`] = opt.label;
          if (opt.correct) {
            b.style.cssText = css.btn + css.good;
            setTimeout(() => next(state.attemptsWrong === 0), 350);
          } else {
            state.wrong += 1;
            state.attemptsWrong = (state.attemptsWrong ?? 0) + 1;
            b.style.cssText = css.btn + css.bad;
            render();
          }
        };
        box.appendChild(b);
      }
    } else {
      const input = el("input", css.input);
      input.placeholder = "התשובה שלך";
      box.appendChild(input);
      const check = el("button", css.primary, "בדיקה");
      check.onclick = () => {
        state.answers[`q${state.index + 1}`] = input.value;
        element.textContent = "";
        const rev = el("div", css.box);
        rev.appendChild(el("div", css.meta, `שאלה ${state.index + 1} מתוך ${questions.length}`));
        rev.appendChild(el("p", css.prompt, "השוו את התשובה שלכם לפתרון המלא:"));
        rev.appendChild(el("div", css.sol, q.solution ?? q.hint ?? ""));
        const row = el("div", "display:flex;gap:8px;");
        const yes = el("button", css.primary, "✔ צדקתי");
        yes.onclick = () => next(true);
        const no = el("button", css.btn + "width:auto;", "טעיתי");
        no.onclick = () => { state.wrong += 1; next(false); };
        row.appendChild(yes);
        row.appendChild(no);
        rev.appendChild(row);
        element.appendChild(rev);
      };
      box.appendChild(check);
    }
    element.appendChild(box);
  }

  render();
  return () => { element.textContent = ""; };
}
