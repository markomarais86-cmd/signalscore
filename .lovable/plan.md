

# Fix Plan: Dashboard Data Issues for Both Organizations

## Root Cause Analysis

After thorough investigation, I found several distinct problems affecting both orgs:

### Launchpulse (parent org) Issues:
1. **No ICP profiles exist** - All ICPs were created under the child org (Ninety One Life), so when viewing Launchpulse directly, ICP-dependent features (market sizing, ICP fit, smart insights) have nothing to work with
2. **Leads metrics cache is stale** - Last refreshed Jan 15, showing 63,516 leads vs actual 53,303
3. **17,621 accounts are unscored** at the parent level (only 22,307 of 39,928 have scores under Launchpulse)
4. **Dashboard materialized views need refresh** to pick up current data

### Ninety One Life (child org) Issues:
1. **Apollo/external data source checks use `effectiveOrgId`** instead of resolving to the correct org - several queries in `ExecutiveDashboard.tsx` (lines 236-240 for Apollo staleness, and the `checkDataFreshness` function) query `external_data_sources` using only the child org ID
2. **Only 19 high-fit accounts** out of 39,928 scored - the scoring thresholds (70+ for high fit) combined with the `chunked_v3_soft_penalty` scoring version may be producing mostly medium/low scores
3. **Data completeness, priority accounts, pipeline potential** all derive from the cached metrics which show this skewed distribution

## Fix Steps

### Step 1: Refresh Materialized Views (Database)
Run SQL to refresh the stale materialized views for the parent org so Launchpulse shows current data:
- Refresh `dashboard_metrics_cache`
- Refresh `leads_metrics_cache`
- Invalidate the child's `child_dashboard_metrics_cache` so it recomputes on next load

### Step 2: Fix Dashboard Queries Using Wrong Org ID (Code)
In `src/pages/ExecutiveDashboard.tsx`, the `checkDataFreshness` function queries several tables using only `effectiveOrgId` when it should also check `dataOrgId` for shared data. Specifically:
- **Apollo stale check** (lines 235-240): queries `external_data_sources` with `effectiveOrgId` -- should also fall back to `dataOrgId`
- **ICP profiles check** (lines 206-210, 228-233): correctly uses `effectiveOrgId` since ICPs are per-child-org
- **Scores check** (lines 214-218): uses `effectiveOrgId` -- correct since scores are per-child-org

The fix: Pass `dataOrgId` into `checkDataFreshness` and use it for Apollo data lookups (since `external_data_sources` may be stored under either org).

### Step 3: Fix ICP Display for Launchpulse (Code)
When viewing Launchpulse directly (not via child org), the dashboard shows "ICP is not defined" because ICPs only exist under the child org. Two options:
- **Option A**: The dashboard, when viewing a parent org, should show a message like "View client org for ICP data" since ICPs are client-specific
- **Option B**: Copy or reference the child's ICPs when viewing the parent

Recommended: Option A -- parent orgs are data containers; ICP/scoring views should direct users to use the org switcher to view a specific client.

### Step 4: Fix Smart Insights Query (Code)
The `generateInsights` function likely queries ICP profiles and scores using `effectiveOrgId`. When viewing Launchpulse (no ICPs, different score versions), it produces wrong or empty insights. Need to verify this function also handles the parent-org case gracefully.

### Step 5: Refresh Leads Count Mismatch (Database)
The `leads_metrics_cache` for Launchpulse shows 63,516 but actual count is 53,303. This is because the materialized view hasn't been refreshed since January. The refresh in Step 1 will fix this.

## Technical Details

### Files to Modify:
1. **`src/pages/ExecutiveDashboard.tsx`** - Pass `dataOrgId` to `checkDataFreshness`, fix Apollo staleness check to fall back to parent org
2. **Database** - Refresh materialized views and invalidate child cache

### SQL to Execute:
```text
-- Refresh materialized views
REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_metrics_cache;
REFRESH MATERIALIZED VIEW CONCURRENTLY leads_metrics_cache;

-- Invalidate child cache to force recomputation
DELETE FROM child_dashboard_metrics_cache 
WHERE org_id = 'cd592f73-3e0e-478d-905b-47fe7c5fb634';
```

### Code Changes Summary:
- Update `checkDataFreshness` to accept and use `dataOrgId` for external data source queries
- Add parent-org awareness to the dashboard so it handles the "no ICP" case gracefully instead of showing broken widgets
- Ensure geography, data health, and pipeline potential widgets handle the parent-org view correctly

