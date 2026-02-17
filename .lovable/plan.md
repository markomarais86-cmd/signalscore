

# Refresh Stale Materialized View Cache for Parent Org

## Problem
The materialized view cache (`dashboard_metrics_cache`) for the parent org (Launchpulse) was last refreshed on January 15th and shows stale numbers. The live query returns 39,928 accounts but the cache shows 14,360.

## Solution
Invoke the `scheduled-cache-refresh` edge function with `force: true` to refresh all materialized views immediately. This will update `dashboard_metrics_cache`, `leads_metrics_cache`, and all other cached views.

## Technical Steps

1. **Call the deployed `scheduled-cache-refresh` edge function** with `{ "force": true }` to bypass the 15-minute cooldown and refresh all 6 materialized views:
   - `dashboard_metrics_cache`
   - `leads_metrics_cache`
   - `account_score_distribution_cache`
   - `enrichment_coverage_cache`
   - `pipeline_velocity_cache`
   - `icp_performance_cache`

2. **Verify** the refresh succeeded by checking the response and confirming the parent org's `dashboard_metrics_cache` now shows the correct total (39,928 accounts).

No code changes are needed -- this is a one-time operational action using the existing edge function.

