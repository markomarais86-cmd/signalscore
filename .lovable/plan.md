
# Fix: Child Org Account Count Shows Parent's Full Dataset

## Problem
When viewing the dashboard as "Ninety One Life" (child org), the Market Coverage KPI shows **39,928 accounts** -- which is the entire parent org (Launchpulse) dataset. Ninety One Life has only scored **3,000 accounts** against their ICP, so the dashboard should reflect that subset, not the full parent universe.

## Root Cause
The `get_dashboard_metrics_cached` database function uses a `LEFT JOIN` between parent accounts and child scores for child orgs. This means `COUNT(*)` returns ALL 39,928 parent accounts, even though only 3,000 are relevant to the child org.

## Solution
Update the SQL function so that for child orgs, only accounts that have been scored by the child org are counted in `total_accounts`. This changes the join from `LEFT JOIN` to `INNER JOIN` for the child-org branch.

Additionally, the `computeDataCompleteness` function in the frontend also counts all parent accounts -- this needs the same fix to only count scored accounts for child orgs.

## Technical Changes

### 1. Database Migration -- Update `get_dashboard_metrics_cached`
For the child org branch (line ~51 onward), change:
```text
FROM accounts a
LEFT JOIN scores s ON s.account_external_id = a.external_id AND s.org_id = p_org_id
WHERE a.org_id = v_data_org_id
```
to:
```text
FROM accounts a
INNER JOIN scores s ON s.account_external_id = a.external_id AND s.org_id = p_org_id
WHERE a.org_id = v_data_org_id
```

This ensures `total_accounts` only counts accounts that have scores for the child org (3,000 instead of 39,928). All the fit-level counts already use `COUNT(s.id)` so they remain correct.

### 2. Frontend -- Fix `computeDataCompleteness` in `use-dashboard-data.ts`
Currently counts all accounts for `resolvedDataOrgId` (parent org). For child orgs, it should only count accounts that have been scored by the child. Add a filter to only count accounts that exist in the child org's `scores` table.

This involves:
- Passing the child `orgId` alongside `resolvedDataOrgId` to `computeDataCompleteness`
- When they differ (child org scenario), query only accounts whose `external_id` appears in the child's `scores` table

### 3. Also fix leads query in same function
The leads branch for child orgs also uses a similar pattern and should use `INNER JOIN` to scores to only count leads linked to scored accounts.

## Expected Result
- Ninety One Life dashboard shows ~3,000 accounts (scored subset)
- Parent org (Launchpulse) dashboard continues showing 39,928 (all their accounts)
- Data completeness percentage reflects only the relevant account subset
- All fit-level breakdowns remain accurate
