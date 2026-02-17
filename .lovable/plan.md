

# Fix Bulk Scoring to Score All 39,928 Accounts

## Problem

Bulk scoring jobs keep getting stuck partway through (25,000 out of 39,928 accounts). This leaves **17,624 accounts unscored**, which means they don't appear in ICP-filtered views.

**Root cause**: The edge function tries to score each account individually via RPC calls inside a background task (`EdgeRuntime.waitUntil`). Deno kills this background task after ~150 seconds, leaving thousands of accounts unscored.

**Good news**: There's already a database function called `bulk_score_all_accounts` that does the entire job in a single SQL operation -- it's much faster and won't time out. The edge function just isn't using it.

## Solution

Rewrite the `bulk-score-accounts` edge function to call the SQL-based `bulk_score_all_accounts` function instead of looping through accounts one by one.

## What Changes

### 1. Rewrite `supabase/functions/bulk-score-accounts/index.ts`

Replace the current approach (individual RPC calls in background) with:
- Keep all auth, idempotency, and zombie cleanup logic
- Instead of `EdgeRuntime.waitUntil(processAllChunks(...))`, call `supabase.rpc('bulk_score_all_accounts', { p_org_id, p_icp_id })`
- This single SQL call scores all 39,928 accounts in one operation and creates/completes the job record automatically
- Remove the `processAllChunks` function entirely since it's no longer needed

### 2. Database migration: Add statement timeout override

The `bulk_score_all_accounts` function needs enough time to process ~40K accounts. Add a migration to set a generous statement timeout (10 minutes) on this function so it doesn't get killed by the default Postgres timeout.

### 3. Update ICP match counts after scoring

After `bulk_score_all_accounts` completes, update `icp_profiles.match_count` for each active ICP with the count of accounts scoring 70+.

## Technical Details

```text
Current Flow (broken):
  Edge Function -> EdgeRuntime.waitUntil -> 39,928 individual RPC calls -> TIMEOUT at ~25K

New Flow (reliable):
  Edge Function -> supabase.rpc('bulk_score_all_accounts') -> Single SQL INSERT...ON CONFLICT -> Done
```

### Edge Function Changes (bulk-score-accounts/index.ts)

- Remove `processAllChunks` function (lines 81-183)
- Replace `EdgeRuntime.waitUntil(processAllChunks(...))` block with a direct RPC call:
  - Call `supabase.rpc('bulk_score_all_accounts', { p_org_id: org_id, p_icp_id: icp_id || null })`
  - Parse the result (returns `{ success, job_id, processed, total_accounts, duration_seconds }`)
  - Return job details to the frontend
- Remove the manual job creation (`INSERT INTO bulk_scoring_jobs`) since the SQL function already creates and completes the job record
- Keep: authentication, org verification, idempotency, zombie cleanup, rate limiting

### Database Migration

- Set `statement_timeout` to 10 minutes for `bulk_score_all_accounts` to handle large orgs:
  ```sql
  ALTER FUNCTION public.bulk_score_all_accounts(uuid, uuid)
  SET statement_timeout = '600s';
  ```

### No Frontend Changes Needed

The `BulkScoring.tsx` component already polls job status from `bulk_scoring_jobs` -- the SQL function writes to that same table, so the UI will work as-is.

