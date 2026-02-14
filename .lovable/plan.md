

# Declutter the Growth Command Center

## Problem

The dashboard currently has too many sections stacked vertically, making it messy and overwhelming:

1. Growth Command KPIs (5 tiles)
2. ICP Coverage Panel
3. **ICP Performance Matrix** (full-width scatter chart)
4. 3-column grid (ICP Table, TAM Card, Geography Card)
5. **Priority Revenue Accounts** (full-width table)
6. Data Health + AI Insights

Items 3 and 5 are account/ICP-level detail that belongs on dedicated pages, not an executive summary.

## What Changes

**Remove from Dashboard** (`src/pages/ExecutiveDashboard.tsx`):
- Remove `<ICPPerformanceMatrix />` and its import
- Remove `<PriorityRevenueAccounts />` and its import

**Add to ICP Manager** (`src/pages/ICPManager.tsx`):
- Add `<ICPPerformanceMatrix />` to the ICP detail view, passing the selected ICP's ID so the scatter chart scopes to that profile

**Add to Accounts page** (`src/pages/Accounts.tsx`):
- Add `<PriorityRevenueAccounts />` above or below the accounts table as a "Priority Accounts" section

## Resulting Dashboard Layout (cleaner)

1. Growth Command KPIs (5 tiles)
2. ICP Coverage Panel
3. 3-column grid (ICP Table, TAM Card, Geography Card)
4. Data Health + AI Insights

Four sections instead of six -- focused on executive-level metrics. The detailed account-level and ICP scatter views live where users expect them: on the Accounts and ICP pages.

## Files Changed

| File | Change |
|------|--------|
| `src/pages/ExecutiveDashboard.tsx` | Remove ICPPerformanceMatrix and PriorityRevenueAccounts imports and JSX |
| `src/pages/ICPManager.tsx` | Import and render ICPPerformanceMatrix in the ICP detail view, scoped to selected ICP |
| `src/pages/Accounts.tsx` | Import and render PriorityRevenueAccounts as a summary section |

No components are deleted -- they are just relocated to the correct pages.
