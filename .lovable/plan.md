

# Fix Data Completeness KPI — Use Server-Side Aggregation

## Root Cause

The `computeDataCompleteness` function in `use-dashboard-data.ts` fetches all account rows to the client and counts non-null fields in JavaScript. However, Supabase PostgREST returns a **maximum of 1000 rows by default**. With 14,361 accounts in the database, the function only processes ~7% of accounts, producing an inaccurate (or 0%) result.

Your actual data completeness is approximately **92%** based on direct database counts:
- industry_norm: 12,407 / 14,361 = 86%
- employee_count: 11,446 / 14,361 = 80%
- revenue_range: 13,165 / 14,361 = 92%
- country: 14,324 / 14,361 = 99.7%
- domain: 14,361 / 14,361 = 100%
- Average: ~91.5%

## Fix

Replace the client-side row-by-row computation with a single efficient SQL aggregation using Supabase's `.rpc()` or a direct count query that calculates completeness server-side.

### File: `src/hooks/use-dashboard-data.ts`

Replace the `computeDataCompleteness` function with one that runs 6 small `count` queries (total + one per field) instead of fetching all rows:

```typescript
async function computeDataCompleteness(orgId: string): Promise<number> {
  const fields = ['industry_norm', 'employee_count', 'revenue_range', 'country', 'domain'];

  // Get total count + per-field non-null counts in parallel
  const [totalResult, ...fieldResults] = await Promise.all([
    supabase.from('accounts').select('*', { count: 'exact', head: true }).eq('org_id', orgId),
    ...fields.map(f =>
      supabase.from('accounts').select('*', { count: 'exact', head: true })
        .eq('org_id', orgId).not(f, 'is', null)
    ),
  ]);

  const total = totalResult.count || 0;
  if (total === 0) return 0;

  const filledSum = fieldResults.reduce((sum, r) => sum + (r.count || 0), 0);
  return Math.round((filledSum / (total * fields.length)) * 100);
}
```

This approach:
- Runs 6 lightweight HEAD requests (no row data transferred)
- No row limit issues since it uses `count: 'exact'`
- Returns the accurate ~92% completeness
- Is faster than fetching 14k+ rows

No other files need changes since the rest of the pipeline (dashboard page passing `dataCompleteness` to `GrowthCommandKPIs`) is already wired correctly.
