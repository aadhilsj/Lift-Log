# Invite Link Flow Handoff Note - Updated 2026-08-02

Current preview-branch scope:

- Invite links use `?invite=CODE`.
- The web app now bootstraps the invite context from the URL on load, so a link opens the target Bloc preview instead of the generic signed-out screen.
- The unauthenticated preview uses the real invited Bloc name, target, member count, and top visible leaderboard rows when the local app state has that Bloc.
- Joining through the invite-link path uses web auth and the already-loaded invite context, then grants real membership without asking for the invite code again.
- After a successful invite-link join, the user lands directly in the real Bloc Today screen with a short non-blocking `You're in` toast.
- The retired full-screen `YOU'RE IN` / `Go To Bloc` interruption must not be restored during reconciliation.
- Only invite-link joins can schedule the non-blocking download prompt. Invite-code joins from cold onboarding should not show that prompt.

Web-side handoff marker:

- On successful invite-link join, the web app stores `fero_invite_web_handoff` in localStorage with the joined user id, group id, invite code, and join timestamp.
- This marker is useful inside the same web/PWA context for proving the web side completed the invite flow and suppressing duplicate handoff behavior.
- This marker is not enough for App Store native handoff because Safari/localStorage does not automatically transfer into an installed native app.

Native Step 6 still required before App Store:

1. Add Universal Links / App Links for invite download/open paths.
2. Generate an opaque one-time server-side handoff token after web invite join, bound to the authenticated user, joined Bloc, invite code, and expiry.
3. Pass only that opaque token through the app-open link. Do not put Supabase access or refresh tokens in URLs.
4. Native app exchanges the token with the backend, validates it, restores/selects the joined Bloc, and routes directly to Today.
5. Mark the invite handoff consumed server-side so the same user does not see cold onboarding or a duplicate native invite interruption.
6. If the token is missing or expired, fall back to sign-in, then route to the already-joined Bloc after auth. Do not show cold onboarding to a user with an existing Bloc membership.

Decision:

- Build and test the complete web invite flow now through the real Bloc web view and optional download prompt.
- Treat native app handoff as an App Store/Capacitor-phase task. Do not mark it complete until the iOS shell and Universal Links are implemented and verified.
