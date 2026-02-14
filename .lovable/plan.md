

# Fix Data Completeness KPI on Growth Command Center

## Root Cause

The "Data Completeness" KPI tile on the dashboard shows 0% because it reads from the `get_dashboard_metrics_cached` RPC, which **does not return a `data_completeness` field**. The RPC builds its JSON from `dashboard_metrics_cache` and `leads_metrics_cache` tables, neither of which has a `data_completeness` column.

Meanwhile, the Enrichment page correctly shows 95-99% because it calls a different RPC (`get_enrichment_stats`) that computes `data_completeness_pct` live.

## Fix

Compute data completeness directly in the dashboard hook (`use-dashboard-data.ts`) instead of relying on a missing cached field — the same approach the DataHealthWidget already uses successfully.

### Changes

**File: `src/hooks/use-dashboard-data.ts`**

1. Add a helper function `computeDataCompleteness(orgId)` that queries the `accounts` table and calculates the percentage of key fields (industry, employee count, revenue, country, domain) that are filled across all accounts.
2. Call it in the `useDashboardData` query function alongside the existing RPC call.
3. Map the result into `data_completeness` in the `mappedMetrics` object, replacing the current `rawMetrics?.data_completeness || 0` which always returns 0.

This is a lightweight query (only needs a count of non-null fields) and will give the dashboard the same accurate completeness percentage that the Enrichment page and DataHealthWidget already show.

### Technical Detail

```
// New helper added to use-dashboard-data.ts
async function computeDataCompleteness(orgId: string): Promise<number> {
  const { data } = await supabase
    .from('accounts')
    .select('industry_norm, employee_count, revenue_range, country, domain')
    .eq('org_id', orgId);

  if (!data || data.length === 0) return 0;

  const fields = ['industry_norm', 'employee_count', 'revenue_range', 'country', 'domain'];
  let filled = 0, total = 0;
  data.forEach(row => {
    fields.forEach(f => { total++; if (row[f] != null && row[f] !== '') filled++; });
  });
  return total > 0 ? Math.round((filled / total) * 100) : 0;
}
```

Then in the query function, call it in parallel with the existing RPCs and use its result for `data_completeness`.

| File | Change |
|------|--------|
| `src/hooks/use-dashboard-data.ts` | Add `computeDataCompleteness` helper, call it in `useDashboardData`, use result for `data_completeness` |

No database migrations needed. No other files need changes since `GrowthCommandKPIs` already receives `dataCompleteness` as a prop from the dashboard page.

