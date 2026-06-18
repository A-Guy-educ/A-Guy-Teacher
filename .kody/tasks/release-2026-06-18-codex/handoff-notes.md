# Release Handoff (2026-06-18)

## What was done
- Created promotion PR #290: dev → main for v0.26.0 release
- Previous promotion PR #285 was closed (reason unknown - may need investigation)

## Current state
- Version: 0.26.0 (bumped on dev via PR #284, commit e406eef70)
- Last tag: v0.25.11
- Promotion PR: #290 (OPEN, awaiting merge)

## After merge
1. Run `release-publish` to tag the merged commit and create GitHub release
2. Verify Vercel production deploy

## Restrictions followed
- Did NOT tag before PR merge
- Did NOT auto-merge production PR
