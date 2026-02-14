

# Fix Account Scoring and Missing Account Visibility

## What's Happening

### Problem 1: Broken Trigger Kills Score Updates

There is a database trigger `trg_log_tier_change` on the `scores` table that references two columns that **do not exist**: `score_band` and `overall_score`. Every time a score is updated (via `ON CONFLICT DO UPDATE`), this trigger fires and crashes with:

```
record "old" has no field "score_band"
```

This error **rolls back the entire upsert transaction**, so any account that already had a score record cannot be re-scored. The error appears hundreds of times in the Postgres logs.

**Evidence**: The latest bulk scoring job processed 39,928 accounts but only scored 4,950 new ones. The ~14,300 accounts that already had scores could not be updated because of this trigger.

### Problem 2: 20,617 Accounts Have No Scores

Out of 39,928 total accounts, only 19,311 have score records. The 27,686 accounts loaded recently (updated today) largely remain unscored because:
- The trigger bug prevents re-scoring existing accounts
- New accounts that fail the RPC (3,050 in the last run) never get retried

### The Accounts ARE in the Database

Your 39,928 accounts are all present in the database under your org. If you are not seeing them in a specific UI view, it may be because that view filters by score or other criteria. The accounts themselves are not missing.

## Fix Plan

### Step 1: Fix the Broken Trigger

Drop or replace the `trg_log_tier_change` trigger and its function `log_tier_change()`. The function references `OLD.score_band` and `OLD.overall_score` which do not exist in the `scores` table (the actual columns are `overall` and there is no `score_band` column).

**Option A (recommended)**: Drop the trigger entirely since tier change logging is already handled by `log_score_change` which correctly tracks score changes in `score_history`.

**Option B**: Fix the function to use correct column names: `OLD.overall` instead of `OLD.overall_score`, and derive band from the overall score instead of referencing a non-existent column.

I recommend Option A (drop) since it's redundant with existing tracking.

### Step 2: Re-run Bulk Scoring

After the trigger is fixed, trigger a bulk re-score from the ICP Rule Builder page ("Rescore All Accounts" button). This will score all 39,928 accounts including the ~20,000 that are currently unscored.

## Technical Changes

| Change | Details |
|--------|---------|
| SQL Migration | `DROP TRIGGER trg_log_tier_change ON scores;` and `DROP FUNCTION IF EXISTS log_tier_change();` |
| No code changes needed | The bulk scoring infrastructure (`bulk-score-accounts` edge function, `calculate_account_score` RPC) works correctly -- it's the trigger that blocks updates |

## What This Fixes

- Score updates will no longer silently fail
- All 39,928 accounts will get scored on the next bulk run
- The hundreds of `record "old" has no field "score_band"` errors in Postgres logs will stop
- The `score_history` table (via `log_score_change`) will continue tracking all score changes

