

# Fix ICP Coverage Table, Leads Display, and Apollo Data Loading

## Issues Found

### Issue 1: "ICP Coverage" table shows 16,000 as "Total" which is misleading
The table is called "ICP Coverage by Source" but the "Total" column shows ALL scored accounts (16,000), including 6,586 low-fit accounts that are NOT ICP-fit. The user correctly says "ICP coverage is not 16,000" -- only 9,414 accounts are ICP-fit (high + medium).

**Fix**: Rename the "Total" column to "Scored" to make clear it's the total scored base, not the ICP coverage number.

### Issue 2: ICP Coverage Panel also misleading
The donut chart panel shows "Total Scored: 16,000" and "High-Fit: 2,798" with "Coverage: 17%". But ICP coverage should include BOTH high-fit AND medium-fit (9,414 accounts = 59% coverage). The center label says "17% High-Fit" which undersells the ICP coverage.

**Fix**: Update the center metric to show ICP-Fit (high + medium) percentage instead of just High-Fit percentage. Change center label from "High-Fit" to "ICP-Fit" and the summary metric from "High-Fit" to "ICP-Fit".

### Issue 3: Apollo/Database data not loading
The Apollo data exists in `external_data_sources` for the child org (1.1M accounts, 3.1M contacts). The TAM query in the dashboard hook fetches from `external_data_sources` with `.eq('org_id', orgId)` and `.maybeSingle()`. The RLS policy should allow this, but the TAM error is silently swallowed. The likely issue is that the query returns an error (possibly due to RLS evaluation) and `.maybeSingle()` returns null, resulting in no Database row data.

**Fix**: Add debug logging to the TAM result to surface errors. Also, since the TAM query uses the Supabase client (subject to RLS), and the `get_current_user_org_id()` function returns the user's actual org (`726a0dc0`), the child org policy should match via the second SELECT policy. However, as a safety net, also query with the parent org ID as a fallback if the child org query returns null. Additionally, ensure the TAM data is passed through correctly even when metrics show 0 for database accounts.

### Issue 4: Leads numbers may look off
The leads data (23,260 total, 2,420 high-fit, 12,693 medium-fit, 8,147 low-fit) is mathematically correct -- it counts all leads linked to scored accounts. But the ICP Coverage Panel shows only "High-Fit" leads as the key metric, which undercounts ICP-fit leads (should be high + medium = 15,113).

**Fix**: Same as Issue 2 -- update the leads tab in ICPCoveragePanel to show ICP-Fit (high + medium) as the key metric instead of just High-Fit.

## Changes

### 1. `src/components/executive/SimpleICPTable.tsx`
- Rename "Total" column header to "Scored" to avoid confusion with ICP count

### 2. `src/components/executive/ICPCoveragePanel.tsx`
- Change the key metric from "High-Fit" count to "ICP-Fit" count (high + medium) for both accounts and leads tabs
- Update center donut label from "X% High-Fit" to "X% ICP-Fit"
- Update summary box from "High-Fit" label to "ICP-Fit" label
- Coverage percentage becomes `(highFit + medFit) / total` instead of `highFit / total`

### 3. `src/hooks/use-dashboard-data.ts`
- Add explicit error logging for TAM query failures
- If `tamResult.data` is null and `tamResult.error` exists, log the full error
- Add a fallback: if the child org TAM query returns null, try querying with the data org (parent) ID as some Apollo data may be linked to the parent

## Expected Result After Fix

**ICP Coverage by Source table**:
- CRM row: Scored 16,000 | ICP-Fit 9,414 | 59% ICP-Fit
- Database row: Scored 1,125,619 | ICP-Fit ~675K est. | ~60% ICP-Fit (Apollo data)

**ICP Coverage Panel (donut)**:
- Center: "59% ICP-Fit" (instead of "17% High-Fit")
- Summary: "ICP-Fit: 9,414" (instead of "High-Fit: 2,798")
- Leads tab: "ICP-Fit: 15,113" (instead of "High-Fit: 2,420")

