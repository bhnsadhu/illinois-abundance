# Hidden features

The current site focuses on reading and publishing stories, plus Illinois Abundance events on campus. The review desk, post photos, search, topics, writer pages, reviewer accounts, and event RSVP/calendar/recap tools remain available.

The switches live in [features.ts](./features.ts). `true` means hidden; change a switch to `false`, run `npm run check`, commit/push, and redeploy to restore that feature on both the public site and the admin side. There is no database migration or data deletion.

| Switch | Preserved code | Hidden surfaces |
| --- | --- | --- |
| `learn` | `src/app/learn/`, Learn configuration in `src/lib/admin-config.ts` | Guides, Learn navigation, admin editor, mutation API, sitemap entries |
| `meetings` | `src/app/show-up/`, Meetings configuration in `src/lib/admin-config.ts` | Public-meeting listings, Show up navigation, admin editor, mutation API, sitemap entry |
| `newsletter` | `src/app/subscribe/`, `src/components/subscription-form.tsx`, `src/app/admin/digest/`, `src/components/admin/subscribers.tsx`, `src/lib/subscriptions.ts`, `src/lib/digest.ts` | Home signup, subscription pages/API, subscriber count and management, digest preview and sending |
| `exports` | `src/app/admin/export/`, `src/app/api/admin/export/` | Export navigation, dashboard action, CSV downloads |

Existing feature code, styles, schemas, records, and tests stay in their original locations. Navigation and conditional sections use these switches; `src/proxy.ts` redirects visits to hidden pages and returns an uncached 404 for hidden APIs before their handlers run. New hidden route families also need a literal entry in the proxy matcher.

Unsubscribe links and the one-click unsubscribe API remain functional for anyone who already received an email. Hiding the newsletter does not send email, clear subscribers, or delete digest progress.

The About, home, and event copy describes the current stories-and-campus-events focus. Re-enabling a feature restores its screens and controls; update that editorial copy separately if the group's focus changes.
