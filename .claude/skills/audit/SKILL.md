---
name: audit
description: Read-only audit of Fero's current state — branch vs main vs live, migration status, and release readiness. Use when the user asks for an audit, a status report, a "what's left" check, or wants to know the state of live vs local vs a branch before any code changes.
---

# Fero audit (read-only)

This is a **READ-ONLY** audit. Do not edit, commit, push, switch branches, or
run migrations. Another process (Codex) may be using this worktree — a branch
switch would break it.

## Output shape

Lead with a **2–3 sentence plain-English summary** before any technical detail.
No jargon without a one-line definition (see the glossary in `CLAUDE.md`).

Then produce these sections:

1. **Where things stand** — plain English, no file paths.
2. **Shipped** — what is done and verified.
3. **In progress** — what is half-done, and what specifically remains.
4. **Broken** — anything actually failing, with `file:line` evidence.
5. **Risky** — things that work but are fragile, with why.
6. **Remaining work** — prioritized P0/P1/P2, each with a rough effort estimate.

Mark anything you could not verify as **UNVERIFIED** with the reason. Never
guess and never present an inference as a finding.

## What to check

**Branch state**
- `git status`, `git log --oneline main..HEAD`, and `git diff main --stat`
- What does this branch change versus `main`, and is any of it duplicated work?
- Any uncommitted changes sitting in the worktree?

**Data safety** (the highest-value check — these have shipped as bugs before)
- Any place canonical DB rows are merged with legacy blob state. Flag every
  spot where canonical can unconditionally win, invent a month, or replace
  valid blob data with partial data.
- Any place an empty result set could be mistaken for an RPC failure.
- Any authenticated mutation that returns raw persisted blob state instead of
  going through `persistAndScopeReadableStateForUser(...)`.

**Duplicated computation**
- Values computed in more than one place — pace, prorated target, MAS,
  membership count, settlement amounts. List every call site. These are the
  source of "fixed it but the leaderboard still shows the wrong number".

**Import and refactor integrity**
- Identifiers referenced but never imported, especially in files that were
  recently split. This class of bug has shipped a blank screen before.

**Schema drift**
- Columns or tables the app reads that may not exist.
- Any JSONB path accessed with a guessed key — cross-check every one against
  `docs/SCHEMA.md`.

**Release readiness** (only when the user asks about launch)
- Auth flows, permissions, error states, offline behavior, privacy strings.
- Cross-check against `docs/app-store-submission-runbook.md`.

## Context to read first

- `CLAUDE.md` — the working agreement and data safety rules
- `docs/SCHEMA.md` — before any SQL
- `docs/recurring-debugging-playbook.md` — bugs that have already recurred
- The most recent `docs/handover-*.md` for the area under audit

## Finish by

Stopping. Do not propose or begin edits — the user decides what happens next
from the prioritized list.
