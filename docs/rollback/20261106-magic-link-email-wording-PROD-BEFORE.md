# Rollback — sign-in email wording, 6 November 2026

Production Supabase project `bpvvvqjsfwmmfjvvijkd`, auth config. Two keys
changed, `Anté` → `Fero`, nothing else. Verified by diffing the whole config
before and after: `mailer_subjects_magic_link` and
`mailer_templates_magic_link_content` were the only keys that moved.

To put it back, PATCH `https://api.supabase.com/v1/projects/bpvvvqjsfwmmfjvvijkd/config/auth`
with exactly this body:

```json
{
  "mailer_subjects_magic_link": "Your Anté sign-in code",
  "mailer_templates_magic_link_content": "<h2>Your Anté sign-in code</h2>\n<p>Enter this code to sign in:</p>\n<p style=\"font-size: 32px; font-weight: 700; letter-spacing: 4px;\">{{ .Token }}</p>\n<p>This code will expire soon.</p>"
}
```

`smtp_sender_name` was already `Fero` and was not touched.
