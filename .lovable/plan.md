

# Re-Score All Accounts via bulk-score-accounts

## What This Does

Trigger the `bulk-score-accounts` edge function for **both organizations** to re-score all accounts with the latest bed_count data and updated skip patterns. This will:

- Re-score the **116 accounts currently capped at 69 or below** that now have valid bed counts
- Score the **56 accounts that have never been scored**
- Apply the latest scoring formula to all ~3,900+ accounts

## Current State

- **Last scoring run:** Feb 19, 2026 — Ninety One Life completed successfully, Launchpulse failed
- The 15 false-positive bed counts were already reset to 0 (previous migration)
- Skip patterns are updated to prevent future false positives

## Execution Steps

### Step 1: Trigger for Ninety One Life (child org)
Call `bulk-score-accounts` with `org_id: cd592f73-3e0e-478d-905b-47fe7c5fb634`. This is the child org where accounts and scores live.

### Step 2: Monitor completion
Poll `bulk_scoring_jobs` table to confirm the job reaches `completed` status. The function processes accounts in chunks of 200 and typically takes 1-3 minutes.

### Step 3: Trigger for Launchpulse (parent org)
Call `bulk-score-accounts` with `org_id: 726a0dc0-99c7-43c2-b20f-b849f2760c3f`. The previous run for this org failed -- re-triggering should resolve it.

### Step 4: Verify results
Query the database to compare before/after scores for the 165+ hospital accounts with bed_count > 0, specifically checking:
- How many moved above 69
- Average score change
- Any remaining accounts still unscored

## Technical Details

- The function requires authentication -- will invoke via `supabase.functions.invoke()` using the curl tool with the service role
- The function has idempotency checks with a 10-minute TTL, so if a recent run exists it may return cached results
- Accounts are scored against all active `icp_profiles` for the org
- The scoring formula uses bed_count within the Segment dimension (30 pts weight)

