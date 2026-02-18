

## Fix: Score Button Not Working for 91.Life (Child Org)

### Root Cause

The "Score" button and "Power Up" button both fail for 91.life because the **client-side** prerequisite checks query `accounts` using the child org's ID directly. Since 91.life is a child org, its accounts live under the parent org (LaunchPulse). The queries return 0 accounts, and the UI aborts with "No accounts or active ICP profiles found" before ever calling the edge function.

The edge function itself already handles parent org resolution correctly -- the problem is purely in the frontend.

### Affected Components

| Component | Problem |
|-----------|---------|
| `BulkScoring.tsx` (line 414) | `accounts.select().eq("org_id", userProfile.org_id)` returns 0 for child orgs |
| `PowerUpButton.tsx` (line 38) | `accounts.select().eq("org_id", orgId)` returns 0 for child orgs |

### Fix

#### 1. `src/components/BulkScoring.tsx`

Use the `useDataOrgId()` hook (already exists in the codebase) to resolve the parent org for account queries:

- Import `useDataOrgId` from `@/hooks/use-data-org`
- Use `dataOrgId` for the account count prerequisite check (line 414)
- Keep `userProfile.org_id` (or `effectiveOrgId`) for ICP profile lookup and edge function invocation (scores and ICPs belong to the child org)

#### 2. `src/components/executive/PowerUpButton.tsx`

Same fix -- resolve parent org for account queries:

- Add parent org resolution by querying `organizations.parent_org_id` for the given `orgId`
- Use the resolved `dataOrgId` for the account query at line 38 (enrichment candidates)
- Keep `orgId` for score queries, edge function calls, and ICP-related operations

### What Won't Change

- The `bulk-score-accounts` edge function already handles `dataOrgId` resolution server-side -- no backend changes needed
- The scoring logic (bed count caps, range-based size matching, etc.) stays as-is
- ICP profiles and scores continue to be read/written under the child org ID

### Expected Result

After the fix, clicking "Score Accounts" or "Power Up" for 91.life will:
1. Find the parent org's ~40,000 accounts in the prerequisite check
2. Successfully invoke the edge function
3. Score all accounts against 91.life's ICP profiles
