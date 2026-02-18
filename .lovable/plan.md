
# Include Apollo/Database Counts in Child Dashboard Metrics Cache

## Problem
The `get_dashboard_metrics_cached` RPC for child organizations returns `total_database_accounts: 0` and omits `apollo_accounts_available` / `apollo_contacts_available`. This means:

1. The "Database" row in the ICP Coverage table shows 0 scored database accounts (correct -- no database accounts have been scored yet)
2. The Apollo TAM data (1.1M accounts, 3.1M contacts) is only available via a separate `external_data_sources` query, not embedded in the cached metrics

Currently, the frontend has a fallback that queries `external_data_sources` directly for TAM data, so Apollo numbers *should* display. But including Apollo data in the cache makes the metrics self-contained and eliminates a redundant query.

## Changes

### 1. Update `get_dashboard_metrics_cached` RPC (SQL Migration)
Add Apollo data lookup to the child org branch of the function:

- Query `external_data_sources` for the child org's (or parent org's) active Apollo record
- Include `apollo_accounts_available`, `apollo_contacts_available`, and `apollo_provider` in the cached JSON result
- This matches the parent org branch behavior (which gets Apollo data from `dashboard_metrics_cache`)

The new SQL block added inside the child org section (after computing lead metrics, before building `v_result`):

```sql
-- Fetch Apollo/TAM data for cache
SELECT 
  COALESCE(total_accounts, 0),
  COALESCE(total_contacts, 0),
  COALESCE(provider, 'Apollo')
INTO v_apollo_accounts, v_apollo_contacts, v_apollo_provider
FROM external_data_sources
WHERE org_id IN (p_org_id, v_data_org_id)
  AND is_active = true
ORDER BY last_synced_at DESC NULLS LAST
LIMIT 1;
```

Then add to the `v_result` jsonb object:
```sql
'apollo_accounts_available', COALESCE(v_apollo_accounts, 0),
'apollo_contacts_available', COALESCE(v_apollo_contacts, 0),
'apollo_provider', COALESCE(v_apollo_provider, 'Apollo')
```

### 2. No Frontend Changes Needed
The frontend (`use-dashboard-data.ts`) already checks `rawMetrics?.apollo_accounts_available` and uses it when present. Once the RPC includes these fields, the TAM data will load from cache on the first render -- no need for the separate `external_data_sources` fallback query (though it remains as a safety net).

## Expected Result
- Child org dashboard cache now includes Apollo counts (1,125,619 accounts / 3,151,733 contacts)
- The "Database" row in ICP Coverage shows the Apollo TAM totals
- One fewer network query on dashboard load (TAM data comes from cache)
- Cache TTL remains 5 minutes, same as before
