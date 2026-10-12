# Illinois Abundance

Student writing on local policy in Champaign Urbana. Readers need no account. Students verify an Illinois email before submitting; reviewers edit and publish; one configured admin manages the site and sends the optional digest.

Live site: **https://abundance.bhanusadhu.com**. The initial deployment includes clearly labeled sample content. The configured admin signs in at `/login` with `bhnsadhu@gmail.com`.

Built with Next.js 16, React 19, TypeScript, Neon Postgres, private Vercel Blob storage, and Resend. Passwordless reviewer authentication is implemented by the app using database-backed, single-use links and sessions.

## Run locally

Use **Node.js 24.x** and npm. Development was verified on Node 24.16.0. The installed test runner supports Node 22.x from 22.12, 24.x, or 26+; use 24.x consistently locally and on Vercel.

```sh
npm ci
cp .env.example .env.local
```

Fill in `.env.local` using the setup below. Copy the example only when creating the file; preserve existing credentials. Then:

```sh
npm run migrate
npm run seed
npm run dev
```

Open **http://localhost:3000**, matching `NEXT_PUBLIC_SITE_URL`. Without a database, `SEED_SAMPLE_CONTENT=true` provides a labeled reading preview; submissions, authentication, subscriptions, and admin work require connected services. Missing services return a useful failure instead of pretending to save or send.

## Connect the services

