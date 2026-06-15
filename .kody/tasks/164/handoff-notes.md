## Issue #164: Remove /start fallback from root page

**What was done:**
Removed the `if (!homePage) { redirect('/start') }` block from `src/app/(frontend)/page.tsx` lines 20-24. When no home page exists in the CMS, the page now falls through to the `Redirects` component instead of auto-redirecting to `/start`.

**Why:**
The Hebrew comment in the issue explains this is a UX improvement — the root page should render normally (showing whatever the Redirects component decides) rather than always bouncing to `/start` when there's no home page in the CMS.

**Remaining behavior:**
- If `redirectItem` exists: falls through to `Redirects` component
- If `homePage?.hero` exists: renders `RenderHero`
- Otherwise: falls through to `Redirects disableNotFound url="/"` (will show notFound or handle redirects)

**Tests:** No existing tests specifically tested this redirect behavior. QA tests use `/start` as a direct URL entry point, not via root redirect.
