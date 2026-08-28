# PatternPAL engagement collector

Daily snapshot of every Clerk user's activity, joined to live Stripe subscription state.
Built 2026-08-28. **It is a collector, not a learner** — it stores facts and derives nothing.
Predictions and churn scores are a separate decision, made later against real accumulated data.

## Where it lives

Not in this repo. It runs entirely inside Supabase.

| Piece | Where |
|---|---|
| Project | Supabase project `PatternPAL` (ref `vzkbobrsziywwhwyglgc`, us-east-2) — formerly named PortfolioPAL |
| Tables | `public.patternpal_user_snapshots`, `public.patternpal_snapshot_runs` |
| Collector | Edge Function `patternpal-engagement-snapshot` |
| Schedule | `pg_cron` job `patternpal-engagement-snapshot`, **active**, daily `15 7 * * *` (07:15 UTC) |

That project still contains PortfolioPAL's `profiles` and `projects` tables (1 row and 0 rows).
They are untouched, which is why our tables carry a `patternpal_` prefix.

## Why it is built this way

The obvious version — a Node script in `scripts/` run daily — fails on three counts:

1. **Credentials.** `.env.local` holds *test* keys. The Aug 2026 entitlement sweep 401'd on exactly
   that and only ran after pulling production keys from Vercel and deleting them afterwards. A daily
   job cannot depend on that dance. Edge Function secrets hold them server-side instead.
2. **Nowhere to write.** PatternPAL has no database; entitlement lives in Clerk. A local file only
   exists if Mandy's Mac runs it, and a committed file would put ~300 customer emails in git.
3. **Nothing runs daily.** There is no `vercel.json` and no scheduled functions. The alternative was
   the scheduled Claude session that runs the Kit sync — which went dark for six days in Aug 2026 on a
   stale token, plus outages on Aug 11/12 and Jul 15–19. A dataset whose entire value is continuity
   cannot hang off that.

## Schema notes

`patternpal_user_snapshots` is keyed on `(snapshot_date, clerk_user_id)` and written with
merge-duplicates, so **re-running a day overwrites rather than duplicating**. Safe to retry by hand.

### `collected_at` means *last* written, and that is deliberate

`collected_at` is sent explicitly in the upsert payload rather than left to the column default.
PostgREST only updates columns **present in the payload**, so a default-populated `collected_at` keeps
its original insert value forever — the row updates correctly while its timestamp still reads as the
first run of the day. That looked exactly like `ON CONFLICT DO NOTHING` when it was nothing of the sort,
and it would have made a re-run appear not to have happened. **Do not remove `collected_at` from the
payload.**

Because every row in a run shares one `collected_at`, this is a free partial-write detector:

```sql
-- anything other than 1 means that day was written by more than one run
select snapshot_date, count(distinct collected_at)
from patternpal_user_snapshots group by 1 order by 1 desc;
```

### History model

Rows are partitioned by `snapshot_date`, so each day is its own generation and a re-run updates only
that day. **A bad or partial first run of a day is correctable — just run it again.** Verified: a Pro
revoke made between two runs was reflected by the second.

`patternpal_snapshot_runs` is the heartbeat: one row per run with counts, duration and any error.
Query for missing `run_date`s to find collection gaps — the Kit sync's six dark days went unnoticed
precisely because nothing recorded that it had not run.

RLS is enabled on both with **no policies**, so only the service role can read them. They hold
customer email addresses.

## Clerk → Stripe join

By **email**. The 2026-08-27 sweep resolved 296 of 297 paying subscribers that way.
Stripe subscription metadata carries a `clerkUserId`, but on both exception rows in that sweep the
pointer was **dangling** — the Clerk user no longer existed. Do not trust it over the email match
without confirming the user resolves.

## Status — first run succeeded 2026-08-28

```
clerk_users_seen 831 | stripe_subs_seen 301 | rows_written 831 | 4.4s | status ok
```

Cross-checked against the same day's entitlement sweep: **295** users matched to a live Stripe
subscription and exactly **1** paying-but-not-Pro (Paul Corcoran, a test account) — both numbers agree
with the sweep, so the join is correct. Zero rows with a missing email and zero with a null
`last_active_at`, so the parsing is not silently nulling.

It also surfaced something the sweep could not see, because the sweep only looked Stripe → Clerk:
**9 accounts hold `pro: true` with no live subscription.** Seven signed up between Feb 4 and Mar 3,
before the March 2 launch — consistent with a founding/comp group. Reported, not acted on: a
last-active date cannot distinguish a deliberate comp from a leftover grant.

### Secrets: either case works

`CLERK_SECRET_KEY` / `STRIPE_SECRET_KEY` are read uppercase-first with a lowercase fallback, so a
dashboard entry in either spelling works and a later rename will not break the collector.

**The Stripe key must be a restricted key**, created in **live mode**, with exactly:

- **Core → Customers → Read**
- **Billing → Subscriptions → Read**

Nothing else. The collector makes one call — list subscriptions with the customer expanded — and needs
Customers only because the email lives on the customer object. If it leaks it cannot charge, refund or
cancel anything.

## Scheduling — done, and one trap worth remembering

The cron job calls the Edge Function over `pg_net` and authenticates with the project's **anon** key,
not the service role key. That is deliberate: `verify_jwt` accepts any valid project JWT, the anon key
is publishable by design, and writing it into a cron definition is not storing a secret. Worst case
someone holding it triggers an extra run — idempotent, exposes nothing, returns only counts.

The Supabase dashboard on this project has **no Cron UI** under Integrations (only GitHub, Vercel and
AWS PrivateLink), so the job was created in SQL.

### ⚠️ `pg_net` defaults to a 5-second timeout

The collector takes 4–7 seconds. The first scheduled job timed out at exactly 5000ms — and the Edge
Function **still ran to completion**, writing all 831 rows. That is the worst possible failure mode: the
cron side logs an error every day while the data lands anyway, so both signals lie. It gets worse as the
user count grows.

`timeout_milliseconds := 120000` is set explicitly on the job. **Do not drop that argument.**

Verified end to end via `net._http_response`: status 200, body returned, 831 rows, 1805ms.

```sql
-- the live job
select jobid, jobname, schedule, active from cron.job;

-- last few cron-initiated HTTP calls
select id, status_code, error_msg, left(content, 200)
from net._http_response order by id desc limit 5;
```

## Useful queries once data accrues

```sql
-- collection gaps: any day with no successful run
select d::date as missing_day
from generate_series(
       (select min(run_date) from patternpal_snapshot_runs),
       current_date, '1 day') d
where not exists (
  select 1 from patternpal_snapshot_runs r
  where r.run_date = d::date and r.status = 'ok');

-- paying but dormant, today
select email, last_active_at, current_date - last_active_at::date as days_idle
from patternpal_user_snapshots
where snapshot_date = current_date
  and stripe_status in ('active','trialing')
order by last_active_at nulls first;
```

## What this does NOT answer yet

Nothing about trajectory until roughly 30 days of snapshots exist. **Days-since-last-login and current
dormancy are available immediately** — those are live values on the Clerk user and were always
answerable retroactively without any collector. What genuinely accrues forward is login *frequency*
over time, and whether disengagement leads churn.
