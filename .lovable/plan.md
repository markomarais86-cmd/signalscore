
# Fix LaunchPulse Scoring Job Timeout Failure

## Root Cause

The scoring job is **working correctly per invocation** but the auto-recovery system kills it too early.

**The math:**
- 39,928 accounts / 200 per chunk = 200 chunks needed
- Each edge function invocation has a 50s time budget
- Each invocation processes ~25 chunks (~5,000 accounts) before timing out
- 200 chunks / 25 per invocation = **8 invocations needed** to complete
- But `MAX_RECOVERY_ATTEMPTS = 3` in `job-auto-recovery` kills the job after only 3 retries
- Result: job dies at ~15,400/39,928 accounts (77 chunks -- exactly 3 x ~25)

The REINDEX was a red herring. The scores table indexes are healthy (49MB across 7 indexes on 33MB of data -- normal ratio). The real problem is a mismatch between the recovery limit and the work required.

## The Fix (Two Changes)

### 1. Increase chunk size from 200 to 500 in `bulk-score-accounts`

This reduces total chunks from 200 to 80, meaning fewer invocations needed. Each invocation will process ~10 chunks of 500 (~5,000 accounts) instead of ~25 chunks of 200 -- same throughput but fewer chunk overhead (fewer progress-update queries).

**File:** `supabase/functions/bulk-score-accounts/index.ts`

```typescript
const CHUNK_SIZE = 500; // was 200
```

### 2. Increase MAX_RECOVERY_ATTEMPTS from 3 to 10 in `job-auto-recovery`

For a 40K account org, 8 invocations is the minimum. With a buffer, 10 attempts ensures completion.

**File:** `supabase/functions/job-auto-recovery/index.ts`

```typescript
const MAX_RECOVERY_ATTEMPTS = 10; // was 3
```

### 3. Also increase MAX_RECOVERY_ATTEMPTS in `bulk-score-accounts` itself

The `bulk-score-accounts` function also has its own stale-detection code that reads the `auto_recovery_count` from `error_details`. The auto-recovery logic in `job-auto-recovery` checks `retryCount >= MAX_RECOVERY_ATTEMPTS` -- this threshold needs to match.

### 4. Reset the failed job and re-trigger

After deploying the fixes:
- Mark the failed job (`53823758`) as stale so auto-recovery picks it up, OR
- Trigger a fresh scoring run for LaunchPulse (`726a0dc0-99c7-43c2-b20f-b849f2760c3f`)

## Technical Details

| Metric | Before | After |
|--------|--------|-------|
| Chunk size | 200 | 500 |
| Total chunks (40K accounts) | 200 | 80 |
| Max recovery attempts | 3 | 10 |
| Invocations needed | ~8 | ~8 |
| Recovery headroom | -5 (fails) | +2 (succeeds) |

## Risk Assessment

- **Chunk size 500:** The retry logic already handles upsert failures by splitting into sub-chunks of 100, so larger chunks are safe. The previous job with chunk_size=500 also processed without upsert errors (0 `failed_scores`).
- **Recovery attempts 10:** This just means more retries before giving up. Each retry is a normal edge function invocation -- no resource risk.
