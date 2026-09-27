# Fero App Store listing — agreed customer-facing copy

Date: 2026-09-27 (Europe/Oslo). Written by Claude, from a copy session with the
founder. Reviewed and approved by the founder line by line.

**Codex: this document is a handoff, not a permanent record. Delete it once the
copy is entered in App Store Connect and you no longer need it.** The decisions
worth keeping long term are in §"Why the copy reads this way" — move anything
you want to keep into the submission packet before deleting.

This document does not create an App Store Connect record, publish a URL, or
change Production.

---

## 1. Enter exactly this

### App name — 28 of 30 characters

```text
Fero: Fitness Accountability
```

### Subtitle — 30 of 30 characters

```text
Workout goals with your people
```

### Promotional text — 139 of 170 characters

```text
Pick your people, set a monthly workout target together, and log every session. See exactly where everyone stands as the month counts down.
```

### Keywords — 86 of 100 bytes

```text
gym,run,training,exercise,habit,streak,friends,group,tracker,buddy,monthly,consistency
```

### Description — 860 characters

```text
Fero is a workout-accountability app for the friends who help you keep showing up.

Create a Bloc — a private group of people you invite — and choose a monthly workout target together. Log workouts as you go, follow the leaderboard, and see how everyone is progressing.

With Fero you can:

• Create or join invite-only Blocs
• Set a shared monthly workout target
• Set the penalty for missing it
• Log workouts with optional notes and photos
• See progress, activity, reactions, and comments
• Review month-end results with your Bloc
• Report or block another member at any time
• Manage your profile, photos, and account from the app

Your Bloc decides its own penalty for a missed month, and members settle it between themselves. Fero keeps score — it never handles money or takes part in a settlement.

Your Bloc is the community that keeps you showing up.
```

### Categories

- Primary: Health & Fitness
- Secondary: Social Networking
- Age rating: from Apple's questionnaire on the final build. Do not assume one.

---

## 2. Action items for Codex

1. **The name in two docs is wrong.** `docs/app-store-submission-packet-2026-09-24.md`
   and `docs/app-store-listing-draft-2026-09-01.md` both say `Name: Fero`. The
   listing name is `Fero: Fitness Accountability`. Update both, and carry the
   copy in §1 into the packet as the agreed version.
2. **Screenshot 4 is the real review risk, not the text.** The storyboard's
   month-end result is the Results screen, which ends in settlement rows
   (`You owe £X`, `Owed to you`) and can show member payment handles. Frame the
   shot above the settlements. No real names, no payment handles.
3. **The App Review notes must be at least as specific as the description.**
   The description now names the penalty directly. The packet's existing
   settlement paragraph is correct — keep it verbatim, do not soften it.
4. **Type `Bloc`, never `block`.** Once it is in a public description it is
   permanent-feeling.
5. **Optional, still the founder's call:** a `• Chat with your Bloc in a shared
   stream` bullet. Bloc Stream is a live feature (`src/pages/Nav.jsx:8`, with its
   own nav icon and unread counts) that the listing does not mention. It was
   offered and deliberately left out; do not add it without asking.

---

## 3. One code change, already made on `main`

Claude made this change in this session. It is the only string that changed:

- `src/components/ColdOnboarding.jsx`, onboarding screen 4 headline:
  `"Show up together.", "Or pay up."` becomes
  `"Show up together.", "Or settle up."`

Screen 3 (`"Set a target. Set a penalty."` / `"Miss it, and you owe. Hit it,
and you're cleared."`) is **unchanged on purpose.** `penalty`, `owe` and
`cleared` match Today, the Month page and the Solo sheet word for word, and
changing onboarding alone would desynchronise three screens.

`pay up` appeared exactly once in `src/` and `api/`; there is no other
occurrence to chase.

---

## 4. Why the copy reads this way

Keep this section if you delete the rest.

- **The listing names the penalty on purpose.** An earlier draft mentioned no
  money at all and then closed by denying that Fero handles money, which reads
  as a disclaimer for something the reader was never told about. Meanwhile the
  app's own onboarding opens with "Set a target. Set a penalty." Apple's
  accurate-metadata rule (2.3) is where that gap gets questioned, so the
  description now states the mechanic once, plainly, before the disclaimer.
  Commitment-contract apps where users put their own money behind a goal are
  long established on the App Store; there is no wagering, no pool and no
  element of chance, so this is a disclosure question, not an eligibility one.
- **No gambling vocabulary anywhere.** An earlier draft denied operating a
  "prize pool", which plants a betting word in a reviewer's head and breaks the
  standing rule. The replacement — "Fero keeps score — it never handles money or
  takes part in a settlement" — states the same fact in the app's own words.
- **Fero is never described by what it is not.** The founder rejected four
  contrast lines in one session ("showing up rather than showing off", "no
  followers and no public feed", "not public follower counts", "nobody outside
  your group sees a thing"). A contrast line takes a swipe at the reader's other
  apps and frames Fero as a reaction to Strava rather than its own thing. State
  what Fero is.
- **`fitness` and `accountability` are not in the keywords.** Both are already
  in the listing name, and Apple indexes name, subtitle and keywords together,
  so repeating them wasted about 23 of 100 bytes. `leaderboard` was dropped as
  well — it is a feature, not something people search for. `gym` and `run` are
  literally Fero's own workout categories (`src/lib/appState.js:5`), so they are
  truthful as well as searchable. There are 14 bytes spare.
- **The subtitle carries search words, the promotional text does not need to.**
  Promotional text is not indexed and can be changed at any time with no build
  and no review, so it holds the least certain wording on purpose. Subtitle,
  keywords and description need a version submission to change.
- **"Community" is anchored to the Bloc.** The bare word in App Store copy makes
  people expect a public community with discovery and strangers, which Fero does
  not have. "Your Bloc is the community that keeps you showing up" keeps it
  inside the group, and bookends the first line of the description.
- **"Private" was removed from the opening sentence** at the founder's request —
  it set the wrong tone as the app's personality. It stays where it describes the
  Bloc, which is factual.
- **Say invite-only *Blocs*, not an invite-only *app*.** Anyone can download Fero
  and sign in; the groups are what require an invitation. Apple also requires a
  reviewer to be able to reach real content (2.1).
