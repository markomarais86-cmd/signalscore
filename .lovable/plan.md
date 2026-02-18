

## Fix: Bulk Scoring Jobs Stalling at ~30k Accounts

### Root Cause

The bulk scoring edge function has a 50-second time budget per invocation (line 8: `MAX_RUNTIME_MS = 50_000`). For 39,928 accounts with 80 chunks, a single invocation only processes ~15-20 chunks before timing out. It then marks the job as `processing` and relies on auto-recovery (cron) to resume it.

**The auto-recovery fails because of an authentication mismatch:**
- Auto-recovery calls `bulk-score-accounts` with `Authorization: Bearer SUPABASE_SERVICE_ROLE_KEY`
- But `bulk-score-accounts` calls `authClient.auth.getUser()` which does NOT work with service role keys -- it returns null
- This causes "Unauthorized - invalid token", and after 3 failed attempts, the job is marked as `failed`

This explains the pattern in the job history: every job gets partway through (15k-23k accounts), times out, auto-recovery fails to resume, and eventually the job fails.

### Fix

Update `supabase/functions/bulk-score-accounts/index.ts` to detect when the request is authenticated with the service role key (used by auto-recovery cron) and skip the user-level auth check in that case.

**Specifically:**
1. After extracting the auth header, check if it matches the service role key
2. If it does, skip `getUser()` and the org access check (the service role has full access)
3. If it's a regular user JWT, keep the existing auth flow unchanged

```text
CURRENT (lines 226-269):
  const authHeader = req.headers.get('Authorization');
  ...
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return errorResponse(UNAUTHORIZED);
  ...verify org access via user profile...

AFTER:
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  const isServiceRole = token === supabaseServiceKey;

  if (!isServiceRole) {
    // Regular user auth flow (unchanged)
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return errorResponse(UNAUTHORIZED);
    ...verify org access via user profile...
  }
  // Service role: skip user check (auto-recovery cron has full access)
```

### Technical Details

| Item | Detail |
|------|--------|
| File to modify | `supabase/functions/bulk-score-accounts/index.ts` |
| Lines affected | ~226-269 (authentication block) |
| Risk | Low -- only adds an alternative auth path for the service role key, which auto-recovery already uses |
| No other files need changes | Auto-recovery already sends the correct `org_id` and `job_id` in the request body |

### Expected Result

- Auto-recovery will successfully resume stale bulk scoring jobs
- The current stuck job (chunk 60/80) will complete on the next cron run
- All 39,928 accounts will be scored for 91.life

