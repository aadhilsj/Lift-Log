# Invite Link Flow Handoff Note - 2026-07-31

Current scope built on `codex/reconcile-chat-with-backend`:

- Invite preview and web auth/join still use the existing invite flow.
- After a successful invite join, the user sees a one-time web confirmation screen:
  - `YOU'RE IN`
  - `[Bloc name] just got sharper.`
  - target, days-left, and a leaderboard glimpse with the new user tagged `NEW`
- `Let's go` marks that welcome as seen for that user and Bloc, then routes into the real Bloc Today screen.
- After a short delay in the web Bloc view, a dismissible download prompt appears:
  - `Log workouts from your phone. Get the app.`
  - App Store / Play Store buttons
- The web Bloc view remains usable if the prompt is ignored.

Important Step 6 decision:

Safari/web auth state and localStorage should not be assumed to survive into a native App Store install. The current branch writes a web-side handoff marker after invite join, but that only helps the same web/PWA context. A native app will need an explicit handoff mechanism.

Recommended native handoff plan:

1. After web invite join, generate an opaque one-time handoff token server-side, bound to the authenticated user, joined Bloc, invite code, and expiry.
2. Use Universal Links / App Links for the download/open path so the installed app receives that token.
3. Native app exchanges the token with the backend, validates the user/session, selects the joined Bloc, and routes directly to Today.
4. Mark the invite welcome as consumed server-side so the user does not see the invite welcome again in native.
5. If the token is missing or expired, fall back to sign-in, then select the user's joined Bloc after auth. Do not show cold onboarding for a user with an existing Bloc membership.

Do not pass Supabase access or refresh tokens through URLs. Use an opaque, one-time token and server-side exchange.
