

# Fix Dashboard Data Issues - Complete Resolution

## Root Cause Summary

After deep investigation of the actual database state, here is what's happening:

### The Real Data State

| Metric | Launchpulse (parent) | Ninety One Life (child) |
|--------|---------------------|------------------------|
| Accounts | 39,928 | 39,928 (inherited from parent) |
| Scores (parent org_id) | 22,307 scored: 9,099 high / 11,717 med / 1,491 low | -- |
| Scores (child org_id) | -- | 39,928 scored: **19 high** / 23,988 med / 15,921 low |
| ICPs | **None** | 2 active ICPs |
| Apollo (external_data_sources) | 66,818 accounts (synced Feb 17) | 188,955 accounts (synced Feb 18) |
| Matview staleness | **2 days old** (Feb 17) | Cache was invalidated, recomputes on load |

### Problems Identified

1. **Materialized views are stale** -- `dashboard_metrics_cache` and `leads_metrics_cache` haven't been refreshed since Feb 17. The parent org dashboard reads directly from these stale matviews.

2. **Child org genuinely has only 19 high-fit accounts** -- This is the actual scoring result, not a cache bug. The child org's scoring run (using `chunked_v3_soft_penalty`) against its ICPs produced this distribution. The previous scoring may have used different thresholds or ICP weights.

3. **Data completeness RPC times out** -- `get_data_completeness` is hitting statement timeout, returning 0%.

4. **Apollo data source resolution** -- Already fixed in the previous code change (falls back to parent org).

5. **DataHealthWidget** -- Already fixed to use `dataOrgId` in the previous change.

## Fix Plan

### Step 1: Refresh Materialized Views (Database Migration)

Run SQL migration to refresh the stale materialized views so the parent org (Launchpulse) shows current data:

```text
REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_metrics_cache;
REFRESH MATERIALIZED VIEW CONCURRENTLY leads_metrics_cache;
```

This will update the parent org's metrics from the 2-day-old snapshot to current values.

### Step 2: Fix `get_data_completeness` Timeout (Database Migration)

The `get_data_completeness` RPC is timing out on 39,928 accounts. Need to optimize it or add a timeout-safe fallback. Investigate the function source and add appropriate indexes or simplify the query.

### Step 3: Verify Apollo TAM Display for Launchpulse

The parent org has Apollo data (66,818 accounts, 280,636 contacts) stored under its org_id in `external_data_sources`. The `useDashboardData` hook first queries with `effectiveOrgId` (which is correct for the parent), so this should already work. Need to verify the `is_active` filter -- the parent has an **active** Apollo record.

However, the parent **also** has an **inactive** ZoomInfo record. The query uses `.eq('is_active', true)` which correctly filters it out.

### Step 4: Address the 19 High-Fit Scoring Issue

The child org scoring genuinely produced only 19 high-fit accounts (overall score >= 70). This is a scoring calibration issue, not a display bug. Options:
- **Re-run scoring** with adjusted ICP weights if the current distribution doesn't match expectations
- **Adjust thresholds** -- if the scoring model produces mostly 40-69 scores, the 70+ threshold for "high fit" may be too aggressive
- **Leave as-is** if the scoring is intentionally strict

This is a business decision, not a code fix.

### Step 5: No Code Changes Needed Beyond Previous Fix

The code changes from the previous message (Apollo fallback in `checkDataFreshness`, `DataHealthWidget` using `dataOrgId`) are already applied and correct. No additional frontend code changes are required.

## Technical Details

### Files Modified (already done):
- `src/pages/ExecutiveDashboard.tsx` -- Apollo staleness check falls back to parent org
- `src/components/executive/DataHealthWidget.tsx` -- Uses `dataOrgId` for account/lead queries

### Database Operations Needed:
1. **Migration**: `REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_metrics_cache`
2. **Migration**: `REFRESH MATERIALIZED VIEW CONCURRENTLY leads_metrics_cache`
3. **Investigate**: `get_data_completeness` function for timeout optimization

### What Will Improve After Matview Refresh:
- Launchpulse dashboard will show current account/lead counts
- Launchpulse Apollo/database tab will correctly show 66,818 TAM accounts
- Launchpulse scoring distribution will update to current values (9,099 high / 11,717 med / 1,491 low)

### What Won't Change (by design):
- Ninety One Life showing 19 high-fit accounts -- this is the actual child-org scoring result
- Launchpulse showing no ICPs -- ICPs are client-specific, stored under child org only
- Data completeness showing 0% -- requires optimizing the `get_data_completeness` RPC separately

