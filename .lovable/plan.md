

## Bulk Re-Score All 39K Accounts for LaunchPulse and 91.life

### Current State

- **39,928 accounts** all belong to LaunchPulse (parent org `726a0dc0`). 91.life (`cd592f73`) is a child org that shares the same accounts via the parent-child model.
- Scores are **written per org** (each org has its own ICP and scores table entries).
- The `bulk-score-accounts` edge function already supports chunked processing with auto-resume (2,000 accounts per chunk, 50s time budget, then pauses and auto-recovery resumes).
- **Previous jobs have failed** -- both orgs show `failed` status on recent runs.
- The JS scoring engine in `bulk-score-accounts` is **out of sync** with the SQL functions -- it does NOT yet enforce the "missing bed_count = cap at Band C (max 69)" rule we just added.

### What Changes

#### 1. Update JS Scoring Engine (bulk-score-accounts/index.ts)

Add the missing bed_count cap logic to the `scoreAccount()` function to match the updated SQL functions:

- Before computing final scores, check if the ICP has any segment with `bed_range` defined
- If so and the account has no `bed_count` (null/empty), set a `missingRequiredVertical` flag
- When flagged, cap both `fit` and `overall` at 69 (Band C ceiling)
- Update `scoring_version` to `chunked_v2_bed_required`
- Also: fix the `bed_range` criterion to **always count** against `critTotal` even when `bed_count` is missing (currently skipped entirely at line 114)

#### 2. Reset Failed Jobs

Before triggering new runs, clear the stale failed jobs so idempotency checks don't block new ones:

```sql
UPDATE bulk_scoring_jobs 
SET status = 'cancelled' 
WHERE status = 'failed' 
  AND org_id IN ('726a0dc0-99c7-43c2-b20f-b849f2760c3f', 'cd592f73-3e0e-478d-905b-47fe7c5fb634');
```

#### 3. Trigger Separate Scoring Runs

After deploying the updated function, invoke it twice -- once per org:

- **LaunchPulse** (`726a0dc0`): Scores all 39,928 accounts against LaunchPulse's active ICPs
- **91.life** (`cd592f73`): Scores the same 39,928 accounts against 91.life's active ICPs

Each run will:
- Process ~2,000 accounts per chunk
- Pause after ~50s and auto-resume via the `job-auto-recovery` cron
- Complete all ~20 chunks across multiple invocations

### Technical Details

**File: `supabase/functions/bulk-score-accounts/index.ts`**

Changes to `scoreAccount()` function (lines 80-166):

```typescript
// After segments loop, add bed_count cap check:
let missingRequiredVertical = false;

if (Array.isArray(vf.segments) && vf.segments.length > 0) {
  // Check if ANY segment defines bed_range
  const anySegHasBeds = segments.some(s => s.bed_range != null);
  const bedCount = attrs.bed_count != null ? Number(attrs.bed_count) : null;
  
  if (anySegHasBeds && bedCount == null) {
    missingRequiredVertical = true;
  }

  // Also: always count bed_range as a criterion even when bedCount is null
  // (currently line 114 skips entirely if bedCount is null)
  for (const seg of segments) {
    if (seg.bed_range) {
      critTotal++;  // Always count
      if (bedCount != null) {
        // existing range match logic
      }
      // If bedCount is null, critMatched stays 0 → penalized
    }
  }
}

// After computing totalScore:
if (missingRequiredVertical) {
  totalScore = Math.min(totalScore, 69);
  fitScore = Math.min(fitScore, 69);
}
```

### Expected Results

- **Accounts WITH bed_count**: Scored normally (can reach Band A/B)
- **661 healthcare accounts WITHOUT bed_count**: Capped at Band C (score <= 69)
- **Non-healthcare accounts**: Unaffected (no bed_range in ICP segments)
- Both orgs get independent score sets reflecting their own ICP criteria
- Auto-resume handles the full 39K across multiple function invocations (~20 chunks each)

