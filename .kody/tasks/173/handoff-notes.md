## Task 173: docs-drift exercises (#163) — Handoff

**Conclusion: doc-irrelevant, no changes made.**

### What I investigated

- Read PR #163 body: removed `isAt85Percent` state, scroll-progress `useEffect`, and conditional wrapper around sticky bottom nav in `ExercisesPager` and `LessonPager`. Reverted a #1766 scroll-gating UX that never fired on short desktop content.
- Read both changed component files — confirms nav buttons are now unconditional.
- Read `docs/exercises/README.md` in full — it documents the Exercises *collection* (data model, block types, Zod schemas, Payload admin config, rendering). It does not describe UI interaction behavior.
- Searched all docs for "85", "scroll gate", "isAt85" — zero hits related to this feature.

### Why no doc update needed

The 85% scroll gate was an internal component implementation detail. It was never described in any documentation. The Exercises README is a collection reference doc, not a UX spec. The revert restores the original behavior (buttons always visible) which is what the doc implicitly describes.

### No code changes were made.
