# Classify agentAction

Read the issue, determine its type, and dispatch to the correct agentAction.

## How to classify

Read the issue title, body, and labels. Classify into one of:
- `bug` — something is broken, wrong, or crashes
- `enhancement` — improve existing functionality
- `feature` — new capability that doesn't exist yet
- `chore` — dependencies, config, tooling, cleanup, minor fixes
- `refactor` — restructure code without changing behavior
- `documentation` — docs, READMEs, comments

## How to dispatch

After classifying, post a comment on the issue with the dispatch command:
- `@kody chore` → runs chore agentAction
- `@kody fix` → runs fix agentAction (for bugs)
- `@kody feature` → runs feature agentAction
- `@kody enhancement` → runs enhancement agentAction
- `@kody refactor` → runs refactor agentAction
- `@kody documentation` → runs documentation agentAction

Use the GitHub comment tool to post: `body: "@kody <type>"`
Where `<type>` is the classified type.

## Output

Post the comment, then end with:
```
DONE
COMMIT_MSG: chore(agentActions): classify issue #<number> as <type>
PR_SUMMARY:
- Classified issue #<number> as **[type]**
- Dispatched via @kody <type>
```

<!-- kody:output-format (managed — edit above this line only) -->

# Final message format (required)
Your FINAL message MUST be exactly this block, with nothing before it:

DONE
PR_SUMMARY:
<your complete answer to the issue — this text is posted verbatim as a comment>

If you cannot answer, output a single line instead: FAILED: <reason>
