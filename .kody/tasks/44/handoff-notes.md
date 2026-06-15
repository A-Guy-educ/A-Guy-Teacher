Added @ai-summary JSDoc headers to all 13 modules in src/lib/latex-parser/.

Key design decisions:
- index.ts received a folder-level header (fileType=pipeline, domain=exercises) with the two entry points and the silent-skip preamble gotcha
- All MCQ parsers (mcq-exam-cls, mcq-enumitem, mcq-inline) have the same silent-default-first-option trap documented
- tikz-axis-parser notes the default viewport fallback; tikz-geometry-parser notes the circle radius threshold; enumerate-parser notes the itemsep heuristic
- No test changes needed — this is purely additive documentation
