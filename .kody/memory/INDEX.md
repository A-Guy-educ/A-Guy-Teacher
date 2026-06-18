# Kody memory index

One line per memory. The chat agent maintains this file — do not edit by hand.
Each entry: `- [Title](id.md) — one-line hook (type: <type>)`.
- [Short simple answers for this repo](short-simple-answers-for-this-repo.md) — User prefers concise, non-technical answers in this repo (type: user)
- [User prefers concise answers](user-prefers-concise-answers.md) — The user explicitly stated a preference for short, simple answers in responses. (type: user)
- [Kody does not address issues on goal branches directly](kody-does-not-address-issues-on-goal-branches-directly.md) — The Kody engine cannot directly address issues on goal branches; new work must be initiated from the default branch. (type: feedback)
- [for this repo provide shorter simpler answers](for-this-repo-provide-shorter-simpler-answers.md) — for this repo, provide shorter simpler answers (type: project)

- [Loadingmanager Singleton Test Pollution](loadingmanager-singleton-test-pollution.md) - asyncAction uses the real singleton by default — tests must use createAsyncAction(manager) (type: lesson)

- [Ai Summary Never Restates Code](ai-summary-never-restates-code.md) - @ai-summary captures why and trap, never what the code does (type: preference)

- [Ts Nocheck Files Documented](ts-nocheck-files-documented.md) - @ts-nocheck files get explicit @ai-summary warning about type safety (type: decision)

- [Genkit Toolcall Shape Mapping](genkit-toolcall-shape-mapping.md) - Genkit toolCalls: {toolName, arguments} ≠ UnifiedLLMProvider: {name, args} (type: lesson)

- [Scan For Duplicate Declarations](scan-for-duplicate-declarations.md) - After adding a new variable, scan for pre-existing same-name declarations in same scope (type: lesson)
