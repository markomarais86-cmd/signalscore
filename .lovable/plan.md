

## Fix: Bulk Re-Score Trigger Blocked by Stale "Processing" Jobs

### Root Cause

When you click to trigger scoring, the edge function's idempotency check (line 276-286 of `bulk-score-accounts/index.ts`) finds the existing jobs still in `processing` status and returns "Existing scoring job in progress" instead of actually doing anything. The jobs are paused mid-way (23,500/39,928 for 91.life, 7,500/39,928 for LaunchPulse) but still marked as `processing`.

The auto-recovery cron is supposed to resume these, but it only runs every 5 minutes and looks for jobs stale for 2+ minutes. There's a timing gap where both the user trigger AND auto-recovery can miss the window.

### Two-Part Fix

#### Part 1: Immediate -- Resume the stuck jobs now

Run a database update to reset the stuck jobs so auto-recovery picks them up, OR directly invoke the edge function with `job_id` to resume them:

```sql
-- Option A: Mark them so auto-recovery picks them up on next run
UPDATE bulk_scoring_jobs 
SET updated_at = NOW() - INTERVAL '5 minutes'
WHERE id IN ('1837b305-ddef-476e-b05b-bfc4ef06dc8d', '474d9920-7629-434f-a083-370ad4ae3c06')
  AND status = 'processing';
```

Then invoke the function directly with `job_id` to resume each:
- 91.life job: `{ "job_id": "1837b305-...", "org_id": "cd592f73-..." }` (resume from chunk 47/80)
- LaunchPulse job: `{ "job_id": "474d9920-...", "org_id": "726a0dc0-..." }` (resume from chunk 15/80)

#### Part 2: Code fix -- Allow manual trigger to resume paused jobs

**File: `supabase/functions/bulk-score-accounts/index.ts`**

Update the existing-job check (lines 276-286) so that when a user manually triggers scoring and there's already a `processing` job, the function **resumes it** instead of just returning a message. This way clicking "Score" from the dashboard actually works.

```typescript
// Current behavior (blocks):
if (hasExistingJob && existingJob) {
  return successResponse({
    job_id: existingJob.id, 
    message: 'Existing scoring job in progress',
    ...
  });
}

// New behavior (resumes):
if (hasExistingJob && existingJob) {
  // If the existing job is paused (stale), resume it instead of blocking
  const jobAge = Date.now() - new Date(existingJob.updated_at).getTime();
  if (jobAge > 60_000) { // Stale for > 1 minute = paused, resume it
    console.log(`Resuming stale job ${existingJob.id} (age: ${Math.round(jobAge/1000)}s)`);
    // Fall through to resume logic with this job's ID
    resumeJobId = existingJob.id;
  } else {
    // Genuinely in progress, don't interfere
    return successResponse({
      job_id: existingJob.id,
      message: 'Existing scoring job in progress',
      ...
    });
  }
}
```

This requires making `resumeJobId` a `let` variable (currently destructured as `const` on line 237).

### Technical Details

**Changes:**
1. `supabase/functions/bulk-score-accounts/index.ts` -- Change line 237 to use `let` for `resumeJobId`, update lines 276-286 to resume stale jobs instead of blocking
2. Database migration -- Reset the two stuck jobs so they can be resumed immediately
3. Invoke the function for both orgs to resume scoring

### Expected Result

- Manual "Score" button will resume paused jobs instead of showing "already in progress"
- Both org scoring jobs complete to 39,928/39,928
- Auto-recovery continues to work as a safety net for future runs
