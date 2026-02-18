

## Auto-Run Bed Count Enrichment for All Accounts

### Current Problem

- Only 25 of ~40,000 accounts have `bed_count` data
- The `enrich-bed-counts` function requires a user JWT (same auth bug we fixed for bulk-score-accounts)
- No cron or auto-loop exists to keep calling it until all accounts are processed
- Each invocation processes max 200 accounts in its 50-second time budget (~30-40 with Perplexity calls)

### Fix (3 Changes)

#### 1. Add service role auth bypass to `enrich-bed-counts`

Same pattern as the bulk-score-accounts fix: detect the service role key and skip `getUser()`.

**File:** `supabase/functions/enrich-bed-counts/index.ts`

- Extract token from Authorization header
- If token matches `SUPABASE_SERVICE_ROLE_KEY`, skip user auth
- Still require `org_id` in the request body (the cron will provide it)

#### 2. Set up a cron job to call `enrich-bed-counts` every 2 minutes

Uses `pg_cron` + `pg_net` (already enabled) to POST to the function with:
- `org_id`: the LaunchPulse parent org ID (`726a0dc0-99c7-43c2-b20f-b849f2760c3f`)
- `batch_size`: 200 (max allowed)
- Authorization: service role key

The function already returns `enriched: 0` when all accounts are done, so the cron will harmlessly no-op once complete.

#### 3. Increase batch size and parallel throughput

- Change `DEFAULT_BATCH_SIZE` from 50 to 200
- Increase `PARALLEL_BATCH` from 5 to 10 (more concurrent AI calls per run)

### Estimated Timeline

At ~30-40 accounts per 50-second run, every 2 minutes:
- ~20-30 enrichments per cycle (some will be "not a hospital" skips)
- ~40,000 accounts / ~30 per cycle = ~1,333 cycles
- At one cycle every 2 minutes = ~44 hours for full coverage

Most non-hospital accounts will return `null` quickly (skipped), so actual throughput will be higher. Realistically 12-24 hours for full coverage.

### After Completion

Once all accounts are enriched, we can remove the cron job. The function's "All accounts already have bed_count data" response will confirm completion.

### Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/enrich-bed-counts/index.ts` | Add service role auth bypass, increase batch size to 200, increase parallelism to 10 |

### Database Change (SQL, not a migration)

A `cron.schedule()` call to set up the recurring job (same pattern as the existing `job-auto-recovery-cron`).

