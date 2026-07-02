# LiftLog local dev

This local environment is separate from the live LiftLog app your current group uses.

## What is local vs live

- Live app: your real users and real data
- Local app: your private development sandbox on this Mac

Nothing in the local setup changes the live group unless you explicitly promote code and data later.

## Local Supabase services

- Project URL: `http://127.0.0.1:54321`
- Studio: `http://127.0.0.1:54323`
- Database: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`

## Local app env file

The app-side local environment file is:

- [.env.local](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/.env.local:1)

It points the app at the local Supabase backend and uses a local-only admin PIN.

For the current settlement-card preview work, `.env.local` also enables:

- local preview auth: choose a member name locally instead of waiting for an email OTP
- settlement-card preview mode: renders mock settlement cards without requiring canonical DB setup

Important:

- this local setup is currently suitable for **UI preview**
- it is **not** the preferred environment for validating the real settlement confirmation SQL path
- real settlement testing should move to a safe hosted Supabase branch or another non-live database with the full `ante_core` baseline applied

## Run the app locally

From this project folder:

```bash
set -a
source .env.local
set +a
node scripts/local-dev-server.mjs
```

Then open:

- `http://127.0.0.1:3000`

## Local data

The local database has already been seeded with a copied LiftLog state from the current app.

This means you can safely work on the new group-agnostic version here without interrupting the live group.

## Local Supabase project files

- [supabase-local/supabase/config.toml](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase-local/supabase/config.toml:1)
- [supabase-local/supabase/migrations/20260531170500_lift_log_state.sql](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase-local/supabase/migrations/20260531170500_lift_log_state.sql:1)
- [supabase-local/supabase/seed.sql](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase-local/supabase/seed.sql:1)

## Hard rule before going live

Before any promotion from local to live:

- take a fresh backup of live data first

That rule is mandatory for this project.
