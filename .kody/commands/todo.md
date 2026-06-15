---
description: Create a todo list in .kody/context/todo.md with check/uncheck and generate issues
argument-hint: [create | list | check | uncheck | generate]
---

# Create Todo

Manage a todo list stored at `.kody/context/todo.md`.

## Requirements
- Format: flat list, numbered 1–12, ✅ for done, empty checkbox for not done
- Always read the existing file FIRST before making any changes
- Never guess or assume what is in the file — always read it first
- The file must contain ALL original 12 items:
  1. Landing page — Old page exists, HTML demo exists | Replace old page with demo
  2. Entry flow (who/which grade) — Old + demo exists | Replace old with demo
  3. Unified intro page — Demo exists, but admin field management + web page missing | Intro page matching demo, editable in admin
  4. Lesson intro page — Demo exists | Displayed after entry, editable in admin
  5. Mobile learning UX — Non-unified, 2 different question buttons | Fullscreen exercises, formulas + notes embedded (demo ready)
  6. Exercises as system exercises — 10 exercises per lesson, non-unified structure | Convert to system exercises in unified format
  7. Automated payment — Shi's system exists, untested | One-time payment → 3-month access, discounts, Apple/Google Pay
  8. Invoice + cancellation — System untested | Accessible automated payment, invoice by email, cancellation option
  9. Bug fixes — Non-blocking for launch — clear explanations, solutions, notes + SVG/graphs/diagrams
  10. Learning plan builder — Static, not accessible enough | User-facing plan builder by requirement → relevant lessons tagged
  11. Bug/feedback reporting — Agent button exists, inactive | Report issues + feedback via question button
  12. Answer explanation quality — Sometimes unclear | Clear explanations, solutions, notes + SVG/graphs/diagrams

## Sub-commands

### create
Write the complete 12-item list to `.kody/context/todo.md`. Replace the entire file — never merge.

### list
Read `.kody/context/todo.md` and display it as a clean markdown checklist. Show done items with ✅, unchecked items with ☐.

### check [number]
Read the file first, then mark item [number] as done by adding ✅ next to it. Preserve all other items exactly as they are.

### uncheck [number]
Read the file first, then remove ✅ from item [number]. Preserve all other items exactly as they are.

### generate
Read `.kody/context/todo.md`, find all unchecked items, and offer to create GitHub issues for each one. Show the proposed issue titles first for approval before creating anything.

## Rules
- ALWAYS read the file before writing to it
- Never write based on memory or assumption — always read first
- Only modify the specific item requested — never rewrite the whole file for check/uncheck
- For generate: show proposed issues first, wait for approval, then create
