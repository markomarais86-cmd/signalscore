

## Fix: Geography Data Missing for Child Organizations (91.life)

### Root Cause

The `useGeographyData` hook on line 74 of `ExecutiveDashboard.tsx` passes `effectiveOrgId` (the child org ID `cd592f73`) to the `get_geography_distribution` RPC. However, all 39,928 accounts belong to the parent org (`726a0dc0`). The RPC filters `WHERE org_id = p_org_id`, so it returns 0 rows for 91.life.

Other dashboard hooks (like `useDashboardData`) already accept a `dataOrgId` parameter that resolves to the parent org for shared data queries, but `useGeographyData` was never updated to use it.

### Fix

**File: `src/hooks/use-dashboard-data.ts`**

- Update `useGeographyData` to accept an optional `dataOrgId` parameter
- Use `dataOrgId` (falling back to `orgId`) when calling the RPC, matching the pattern used by `useDashboardData`

```typescript
export function useGeographyData(
  orgId: string | undefined,
  enabled: boolean = true,
  sourceFilter: 'crm' | 'database' = 'crm',
  dataOrgId?: string  // NEW: parent org ID for child orgs
) {
  const resolvedOrgId = dataOrgId || orgId;
  // ... use resolvedOrgId in the RPC call
}
```

**File: `src/pages/ExecutiveDashboard.tsx`**

- Pass `dataOrgId` to `useGeographyData`:

```typescript
const { data: geographyData } = useGeographyData(
  effectiveOrgId, !!dashboardData, sourceFilter, dataOrgId ?? undefined
);
```

### Technical Details

This is a one-line change in each file. The `dataOrgId` is already computed via `useDataOrgId()` on the dashboard page and correctly resolves to the parent org for child organizations.

### Expected Result

- 91.life geography card shows the same distribution as LaunchPulse (US: 27,375, UK: 4,055, etc.)
- LaunchPulse dashboard is unaffected (dataOrgId equals effectiveOrgId for parent orgs)

