

## Fix Bulk Scoring Failures

### Root Cause

The `scores` table has **22 indexes** (many redundant) on only 62K rows. The index overhead is **116 MB** vs **32 MB** of actual data. Every upsert of 500 rows must update all 22 indexes, causing **statement timeouts** (error code `57014`) that cascade through every chunk.

### Current State
- **Launchpulse job** (`d6c92111`): 2,500/39,928 processed, 2,000 failed scores -- all upsert timeouts
- **Ninety One Life job** (`b2e398e6`): 11,000/39,928 processed, then stuck -- same timeout issue
- Both jobs are stuck in `processing` status

### Plan

#### 1. Drop Redundant Indexes (the primary fix)

The following indexes are **duplicates** of the unique constraint `unique_score_per_account (org_id, account_external_id)` or of each other:

| Index to DROP | Reason |
|---|---|
| `idx_scores_account` | Duplicate of `unique_score_per_account` |
| `idx_scores_account_lookup` | Duplicate of `unique_score_per_account` |
| `idx_scores_org_account` | Duplicate of `unique_score_per_account` |
| `idx_scores_account_external_id` | Subset of `idx_scores_external_id_org` |
| `idx_scores_external_id_org` | Redundant with `idx_scores_account_org` (which has INCLUDE columns) |
| `idx_scores_org_overall` | Redundant with `idx_scores_org_overall_desc` (which has INCLUDE columns) |
| `idx_scores_org_account_overall` | Covered by unique + `idx_scores_org_overall_desc` |
| `idx_scores_overall` | Low selectivity, rarely useful alone |
| `idx_scores_org_id` | Covered by every composite index starting with `org_id` |

This removes **9 indexes**, cutting write overhead roughly in half.

#### 2. Reduce Upsert Batch Size

Change `CHUNK_SIZE` from 500 to **200** in the edge function. Smaller batches complete within the statement timeout window.

#### 3. Reset Failed Jobs

Mark both stuck jobs as `failed` so fresh scoring runs can start clean.

#### 4. Fix match_count Threshold

Line 563 still uses `>= 70` for ICP match counts -- update to use `>= 60` to match the new threshold.

### Technical Details

```text
BEFORE:  22 indexes, 148 MB total, upserts timeout at 2 min
AFTER:   13 indexes, ~80 MB total, upserts complete in seconds
```

**Files to change:**
- **Database migration**: Drop 9 redundant indexes, reset stuck jobs
- `supabase/functions/bulk-score-accounts/index.ts`: Reduce `CHUNK_SIZE` to 200, fix match_count threshold from 70 to 60

