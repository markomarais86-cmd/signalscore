
# Fix: Bulk Scoring Not Working

## Problems Identified

### Problem 1: Child orgs (91.Life) can never score -- accounts query returns 0 rows
The `bulk-score-accounts` edge function queries accounts with `.eq('org_id', org_id)` where `org_id` is the child org's ID. But all accounts belong to the **parent org** (Launchpulse). The function finds zero accounts and either creates a job with `total_accounts: 0` or errors out.

### Problem 2: Launchpulse jobs time out and never complete
Recent jobs for Launchpulse (39,928 accounts) get stuck at 25K-30K accounts. The edge function has a 50-second time budget, processes what it can, then marks the job as "processing" expecting auto-resume. But the **auto-recovery function only monitors `enrichment_jobs`**, not `bulk_scoring_jobs`. So these jobs are never resumed and eventually get manually marked as failed.

### Problem 3: No auto-resume for bulk scoring jobs
The `job-auto-recovery` edge function is hard-coded to only look at the `enrichment_jobs` table. The `bulk_scoring_jobs` table is completely unmonitored, so when a scoring job pauses at the 50-second mark, nothing ever resumes it.

---

## Fix Plan

### 1. Fix child org account resolution in `bulk-score-accounts/index.ts`
- After extracting `org_id` from the request, resolve the **data org** (parent) using the `get_data_org_id()` database function or a direct lookup on `organizations.parent_org_id`
- Use `dataOrgId` for querying accounts (shared data)
- Keep using `org_id` (child) for ICP profiles and writing scores (these are org-specific)

```text
Before:
  accounts query: .eq('org_id', org_id)     --> 0 rows for child orgs
  ICP query:      .eq('org_id', org_id)     --> correct
  scores write:   org_id                     --> correct

After:
  accounts query: .eq('org_id', dataOrgId)  --> parent's accounts
  ICP query:      .eq('org_id', org_id)     --> child's ICPs
  scores write:   org_id                     --> child's scores
```

### 2. Add bulk scoring job monitoring to `job-auto-recovery/index.ts`
- Add a new step that detects stale `bulk_scoring_jobs` (status = 'processing', not updated in 2+ minutes)
- When found, invoke `bulk-score-accounts` with the `job_id` parameter to resume from where it left off
- Cap at 3 retries before marking as failed

### 3. Fix the resume path in `bulk-score-accounts/index.ts`
- The resume path (`job_id` parameter) currently skips auth org verification. Ensure it works when called by auto-recovery with service role
- When resuming, also resolve `dataOrgId` for the account query

---

## Technical Details

### File: `supabase/functions/bulk-score-accounts/index.ts`

Changes:
1. After line 160 (after extracting `org_id`), add a lookup for parent org:
   ```typescript
   // Resolve data org (parent) for account queries
   const { data: orgData } = await supabase
     .from('organizations')
     .select('parent_org_id')
     .eq('id', org_id)
     .single();
   const dataOrgId = orgData?.parent_org_id || org_id;
   console.log(`Data org: ${dataOrgId} (parent: ${dataOrgId !== org_id})`);
   ```

2. Line 211 -- change account count query from `.eq('org_id', org_id)` to `.eq('org_id', dataOrgId)`
3. Line 274 -- change account fetch query from `.eq('org_id', org_id)` to `.eq('org_id', dataOrgId)`
4. Keep ICP query (line 198-201) using `org_id` (child's own ICPs)
5. Keep score writes (line 303) using `org_id` (child's own scores)

### File: `supabase/functions/job-auto-recovery/index.ts`

Add a new section after the enrichment job recovery (after line 431) that:
1. Queries `bulk_scoring_jobs` for jobs with status = 'processing' and `updated_at` older than 2 minutes
2. For each stale job, invokes `bulk-score-accounts` with `{ job_id, org_id }` to resume
3. After 3 failed resume attempts, marks the job as 'failed'

### File: `src/components/executive/PowerUpButton.tsx`

Line 56 -- the body sends `chunk_size: 5000` which is ignored by the edge function (it uses CHUNK_SIZE = 2000). Remove the unused parameter to avoid confusion.

---

## Summary

| Problem | Root Cause | Fix |
|---------|-----------|-----|
| 91.Life scores never created | Accounts queried by child org_id (0 results) | Use `dataOrgId` (parent) for account queries |
| Launchpulse jobs time out at ~25K | 50s edge function limit + no auto-resume | Add bulk scoring to job-auto-recovery |
| Jobs never resume | Auto-recovery only monitors enrichment_jobs | Extend auto-recovery to monitor bulk_scoring_jobs |
