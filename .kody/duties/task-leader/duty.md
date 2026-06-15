# Task Leader

## Job

Drive the work pipeline every 15 minutes: request missing reviews (code + UI), request fixes for PR concerns, auto-merge safe PRs, dispatch the next verified backlog task, and escalate stale PRs to the operator.

## Executable

Run the `task-leader` executable. Its skills and scripts own the implementation details.

## Allowed Commands

- Run the `task-leader` executable.

## Restrictions

- Stay within the duty's purpose and per-executable rules.
- Do not perform actions outside the contract defined by this duty.
- Do not bypass the auto-merge gates defined by `task-leader-rules`: normal PRs require both reviews and small-change checks; release lanes must satisfy their dedicated release gates.
- One tick = one pass = one rate-limit window. Do not loop.
- Do not edit source files or push branches.
