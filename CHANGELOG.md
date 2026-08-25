# Changelog

## v0.1.1 — 2026-08-25

### Features
- Add course management workspace (#18) (005a963a1)
- Proxy course-state PATCH through Web with service token (4e1e123e6)
- Active learners per course from users.currentCourse (#1093) (9a30bb6ae)
- Sync currentCourse + lastLoginAt to admin on 3 triggers (#1092) (aba630fd6)
- Track LLM token usage + spend cap + tokens tab (Batch B — 3 of 3) (#1090) (9e71733d7)
- Track lesson session duration + surface avg time per lesson and per type (7bdd45972)
- Track lesson opens and surface top-N on dashboard (35a39eba3)
- Group sections into Users / Content / Engagement / Revenue tabs (36582326d)
- Expand metrics — today bucket, growth %, median, stddev, year view (9fb648d8b)
- Port admin dashboard widgets with A-Guy-Web design system (0d1e8c04a)
- Add admin-gated /dashboard route with rewritten metrics API (4dfa7dc00)

### Fixes
- Keep Teacher brand link in dev (205af54d3)
- Keep Teacher dev navigation isolated (d5c2acddb)
- Keep stable Teacher dev origin (105109159)
- use current Vercel preview origin (cb0103982)
- allow Teacher Vercel dev login return (282aabaf3)
- install pnpm for dev deployments (cae6196ac)
- isolate Teacher API by environment (#19) (8ac145b75)
- complete Next lint dependencies (a52082513)
- declare Next lint dependency (3ba994fe3)
- Use requireUser guard on course-state proxy for lint (f396ad2d7)
- Address review nits on #1089 — session index, Zod cap, deps (d42c1679a)
- Address review nits on #1086 — index-safe lookup, dedup, race (43ca89bef)
- Two review nits — 7-card grid + flat trend renders as no-change (667baa6d2)
- Independent count for contentCounts.courses (bef678e3c)
- Address PR-B2 review — refetch guard, error state, i18n, locale (f8873d4d6)
- Move page under (frontend) route group + fold review nits (71a94bd3e)
- Transform outbound payload to dashboard's expected shape (5aaa64ce4)
- Validate /api/track batch shape and fix loadLessonContext relation resolution (3840300dc)
- Address review findings and unblock ci (1547f67e7)
- Include lesson context in chat (0e77f8964)

### Refactoring
- Replace Web clone with thin Teacher boundary (#17) (c08daab41)
- complete dashboard repository split (2dc67d0d5)
- move dashboard UI to dedicated app (bb8e2dcc3)

### Chores
- update meetings/מפת דרכים - המורה הפרטי של A-Guy.md (19aefadff)
- create meetings/מפת דרכים - המורה הפרטי של A-Guy.md (91bc02da6)
- create meetings/ file space (b64479839)
- add store workflow deploy-dev (b88c77a35)
- add store capability vercel-dev-deploy (28cf9e96d)
- remove store capability vercel-dev-deploy (4e73f4231)
- remove store workflow deploy-dev (fc830dd7b)
- update kody.config.json (81bde1393)
- add #20 (ba16adf94)
- enable Kody release pilot (#20) (61cb8fcce)
- add manually triggered dev deployment (b813d2c32)
- add #19 (b73679e9c)
- add #18 (4dd2549d0)
- add #17 (bf8406f84)
- add #1099 (3f7c332a2)
- release v0.33.0 (d3293f1e1)
- add #1098 (a43b4166d)
- add #1097 (b33dd6fd4)
- add #1096 (10af9d3ad)
- add #1094 (8d10d4df4)
- add #1093 (47f10910e)
- add #1092 (a07dd3208)
- add #1091 (c860399dd)
- Address token widget follow-ups L1, L2, L3 (#1091) (e196c2b54)
- add #1090 (f54afa605)
- add #1089 (58f5383ad)
- add #1086 (b9b8a166f)
- add #1088 (670fce70d)
- add #1087 (740d333ff)
- add #1085 (e9a604d37)
- add #1083 (b5549f9dd)
- add #1082 (86f5bde3e)
- Apply cleanup nits from earlier reviews (ffb699fd9)
- add #1081 (0b4aa24b6)
- add #1080 (e1d4149bf)
- Remove external dashboard tracking pipeline (cc2f7ea7f)
- add #1078 (5642ed094)
- add #1077 (ead3aa44f)
- release v0.32.0 (62f815599)
- add #1076 (ae69e08ea)
- add #1075 (362631f65)
- add #1074 (303e12f4e)
- set engine model (1409e8577)
- set engine model (09f531e58)
- set engine model (61811ac0d)
- add #1073 (9026dd23d)
- feat(analytics): wire event tracking to external dashboard + env kill-switch (fa81d59d1)
- add #1071 (d9699a98a)
- add #1070 (75c7cfb6b)
- release v0.31.7 (2ccb25002)
- add #1069 (7aa909b14)
- add #1068 (dd07a1774)
- add #1067 (a397f3eed)
- add #1066 (1a0904c4f)
- add #1065 (0435e5e38)

### Other
- Revert "chore: add manually triggered dev deployment" (aff4aba52)
- Revert "fix: install pnpm for dev deployments" (9ef0a8649)
- pause dashboard cutover during DNS propagation (6e6b73b95)
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

- chore: enable Kody release pilot ([#20](https://github.com/A-Guy-educ/A-Guy-Teacher/pull/20)) — @aguyaharonyair
- fix: isolate Teacher API by environment ([#19](https://github.com/A-Guy-educ/A-Guy-Teacher/pull/19)) — @aguyaharonyair
- feat: add course management workspace ([#18](https://github.com/A-Guy-educ/A-Guy-Teacher/pull/18)) — @aguyaharonyair
- refactor: Replace Web clone with thin Teacher boundary ([#17](https://github.com/A-Guy-educ/A-Guy-Teacher/pull/17)) — @aguyaharonyair
