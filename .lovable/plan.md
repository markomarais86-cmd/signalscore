
## Fix: Accounts Not Loading for 91.Life (Child Org)

### Root Cause

91.Life is a **child organization** with `parent_org_id` pointing to LaunchPulse. All 39,928 accounts are stored under the parent org's ID. The Accounts page queries accounts using `effectiveOrgId` (91.Life's own ID), which returns 0 results.

The fix pattern already exists in the codebase -- the `useDataOrgId()` hook resolves to the parent org for data queries. Components like `ExecutiveDashboard`, `AccountInsightsPanel`, and `FieldMappingDialog` already use it. The Accounts page just hasn't been updated yet.

### What Changes

**File: `src/pages/Accounts.tsx`**

1. Import `useDataOrgId` instead of (or alongside) `useEffectiveOrg`
2. Use `dataOrgId` for all **account data queries** (fetching accounts, stats, filter options, counts)
3. Keep `effectiveOrgId` for **ICP/settings queries** (ICP profiles, integration configs, scoring)

Specifically, these query locations switch from `effectiveOrgId` to `dataOrgId`:
- `loadSummaryStats()` -- all account count queries and RPCs
- `useInfiniteAccounts({ orgId: ... })` -- the main account list
- `fetchFilterOptions()` -- country/state filter dropdowns
- `useBatchPredictions(...)` -- predictions for accounts

These stay on `effectiveOrgId` (org-specific settings):
- `fetchIntegrationConfig()` -- CRM integration is per-org
- `fetchActiveIcp()` -- ICP profiles are per-org
- `checkICPStatus()` -- scoring status is per-org

### Technical Details

```text
Current flow (broken for child orgs):
  Accounts.tsx --> useEffectiveOrg() --> 91.Life org ID --> 0 accounts

Fixed flow:
  Accounts.tsx --> useDataOrgId() --> parent (LaunchPulse) org ID --> 39,928 accounts
                   effectiveOrgId still used for ICP/settings
```

This is a single-file change affecting approximately 10-12 lines where `effectiveOrgId` is swapped for `dataOrgId` in account data queries.
