

## Fix: Enrichment Page Shows All Zeros for Child Orgs (91.Life)

### Root Cause

The entire Enrichment page and all its sub-components query `accounts` and `Leads` using `userProfile.org_id` directly. For child orgs like 91.life, accounts live under the parent org (LaunchPulse). This causes every metric, data gap, export, and quality dashboard to return zero.

### Scope of Changes

Every component on the Enrichment page that queries `accounts` or `Leads` needs the parent org resolution. Here is the full list:

| File | Current Query ID | Fix |
|------|-----------------|-----|
| `src/pages/Enrichment.tsx` | `effectiveOrgId` via RPC | Pass resolved `dataOrgId` to `get_enrichment_page_stats` |
| `src/components/enrichment/DataGapsVisualization.tsx` | `userProfile.org_id` (12+ queries) | Use `dataOrgId` for all account queries; keep child org ID for `enrichment_jobs` and edge function calls |
| `src/components/enrichment/ExportAccountsButton.tsx` | `userProfile.org_id` | Use `dataOrgId` for account SELECT queries |
| `src/components/enrichment/ExportLeadsButton.tsx` | `userProfile.org_id` | Use `dataOrgId` for lead SELECT queries |
| `src/components/enrichment/RecentEnrichmentActivity.tsx` | `userProfile.org_id` | Keep as-is (enrichment_jobs belong to the child org) |
| `src/components/enrichment/ICPAccountDiscovery.tsx` | `userProfile.org_id` | Use `dataOrgId` for account lookups; keep child org for ICP profiles |
| `src/components/settings/DataQualityDashboard.tsx` | `userProfile.org_id` | Use `dataOrgId` for account queries; keep child org for RPCs and edge function calls |
| `src/components/settings/EnrichmentQualityDashboard.tsx` | `userProfile.org_id` | Use `dataOrgId` for account queries; keep child org for enrichment_jobs and data_quality_history |
| `src/components/enrichment/EnrichmentAccuracyReport.tsx` | Needs checking | Same pattern if it queries accounts |

### Pattern for Each Fix

Each component will:
1. Import `useDataOrgId` from `@/hooks/use-data-org`
2. Destructure `{ dataOrgId }` from the hook
3. Replace `userProfile.org_id` with `dataOrgId` **only** for queries against `accounts` and `Leads` tables
4. Keep `userProfile.org_id` (or `effectiveOrgId`) for:
   - `enrichment_jobs` (job tracking belongs to the child org)
   - `icp_profiles` and `scores` (belong to child org)
   - Edge function invocations (the functions handle resolution internally)
   - `data_quality_history` (tracked per child org)

### Key Rule

```text
accounts, Leads tables --> use dataOrgId (parent)
enrichment_jobs, icp_profiles, scores, settings --> use effectiveOrgId (child)
```

### Files to Modify

1. `src/pages/Enrichment.tsx`
2. `src/components/enrichment/DataGapsVisualization.tsx`
3. `src/components/enrichment/ExportAccountsButton.tsx`
4. `src/components/enrichment/ExportLeadsButton.tsx`
5. `src/components/enrichment/ICPAccountDiscovery.tsx`
6. `src/components/settings/DataQualityDashboard.tsx`
7. `src/components/settings/EnrichmentQualityDashboard.tsx`
8. `src/components/enrichment/EnrichmentAccuracyReport.tsx` (if applicable)

### Expected Result

After the fix, 91.life's Enrichment page will show the same account totals, data completeness, enriched counts, and data gaps as LaunchPulse, since they share the same underlying account database.