1. **Neon:** reuse the existing project, or create a Free plan project through the [Vercel Neon integration](https://vercel.com/marketplace/neon/neon) or the Neon console. Choose a region close to the app. Copy its pooled connection into `DATABASE_URL` and its direct connection into `DATABASE_URL_UNPOOLED`. Use the project owner role for migrations and the current server adapter. The direct hostname must not contain `-pooler`. Review current service limits before launch; a free database does not make the entire stack unlimited.
2. **Private covers:** create a Vercel Blob store with **Private** access, attach it to the Vercel project, and set `BLOB_READ_WRITE_TOKEN` locally and in the deployment. The application streams approved covers through `/covers/...`; it never gives readers a storage credential. Follow the [private Blob setup](https://vercel.com/docs/vercel-blob/private-storage).
3. **Resend:** add the sending domain and publish the DNS records supplied by Resend. Wait for verification before using that domain in `MAIL_FROM`. Create an API key with **Sending access**, restricted to that domain, and store it as `RESEND_API_KEY`. [Resend documents these key permissions](https://resend.com/changelog/new-api-key-permissions). Domain verification and school inbox delivery are separate checks.
4. **Site identity:** set the canonical URL, contact address, and exactly one `ADMIN_EMAIL`. Generate separate random secrets for `CODE_PEPPER` and `VIEW_SALT`; each must contain at least 32 characters. For each secret, generate a new value locally:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Keep generated values in the environment manager, never in source, screenshots, or issue comments. `.env.local` and Vercel metadata are ignored by Git.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Exact canonical origin, including `https://` in production. Used for links, metadata, and origin checks. |
| `DATABASE_URL` | Pooled Neon connection, server only. |
| `DATABASE_URL_UNPOOLED` | Direct Neon connection for migration and seed scripts. |
| `BLOB_READ_WRITE_TOKEN` | Credential for the **private** cover store. |
| `RESEND_API_KEY` | Domain-restricted sending key. |
| `MAIL_FROM` | Verified sender, for example `Illinois Abundance <hello@illinoisabundance.org>`. |
| `CONTACT_EMAIL` | Public contact and removal-request mailbox. |
| `ADMIN_EMAIL` | The one email with admin privileges. Other reviewers are managed in the admin UI. |
| `CODE_PEPPER` | HMAC secret for verification codes, login/session hashes, signed digest previews, and rate-limit keys. |
| `VIEW_SALT` | Separate HMAC secret for daily view estimates. |
| `SEED_SAMPLE_CONTENT` | `true` allows sample seeding and the disconnected preview. Use `false` for launch. |

Only the site URL is a `NEXT_PUBLIC_*` variable. Never expose database, storage, mail, or signing secrets to client components. Rotating `CODE_PEPPER` invalidates outstanding codes, login links, sessions, and digest preview signatures.

## Database changes and seed data

`npm run migrate` reads `.env.local`, requires the direct connection, and applies `db/migrations/*.sql` in order. It holds a database lock and runs each migration in a transaction. Applied filenames and checksums are recorded in `schema_migrations`. **Never edit an applied migration:** add a new numbered migration, test it on an isolated branch, and run the migration command again.

`npm run seed` always creates the six foundational topics and activates the configured admin reviewer. With `SEED_SAMPLE_CONTENT=true`, it also adds the labeled sample articles, writers, events, explainers, and meetings. Existing IDs are preserved rather than overwritten. Seeding is explicit; deployment does not run it automatically.

Use a separate Neon branch for development and previews. A branch copied from production may contain private originals and subscriber information; use a fresh schema and sample data for less trusted collaborators. Do not test disposable submissions against the production archive: genuine verified originals are deliberately permanent.

## Deploy on Vercel

1. Import the Git repository and select the Next.js preset. Select **Node.js 24.x** in project settings; Vercel supports that runtime. [Runtime settings](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).
2. Attach Neon and the private Blob store. Add the remaining environment variables in the appropriate environments. Set the production `NEXT_PUBLIC_SITE_URL` to the final HTTPS origin and `SEED_SAMPLE_CONTENT=false`.
3. From a trusted local environment targeting the intended database, run `npm run migrate`, then `npm run seed`. Inspect the target before running either command.
4. Run `npm run check`, deploy, and complete the launch checks below. Vercel runs `npm run build`; database scripts are separate operational actions.

Preview deployments should have their **own database branch, private store, sending configuration, and exact site URL**. A preview using the production site URL intentionally fails browser origin checks, and its emails point to production. Use a stable preview domain or set the preview's actual URL and rebuild. Do not weaken origin checks to make previews work.

Cover uploads accept still JPG, PNG, WebP, or AVIF images up to **4 MB**, require alt text, and are decoded and re-encoded as WebP with metadata removed. The limit leaves room for multipart overhead within [Vercel's function request limit](https://vercel.com/docs/functions/limitations).

## Review and administration

Open `/login` and request a link for `ADMIN_EMAIL`. Links expire after 15 minutes and work once; sessions last seven days. Current roster membership is checked on every private request. Use `/admin/reviewers` to add or deactivate reviewers, who then sign in through the same page. There are no reader accounts or passwords.

In `/review`, claim a submission, email the author from your own inbox, and paste the agreed final version. Publishing requires a headline, short version, body, byline, and active topic. Revision checks prevent a second reviewer from silently overwriting a concurrent edit. Editing the published version leaves the original unchanged. To honor a removal request, **unpublish** it and confirm the public link is no longer available.

The admin manages topics, writers, events, explainers, meetings, subscribers, statistics, and CSV exports. The configured admin cannot be removed, disabled, or reassigned through the roster UI. To hand over administration, update `ADMIN_EMAIL` in the deployment and redeploy, verify the new admin can sign in, then deactivate the previous admin's reviewer row if they should no longer review. Changing the environment removes their admin privilege; it does not automatically remove ordinary reviewer membership.

## Subscriptions and the manual digest

Any email can request a subscription. The address is eligible for digests only after the confirmation link is opened. Requesting again preserves an existing confirmed subscription and its unsubscribe token. Confirmation and digest emails include an unsubscribe link and the one-click email-client headers. `/unsubscribe?token=...` supports human visits and RFC 8058 POST requests without a login.

At `/admin/digest`, review pieces published during the previous seven days and the next teach in. An event-only digest is allowed; an empty week has nothing to send. **No cron or automatic campaign starts a digest.** Pressing Send starts sequential batches of up to eight recipients. Keep the page open to continue the batches, pause after a batch, or return and resume later.

The preview is signed and expires after 30 minutes. Each send saves a content snapshot and recipient progress. The same content started again on the same UTC day reuses its existing job. Completed recipients stay completed; unsubscribed recipients are skipped. A changed or unpublished piece stops a paused digest until a new preview is reviewed.

On a mail outage, use **Retry remaining deliveries**. Do not delete delivery logs or create another campaign merely to bypass a failed send. Stable provider keys protect retries after an interrupted response. Resend retains those keys for [24 hours](https://resend.com/changelog/idempotency-keys), so an unresolved attempt older than 23 hours is held as **uncertain**. A maintainer must compare the private delivery log with Resend's records before resolving that state; blindly resetting it can send duplicates. A busy batch lease clears after two minutes if its request dies.

Application emails are submission codes, submission receipts, reviewer login links, subscription confirmation, and manually requested digests. Author/reviewer editorial correspondence happens outside the app. Finishing or pausing outstanding digest jobs before changing the sending identity or domain keeps retry payloads consistent.

## Privacy and recovery

Public database reads use explicit views inside a transaction that assumes the `anon` role. Row-level security restricts published rows. Author email, original body, claim information, internal notes, subscribers, and delivery logs are excluded from public responses, feeds, search, and generated share images. Server mutations use the owner connection after authorization, validation, origin checks, and distributed rate limits. That owner credential is powerful and must remain private.

The private original-submission table has update, deletion, and truncation guards. Published text remains editable, and sample cleanup can remove only marked samples. Database ownership can alter these protections, so preserving the archive also requires access control and backups. Raw verification codes and reviewer login/session tokens are not stored; subscribers retain their email, confirmation time, and opaque unsubscribe token. Private delivery logs track digest progress.

Views are **estimates**, deduplicated per article and UTC day using a salted hash of the trusted platform IP and user-agent string. Raw values are not stored. Shared networks and identical browsers can undercount; changed networks or clients can overcount. There is no third-party analytics script or cross-day reader profile. Local development shares one rate-limit IP bucket.

Download published or private submission CSVs from `/admin/export`. Private exports contain originals and author emails: keep them in access-controlled, encrypted storage. CSVs are useful records, but are not full application backups. Use the direct connection for a PostgreSQL backup and back up private Blob objects separately; preserve object paths. Test restores on an isolated database. Never put exports or backups under `public/` or in Git.

## Checks and launch

```sh
npm run lint
npm run typecheck
npm test
npm run build
# Or run all four in order:
npm run check
# Focus on the core database/RLS suite:
npm run test:db
```

Final validation passed **155 tests**, lint, typecheck, and production build. Tests include PostgreSQL/RLS behavior using PGlite, HTTP handlers using the production SQL adapter with mocked Neon transport, authentication, submission verification, private covers, admin permissions, digest retries, share images, and a submit → verify → claim → publish → homepage workflow. Mail delivery is mocked. Passing those tests does not verify a real school inbox, DNS, production service quotas, or physical phone behavior; viewport emulation is not a hardware test.

Local production-build Lighthouse performance scores were **100 desktop / 94 mobile** for home and **100 desktop / 91 mobile** for an article. All four runs recorded zero layout shift. These are measured snapshots, not guarantees across devices or network conditions.

Before announcing the site:

- [ ] Confirm the production origin, verified sender, contact mailbox, sole admin, and environment scopes.
- [ ] Use an isolated preview to test a real `@illinois.edu` code, wrong/expired code, resend, and the saved-submission receipt. Check spam folders and mail-provider delivery records.
- [ ] Test real admin/reviewer magic links, a revoked reviewer, publish/edit/unpublish, and private cover access.
- [ ] Confirm a subscription, unsubscribe through the email link and email-client action, and send a digest only to consenting test recipients in the isolated environment.
- [ ] Publish real articles first. Review bylines, sources, alt text, dates, RSVP/agenda links, removal contact, and share images.
- [ ] Set `SEED_SAMPLE_CONTENT=false`, use the admin's **Delete sample content** action, and verify the public pages contain the intended real content. Do not rerun sample seeding afterward.
- [ ] Check keyboard navigation, focus and error messages, reduced motion, 375px layouts, and at least one physical phone. Run production Lighthouse checks on home and an article.
- [ ] Verify RSS, sitemap, canonical URLs, HTTPS, private exports, and an isolated backup restore. Confirm current Neon, Vercel, Blob, and Resend usage limits.

## Move ownership or domain

Transfer the repository, Vercel project and private Blob store, Neon project, Resend sending setup, and DNS/domain access to the organization's accounts. Give the incoming maintainers access before removing the outgoing owner. Preserve the existing database and cover paths; if a service must be recreated, migrate and verify its complete data before switching credentials.

To move from a personal subdomain to `illinoisabundance.org`, add and verify the new domain in Vercel, update DNS, and set `NEXT_PUBLIC_SITE_URL=https://illinoisabundance.org`. Update `MAIL_FROM`, `CONTACT_EMAIL`, and `ADMIN_EMAIL` as appropriate; verify a new sending domain in Resend before using it. Update environment values and redeploy so links, metadata, and origin checks agree. Rotate service credentials after the new team has tested access.

Keep the old host redirecting to the new one while preserving paths, query strings, and POST methods. Existing article links and emailed confirmation/unsubscribe links must continue to work; use a method-preserving redirect such as 308. Test those links as well as RSS and share previews. Cookies belong to the old host, so reviewers should sign in again at the new domain.

Static editorial copy lives in `src/lib/content.ts`; samples in `src/lib/sample-data.ts`; SQL in `db/migrations`; wordmark, illustrations, fonts, and licenses in `public/`. The Apple design and mobile-native skills informed spacing, type hierarchy, restrained feedback, touch targets, and responsive layouts. Next.js conventions are documented in `AGENTS.md`; read the installed framework guides before changing routing or rendering behavior.
