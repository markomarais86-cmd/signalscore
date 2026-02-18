

## Fix KPI Card Color Thresholds

### Problem

Three KPI cards show red because they all share a single `getBenchmarkColor/getBenchmarkBg` function with fixed thresholds (>=70 green, >=40 yellow, <40 red). But each metric has a different "healthy" range:

- **Priority Accounts**: 24% of total accounts are high-fit. Per the Score Bands doc, A-band should be 10-20%, so 24% is actually excellent -- should be green.
- **Pipeline Potential**: Shows $0 because `campaignReadyAccounts` is passed as 0 from the dashboard (likely the SOM/settings fix hasn't propagated). When $0, the hardcoded benchmark is 30 (red).
- **Revenue at Risk**: Any non-zero value gets benchmark 30 (red). While this is directionally correct as a warning, the color logic should be more nuanced.

### Changes

**File: `src/components/executive/GrowthCommandKPIs.tsx`**

Replace the hardcoded `benchmarkPercent` values with metric-appropriate thresholds:

1. **Priority Accounts** -- Use percentage of *scored* accounts (not total), and lower the green threshold. If high-fit is >=10% of scored, that's healthy (green). Below 5% is concerning (red).

```typescript
// BEFORE
benchmarkPercent: totalAccounts > 0 ? Math.round((priorityCount / totalAccounts) * 100) : 0,

// AFTER
benchmarkPercent: totalScored > 0
  ? (priorityCount / totalScored >= 0.10 ? 80 : priorityCount / totalScored >= 0.05 ? 50 : 20)
  : 50,
```

2. **Pipeline Potential** -- Green when there are campaign-ready accounts AND a non-zero value. Yellow when there are campaign-ready accounts but $0 (settings issue). Red only when no campaign-ready accounts at all.

```typescript
// BEFORE
benchmarkPercent: pipelinePotential > 0 ? 60 : 30,

// AFTER
benchmarkPercent: pipelinePotential > 0 ? 80 : campaignReadyAccounts > 0 ? 50 : 30,
```

3. **Revenue at Risk** -- Invert the severity: if most accounts are scored (low risk), show green. If a large portion is unscored, show red. Use ratio of unscored-to-total.

```typescript
// BEFORE  
benchmarkPercent: revenueAtRisk > 0 ? 30 : 80,

// AFTER
benchmarkPercent: totalAccounts > 0
  ? (totalScored / totalAccounts >= 0.80 ? 50 : totalScored / totalAccounts >= 0.50 ? 40 : 20)
  : 50,
```
This makes Revenue at Risk yellow (caution) when 80%+ are scored (since some risk remains), and red only when less than 50% are scored. Fully scored (revenueAtRisk === 0) keeps the existing green (80).

### Also Investigate: Pipeline Potential showing $0

The `campaignReadyAccounts` prop is showing 0 in the KPIs despite the database cache having 1,515. I'll trace the prop from `ExecutiveDashboard.tsx` to confirm the value is being passed correctly after the recent SOM fix. If `campaignReadyAccounts` is sourced from the CRM-filtered view (which may return 0 for the "CRM" tab), that explains both this $0 and the SOM $0 on the Market Sizing card.

### Expected Result

After the fix:
- **Market Coverage** (96%): stays green
- **Data Completeness** (97%): stays green
- **Priority Accounts** (9,609 = ~43% of scored): green (well above 10% threshold)
- **Pipeline Potential** ($0): yellow (campaign-ready accounts exist but value is $0 due to settings/source filter)
- **Revenue at Risk** ($198.3M): yellow (56% scored, caution but not critical)

### Summary

One file changes: `GrowthCommandKPIs.tsx`. Replace the three hardcoded `benchmarkPercent` values with metric-appropriate logic that reflects actual business health thresholds.
