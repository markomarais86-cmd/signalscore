

# Fix Dashboard Slow Loading and Missing Data for Child Orgs

## Root Cause

The dashboard for the child org "Ninety One Life" (`cd592f73`) is timing out because:

1. **`get_dashboard_metrics_cached` RPC times out** -- For child orgs, it runs live JOIN queries across `accounts` (40K rows in parent org) and `scores` (16K rows in child org) plus a Leads JOIN (53K rows). Each query takes 1-2 seconds, and with all the FILTER clauses the full function exceeds the statement timeout.

2. **`computeDataCompleteness` is extremely expensive** -- It fetches all 16,000 scored `external_id`s, then makes 32 batched queries (500 per batch), each with 6 sub-queries for field completeness. That is roughly 192 separate database calls.

3. **`checkDataFreshness` polls every 3 seconds** -- It fires 6+ additional queries on every poll cycle, piling onto an already overloaded database.

## Solution

### 1. Cache child org metrics in the database (SQL migration)

Create a `child_dashboard_metrics_cache` table that stores pre-computed metrics for child orgs. Update the `get_dashboard_metrics_cached` function to:
- Check the cache table first
- If a cached row exists and is less than 5 minutes old, return it immediately
- Otherwise, compute the metrics, store them in the cache, and return

This turns a 5+ second query into a sub-millisecond lookup for subsequent loads.

```sql
CREATE TABLE IF NOT EXISTS child_dashboard_metrics_cache (
  org_id UUID PRIMARY KEY REFERENCES organizations(id),
  metrics JSONB NOT NULL,
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE child_dashboard_metrics_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON child_dashboard_metrics_cache
  FOR ALL USING (false);
```

Then update `get_dashboard_metrics_cached` to check this cache first for child orgs.

### 2. Simplify `computeDataCompleteness` for child orgs

Replace the 192-query approach with a single SQL query using conditional aggregation:

```sql
SELECT 
  COUNT(*) as total,
  COUNT(industry_norm) as has_industry,
  COUNT(employee_count) as has_employee,
  COUNT(revenue_range) as has_revenue,
  COUNT(country) as has_country,
  COUNT(domain) as has_domain
FROM accounts a
INNER JOIN scores s ON s.account_external_id = a.external_id 
  AND s.org_id = '<child_org_id>'
WHERE a.org_id = '<parent_org_id>'
```

This replaces 192 queries with 1 query.

### 3. Reduce `checkDataFreshness` polling frequency

Change the polling interval from 3 seconds to 30 seconds, and batch the 6 queries into a single query where possible. The polling is only needed to detect active scoring jobs and data staleness -- neither changes within 3-second windows.

### 4. Add the `campaign_ready_accounts` metric to the child org branch

The current child org branch of the RPC function does not return `campaign_ready_accounts` or `both_accounts`, so those show as 0 on the dashboard. Add them to the child org query.

## Files to Change

| File | Change |
|------|--------|
| SQL migration (new) | Create `child_dashboard_metrics_cache` table; update `get_dashboard_metrics_cached` to use it for child orgs; add missing metrics |
| `src/hooks/use-dashboard-data.ts` | Replace batched `computeDataCompleteness` with single SQL query; reduce `checkDataFreshness` frequency |
| `src/pages/ExecutiveDashboard.tsx` | Change polling interval from 3s to 30s |

## Expected Result

- Dashboard loads in under 1 second for child orgs (cached metrics)
- Database load reduced by ~95% (192 queries down to 1 for completeness; cached RPC)
- Data stays fresh with 5-minute cache TTL and manual refresh option
