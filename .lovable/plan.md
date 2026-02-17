
# Fix: Bulk Scoring Button Not Working

## Root Causes Found

### Issue 1: Conflicting Unique Constraints on `scores` Table
The `scores` table has **two conflicting unique constraint sets**:
- `unique_score_per_account` on `(org_id, account_external_id)` -- allows only ONE score per account
- `scores_org_id_account_external_id_scoring_version_key` on `(org_id, account_external_id, scoring_version)` -- allows multiple scores per version

The edge function upserts with `onConflict: 'org_id,account_external_id'`, but because there's also the 3-column unique constraint, PostgreSQL may reject the upsert when the `scoring_version` changes (e.g., from `fuzzy_v4.1_vertical` to `chunked_v1`). This causes silent failures.

### Issue 2: Frontend Sends Stale Parameters
The UI sends `chunk_index` and `chunk_size` in the body, but the edge function's `BulkScoreRequest` interface expects `job_id` (not `chunk_index`/`chunk_size`). These extra fields are ignored, but the function no longer uses client-driven chunking -- it handles chunking internally. The mismatch is harmless but confusing.

### Issue 3: No Edge Function Logs Appearing
Zero logs means the function is either:
- Not deployed (the rewrite hasn't been deployed yet), OR  
- Crashing on import (the `_shared/idempotency.ts` or `_shared/response-helpers.ts` import fails)

This is the most likely blocker -- **the function needs to be redeployed**.

### Issue 4: icp_id Column in Upsert
The edge function inserts `icp_id` in score rows, but the upsert conflict target `(org_id, account_external_id)` means only the last ICP's score survives per account. If there are multiple ICPs, this causes overwrites and incorrect counts.

## Fix Plan

### Step 1: Database Migration -- Clean Up Conflicting Constraints
Drop the redundant 3-column unique constraint that conflicts with the 2-column one:

```text
DROP INDEX IF EXISTS scores_org_id_account_external_id_scoring_version_key;
DROP INDEX IF EXISTS scores_org_account_unique;  -- duplicate of unique_score_per_account
```

This leaves only `unique_score_per_account` on `(org_id, account_external_id)` as the single source of truth.

### Step 2: Redeploy the Edge Function
Ensure the rewritten `bulk-score-accounts/index.ts` is deployed. The current "no logs" situation suggests the old version may still be running.

### Step 3: Fix the Frontend Invocation
Update `BulkScoring.tsx` line 422-428 to remove the stale `chunk_index` and `chunk_size` parameters that the new function doesn't use:

```typescript
const { error } = await supabase.functions.invoke("bulk-score-accounts", {
  body: { org_id: userProfile.org_id },
});
```

### Step 4: Fix Multi-ICP Scoring (Optional)
If there's only one active ICP, this is a non-issue. If multiple ICPs exist, the upsert conflict target needs to include `icp_id`, or we pick the best-scoring ICP per account.

## Files to Change

1. **Database migration** -- Drop conflicting unique indexes on `scores`
2. **`supabase/functions/bulk-score-accounts/index.ts`** -- Redeploy (no code changes needed beyond the previous rewrite)
3. **`src/components/BulkScoring.tsx`** -- Clean up the invocation body to remove unused `chunk_index`/`chunk_size` params

## Expected Outcome
- The "Score All Accounts" button triggers the edge function successfully
- Logs appear in the Supabase dashboard
- All 39,928 accounts get scored in ~2-3 minutes via chunked processing
- Job progress updates in real-time in the UI
