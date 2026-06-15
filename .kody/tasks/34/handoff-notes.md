Fixed CI Prettier failure in `.ai-docs/indexes/pattern-index.json`.

The `metadata.generatedAt` line lost its indentation during asymmetric merge conflict resolution (was unindented `"generatedAt` instead of `    "generatedAt"`). Prettier's `--check` caught it. Fixed by re-indenting the line to match the surrounding JSON structure. No other changes.
