

# Phase 1: Growth Command Center Polish

## 1. Revenue Language Governance (Currency Consistency)

`GrowthCommandKPIs.tsx` uses **GBP (pound sign)** while every other component across the app (SimpleTAMCard, PipelineAnalyticsDashboard, LossReasonsChart, DealStageBoard, etc.) uses **USD ($)**. This creates a jarring inconsistency.

**Fix:** Change `formatCurrency()` in `GrowthCommandKPIs.tsx` from pound sign to dollar sign, matching the rest of the platform. All 29 files with `formatCurrency` use `$` except this one.

| File | Change |
|------|--------|
| `src/components/executive/GrowthCommandKPIs.tsx` | Replace `£` with `$` in `formatCurrency()` (lines 30-32) |

## 2. Fix DataHealthWidget Org Bug

The `DataHealthWidget` has a subtle impersonation bug on line 28:

```
const orgId = effectiveOrgId || userProfile?.org_id;
```

When an admin switches organizations via the org switcher, `effectiveOrgId` updates immediately, but the fallback to `userProfile?.org_id` means the query can fire with the admin's own org before `effectiveOrgId` resolves. Additionally, the `enabled` guard (`!!orgId`) can pass with the wrong org.

**Fix:** Remove the fallback -- use only `effectiveOrgId` and guard the query with `enabled: !!effectiveOrgId`. This matches the pattern used by the parent `ExecutiveDashboard` which passes `effectiveOrgId` exclusively to all its data hooks.

| File | Change |
|------|--------|
| `src/components/executive/DataHealthWidget.tsx` | Use `effectiveOrgId` directly (no fallback), guard query with `enabled: !!effectiveOrgId` |

## 3. Dashboard Title and Subtitle

The title already says "Growth Command Center" (line 408). The subtitle currently reads:

> "Revenue intelligence across your market -- filter by source for focused insights"

This is fine but can be tightened to reinforce the rebrand:

> "Real-time revenue intelligence across your total addressable market"

| File | Change |
|------|--------|
| `src/pages/ExecutiveDashboard.tsx` | Update subtitle text on line 409 |

## 4. Confirm KPI Tiles Are Correct

The 5 spec tiles are already implemented in `GrowthCommandKPIs`:
- Market Coverage (Globe icon, % of TAM)
- Revenue-Ready (UserCheck icon, % with contacts)
- Priority Accounts (Star icon, high-fit count)
- Pipeline Potential (TrendingUp icon, modelled revenue)
- Revenue at Risk (AlertTriangle icon, data-gap cost)

No structural changes needed -- just the currency fix from item 1 above.

## Summary of Changes

| File | What |
|------|------|
| `src/components/executive/GrowthCommandKPIs.tsx` | Fix `£` to `$` in formatCurrency |
| `src/components/executive/DataHealthWidget.tsx` | Remove `userProfile?.org_id` fallback, use `effectiveOrgId` only |
| `src/pages/ExecutiveDashboard.tsx` | Tighten subtitle copy |

Three small, targeted edits. No new files or dependencies.

