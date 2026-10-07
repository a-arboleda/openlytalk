# Vercel launch safeguards

## Activate before making the site public

1. Apply the additive database migration with `npm run db:migrate` against the
   deployment database. The new `request_rate_limits` table stores only keyed
   hashes, counters and expiry timestamps.
2. In Vercel, set `DATABASE_URL`, the required provider keys, `CRON_SECRET` and
   `RATE_LIMIT_SECRET`. Use two independent random secrets of at least 32
   characters, generated with a password manager or `openssl rand -hex 32`.
   Never put secrets in Git or `NEXT_PUBLIC_*` variables. Local development
   already has separate generated secrets in the ignored `.env.local` file.
3. Deploy `vercel.json`. Its daily `0 5 * * *` cron is compatible with Hobby and
   runs in production only. Vercel supplies `Authorization: Bearer CRON_SECRET`.
   It does not run on localhost or Preview deployments.
4. In Vercel's Cron Jobs panel, manually run `/api/cron/retention`. Confirm a
   successful JSON response with deletion counts, then confirm its scheduled
   execution on the following day. Unauthorized requests must return 401.
5. Check for retained records created under the former seven-day expiry policy.
   Do not shorten those existing sessions or delete them early. During this
   transition, use a sufficiently frequent protected cleanup runner and check
   overdue records, or wait for the existing retention window and clear expired
   records before public launch. A daily cron alone can delete an old seven-day
   session after its seventh day. New sessions have the buffer described below.
6. Run the complete flow on the deployed HTTPS URL: record 60 seconds on desktop
   and the target phone/browser, preview, submit, receive feedback, download the
   PDF and delete. Unit tests validate a full-minute WAV and upload envelope;
   they do not replace a real microphone/MediaRecorder test on the target device.

## Retention and monitoring

New sessions (including creation through retained API routes) and renewed
anonymous owners expire after five days. Retained expiry timestamps are not
rewritten. Normal daily cleanup therefore deletes newly expired data before the
public maximum of seven days, allowing for Hobby's scheduling delay. Expired
sessions are inaccessible immediately, even before physical deletion.

`GET /api/cron/retention` authenticates before accessing the database and runs a
transaction. It removes expired story practices, retained practices and
conversations, and rate counters. Foreign keys cascade to dependent messages,
requests and feedback. Expired anonymous owners are removed only after checking
all three session tables under a parent-row lock. Concurrent cron deliveries
use an advisory lock; the second can safely return `skipped: true`.

No cron offers an absolute deletion guarantee during outages. Before launch,
configure failed-invocation alerts in the hosting/monitoring system and check
that the last successful execution is less than 26 hours old. A failure returns
503 and logs only `retention_cleanup_failed`; never log transcripts or secrets.
Investigate and rerun failed jobs within the two-day retention buffer. The
endpoint returns only counts, never learner data. Database backups/provider
retention are separate infrastructure policies and must match the public policy.

## Request budgets

The Node.js Next proxy covers all POST requests to story practices, retained
practice sessions, conversations and episodes, plus paid speech GET requests.
Reading existing feedback/PDFs and deleting sessions remain available.

- Per IP: 30 requests per ten-minute window and 120 per UTC day.
- Per anonymous cookie, when present: 20 per ten-minute window and 80 per day.
- Across the deployment/database: 1,000 protected requests per UTC day.

These are conservative beta defaults in `lib/operations/rate-limit.ts`, not a
promised number of practices per user. HTTP attempts, including invalid requests
and retries, consume request budgets; they never consume accepted spoken
responses. Fixed-window limits can permit a burst across a window boundary.
Completed idempotent retries still avoid duplicate model calls when admitted.
An HTTP request can include multiple provider operations/retries, so the global
limit is not a currency spending cap. Configure provider budgets separately.

Transactions atomically increment all counters across workers; exceeding any
budget rolls back the other increments. 429 includes `Retry-After` and an English
retry message. Local recording remains available in the tab. Database/secret
failures return 503 before paid work. Clearing cookies does not reset IP limits.
Only Vercel's overwritten `x-vercel-forwarded-for` header is trusted in Vercel;
outside Vercel, all requests intentionally share the `local` IP bucket. A future
host must implement its own trusted client-IP boundary before scaling.

## Audio envelope

Audio files are capped at 4,000,000 decimal bytes and actual multipart bodies at
4,200,000 bytes. The reader aborts on oversize even without a valid Content-Length.
The browser requests 64 kbps audio and checks size again after container repair.
The encoder may ignore its requested bitrate; the file cap still applies.
Duration is independently validated server-side, preserving the 60-second limit
and existing one-second automatic-stop tolerance. No recording is persisted.

## Verification

- `npm run test`, `npm run lint`, `npm run typecheck`, `npm run build`.
- `RUN_DATABASE_TESTS=1 npx vitest run tests/integration/postgres-launch-guards.test.ts`:
  concurrent counter enforcement, transaction rollback, window reset, expired
  cleanup, repeat cleanup, and an active practice under an expired owner.
- Existing repository integration tests remain in `npm run test:db`.

References: [Vercel request limits](https://vercel.com/docs/functions/limitations#request-body-size),
[cron scheduling](https://vercel.com/docs/cron-jobs/usage-and-pricing),
[cron authentication and management](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

## Local audit on October 7, 2026

The authenticated cleanup was executed successfully against the configured local
development database: 36 expired retained practices, 31 expired conversations,
and 18 expired unreferenced anonymous owners were removed. Four unexpired story
practices still have their original seven-day expiry; the latest expires on
October 14, 2026 at 19:51:09 UTC. They were preserved. Their transition needs the
first-run retention gate above if this same database is used for production.
The scheduled job is not active until the Vercel production deployment exists.
