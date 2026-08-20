# A-Guy-Dash Migration Plan

## Goal

Move the admin analytics dashboard out of A-Guy-Web into a separately deployed
`A-Guy-Dash` application at `https://dash.aguy.co.il` while preserving one
shared login across both applications.

## Ownership boundary

### A-Guy-Dash owns

- The dashboard page and dashboard-only UI components.
- Dashboard translations and required design primitives.
- A thin same-origin server proxy for authenticated dashboard requests.
- Dashboard-specific tests, deployment configuration, and documentation.

### A-Guy-Web continues to own

- Login, signup, OAuth, logout, session creation, and session revocation.
- User identity and authorization data.
- MongoDB and all database credentials.
- `/api/users/me` as the shared-session verification endpoint.
- `/api/dashboard-metrics` and its admin authorization.
- Dashboard metric aggregation, indexes, and website activity capture.

## Single sign-on contract

1. Users log in only through A-Guy-Web.
2. A-Guy-Web issues the existing HttpOnly `payload-token` cookie for the parent
   `aguy.co.il` domain.
3. The browser automatically includes that cookie when visiting
   `dash.aguy.co.il`.
4. A-Guy-Dash never reads, stores, logs, decodes, or verifies the cookie.
5. A-Guy-Dash forwards the incoming `Cookie` header server-side to
   `https://www.aguy.co.il/api/users/me` when it needs the current user.
6. Anonymous or expired sessions redirect to
   `https://www.aguy.co.il/login?returnTo=https://dash.aguy.co.il/`.
7. Logout calls A-Guy-Web's shared logout endpoint and ends the session across
   both applications.
8. A-Guy-Web's metrics endpoint remains the authorization authority and must
   reject non-admin users even if the Dash UI is bypassed.

A-Guy-Dash must never receive `PAYLOAD_SECRET`, `DATABASE_URL`, direct user
database access, or its own login/session implementation.

## Implementation phases

### 1. Establish the new repository

- Create public repository `A-Guy-educ/A-Guy-Dash` to match A-Guy-Web.
- Start from the latest A-Guy-Web history so the extracted code keeps useful
  provenance.
- Change package metadata, documentation, environment examples, application
  identity, and deployment configuration.
- Remove all unrelated website, CMS, learning, checkout, chat, content, and
  administration code.
- Keep the finished repository minimal rather than maintaining a second copy
  of A-Guy-Web.

### 2. Move the dashboard UI

- Move the current `/dashboard` page and its dashboard-only components into the
  new application root.
- Preserve its week, month, and year selection behavior.
- Move only the shared UI primitives, design tokens, fonts, and translations it
  actually uses.
- Replace its current same-repository metrics call with the Dash proxy.

### 3. Add the Dash server boundary

- Resolve the current user by forwarding the incoming cookie to A-Guy-Web's
  `/api/users/me` endpoint.
- Add a same-origin `/api/dashboard-metrics` proxy which forwards the cookie and
  validated period to A-Guy-Web.
- Preserve upstream 400, 401, 403, and 500 behavior.
- Use `Cache-Control: no-store` for all private responses.
- Never expose cookies, tokens, secrets, stack traces, or upstream internals in
  client responses or logs.

### 4. Remove the dashboard UI from A-Guy-Web

- Remove dashboard pages, dashboard-only UI components, dashboard-only
  translations, and UI tests from A-Guy-Web.
- Keep the metrics endpoint, metric types, aggregations, required indexes, and
  activity tracking.
- Replace `/dashboard` with a server-side redirect to
  `https://dash.aguy.co.il/` so existing bookmarks do not break.

### 5. Deploy and cut over

- Deploy A-Guy-Dash to its own hosting project.
- Attach `dash.aguy.co.il` over HTTPS.
- Deploy the A-Guy-Web redirect and retained API.
- Do not remove the working Web dashboard until the Dash deployment and shared
  login path are ready for cutover.

## Required tests

### A-Guy-Dash

- Anonymous requests redirect to the central login with the exact Dash return
  URL.
- A valid shared session is recognized without another login.
- Non-admin users cannot read dashboard metrics.
- Admin users can render real dashboard metrics.
- Week, month, and year selection works.
- The proxy validates the period and preserves upstream error statuses.
- Cookie and token values never enter browser-readable state or logs.
- Logout ends the shared session.
- Typecheck, lint, focused tests, and production build pass.

### A-Guy-Web

- `/dashboard` redirects to A-Guy-Dash.
- `/api/dashboard-metrics` remains authenticated and admin-only.
- Existing metric collection and activity tracking continue to work.
- Login accepts the HTTPS Dash return URL.
- Shared logout still revokes the session.
- Typecheck, lint, focused tests, and production build pass.

## Real-path acceptance test

1. Log in at `www.aguy.co.il`.
2. Open `dash.aguy.co.il` and confirm no second login is required.
3. Confirm an admin can load real metrics and change periods.
4. Confirm a non-admin receives no dashboard data.
5. Log out from Dash and confirm Web is also logged out.
6. Visit the old Web `/dashboard` URL and confirm it redirects to Dash.

The migration is complete only after all six checks pass in production.

## Delivery report

Report the two repositories independently:

- Files and responsibilities moved.
- Responsibilities intentionally retained in A-Guy-Web.
- Tests and builds run.
- Commit and push results.
- Deployment and domain results.
- Real SSO, authorization, metrics, logout, and redirect evidence.
- Anything implemented but not verified on the real path.
