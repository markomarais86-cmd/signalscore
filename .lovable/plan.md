

# Fix Multiple Dashboard Issues for Child Org View

## Issues Identified

### 1. Data Completeness KPI shows 0% in red -- should be neutral
When no accounts have been scored by the child org, `computeDataCompleteness` returns 0. The KPI tile renders "0%" in red (`getBenchmarkColor(0) = text-destructive`). If there's no data to measure, the tile should show a neutral/grey state instead of alarming red.

**Fix in `GrowthCommandKPIs.tsx`:**
- When `dataCompleteness === 0` AND `totalAccounts === 0` (or `totalScored === 0`), display the tile as neutral ("--" value, grey styling) instead of red 0%.

### 2. Data Quality Alert says "100% incomplete" when there's nothing to be incomplete
The StatusBar's `buildStatusItems` shows a warning when `dataCompleteness < 70` and `totalAccounts > 0`. For the child org, `totalAccounts` is 16,000 (from the cached metrics) but `dataCompleteness` is 0 because the completeness function returns 0 when no scores exist.

**Fix in `StatusBar.tsx` `buildStatusItems`:**
- Add a guard: only show the data quality warning when `dataCompleteness > 0` (i.e., there's actual completeness data to report). When it's exactly 0 with no scores, it's not "incomplete" -- it's "not yet measured."

### 3. Geography, Data Health, and Market Sizing cards don't collapse/fold
These three cards (`SimpleGeographyCard`, `DataHealthWidget`, `SimpleTAMCard`) are plain Card components without any collapsible wrapper.

**Fix in `ExecutiveDashboard.tsx`:**
- Wrap each of these three cards in a `Collapsible` component with a toggle button in the card header.
- Create a small reusable `CollapsibleCard` wrapper or add `Collapsible` directly to each card component.
- Default to open, allow user to collapse.

### 4. Apollo sync stores data under child org_id but user can't read it (RLS mismatch)
**Root cause:** When the user switches to Ninety One Life (child org) and clicks "Sync Apollo", the `handleSyncApollo` function sends `effectiveOrgId` (the child org `cd592f73`) to the edge function. The edge function uses the service role key to write to `external_data_sources` with `org_id = cd592f73`. However, the user's `user_profiles.org_id` is `726a0dc0` (parent/Launchpulse). The RLS policy on `external_data_sources` checks `org_id = get_current_user_org_id()` which returns the parent org. So the user can't read the child org's data.

**Fix:** Two options:
- **Option A (recommended):** Update the RLS SELECT policy on `external_data_sources` to also allow access when the row's `org_id` is a child of the user's org: `org_id = get_current_user_org_id() OR org_id IN (SELECT id FROM organizations WHERE parent_org_id = get_current_user_org_id())`
- This follows the parent-child architecture where parent org users can see child org data.

### 5. "Contacts" should be "Leads" in Database tab terminology
The `sync-external-provider` stores `total_contacts` and the UI references "contacts" in the sync breakdown. Per the project constraints, person records are called "Leads" not "contacts."

**Fix in `SimpleTAMCard.tsx` or wherever "contacts" appears in the Database view:**
- Rename label references from "contacts" to "leads" in the UI.

### 6. Dashboard shows empty state ("Welcome to LaunchPulse!") despite having 16,000 accounts
The `showEmptyState` check uses `effectiveAccountCount === 0`. In CRM mode, this uses `totalAccounts` which comes from `get_dashboard_metrics_cached`. For the child org, if that RPC returns 0, the empty state shows. But the child actually has 16,000 scored accounts.

This is likely also related to the RPC using the child org_id but the underlying data living under the parent org_id. The `get_dashboard_metrics_cached` RPC may need to account for child org filtering (scoring data from child + account data from parent).

**Fix:** Verify the RPC handles child orgs. If not, adjust the empty state guard to also check if `totalScores > 0`.

## Technical Summary

| File | Change |
|------|--------|
| `GrowthCommandKPIs.tsx` | Neutral state for 0% completeness when no data |
| `StatusBar.tsx` | Guard data quality warning when completeness is exactly 0 with no scores |
| `SimpleGeographyCard.tsx` | Add Collapsible wrapper |
| `DataHealthWidget.tsx` | Add Collapsible wrapper |
| `SimpleTAMCard.tsx` | Add Collapsible wrapper, rename "contacts" to "leads" |
| `ExecutiveDashboard.tsx` | Fix empty state guard; pass collapsible state |
| SQL migration | Update `external_data_sources` RLS to include child orgs |

