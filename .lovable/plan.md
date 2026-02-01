

# Fix CRM Badge Count Showing 0 Instead of 14,360

## Problem Summary

The CRM filter badge shows **0** instead of **14,360** accounts because of a race condition in `useSourceFilterStats`.

| What's happening | What should happen |
|------------------|-------------------|
| `filterStats?.crm` returns `0` | Should return `14,360` |

**Root Cause:** The `useSourceFilterStats` hook tries to derive values from the `useDashboardData` cache, but runs its query *before* the dashboard data is loaded. The fallback returns `crm: 0`.

```typescript
// Current problematic code in use-dashboard-data.ts
export function useSourceFilterStats(orgId: string | undefined) {
  const { data: dashboardData } = useDashboardData(orgId, 'crm');  // <-- May not be loaded yet
  
  return useQuery({
    queryFn: async () => {
      if (dashboardData?.metrics) {  // <-- FALSE on initial load!
        return { crm: dashboardData.metrics.total_crm_accounts, ... };
      }
      // Falls through to:
      return { crm: 0, ... };  // <-- BUG: Returns 0!
    },
  });
}
```

---

## Solution

Make `useSourceFilterStats` **wait for dashboard data** before running, or fetch its own data independently.

### Option A: Derive from Cache (Simpler - Recommended)

Don't use a separate `useQuery` - directly derive from the dashboard cache:

```typescript
export function useSourceFilterStats(orgId: string | undefined) {
  const { data: dashboardData, isLoading } = useDashboardData(orgId, 'crm');
  
  // Directly derive stats from loaded dashboard data
  const stats = dashboardData?.metrics 
    ? {
        crm: dashboardData.metrics.total_crm_accounts || dashboardData.metrics.total_accounts || 0,
        database: dashboardData.tamData?.totalAccounts || 0,
      }
    : { crm: 0, database: 0 };
  
  return { 
    data: stats, 
    isLoading 
  };
}
```

This ensures:
1. No race condition - stats come from the same data source
2. Stats update automatically when dashboard data refreshes
3. Badge shows correct count as soon as dashboard loads

### Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/use-dashboard-data.ts` | Simplify `useSourceFilterStats` to derive from cache directly |

---

## Technical Details

### Why the Current Implementation Fails

The current hook structure:
1. `useSourceFilterStats` creates its own React Query with key `['source-filter-stats', orgId]`
2. Both queries start executing at the same time on page load
3. When `useSourceFilterStats.queryFn` runs, `dashboardData` is still `undefined`
4. The fallback returns `{ crm: 0, database: ... }`
5. Later, dashboard data loads, but the stats query is already cached with `crm: 0`
6. The stats query never re-runs because its dependencies (`orgId`) haven't changed

### The Fix

By making `useSourceFilterStats` directly return derived data from `useDashboardData`, we eliminate the race condition. The component will re-render when dashboard data arrives, and the derived stats will have the correct values.

---

## Expected Outcome

After this fix:
1. CRM badge will show **14,360** immediately after dashboard loads
2. Database badge will show the Apollo TAM count
3. No more race condition between data loading
4. Stats automatically update when dashboard data refreshes

