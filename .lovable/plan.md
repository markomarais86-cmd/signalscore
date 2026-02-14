

# Fix Growth Command KPI Tiles

## Problem Summary

Three issues with the current 5 KPI tiles:

1. **Market Coverage** -- when on CRM view, `totalAccounts` and `tamEstimate` both resolve to the same number (line 579 falls back to `totalAccounts`), so it shows 100% or a confusing percentage. The "so what" text says "14,000 of 66,000" but the 66K TAM number may not be loaded.

2. **Revenue-Ready** -- tracks accounts with contacts, but LaunchPulse doesn't use contacts as a core workflow. This tile shows 0% and is not meaningful for your use case.

3. **Pipeline Potential** -- hardcoded benchmark of 70 (always green), and the formula `campaignReadyAccounts * 75000 * 0.25` uses a static deal size. Feels artificial.

## What Was There Before

The previous version used `SimplifiedHeroMetrics.tsx` which showed 3 simpler tiles:
- **Total Accounts** (raw count)
- **Total Leads** (raw count)
- **Campaign Ready** (raw count)

These were replaced by the 5 Growth Command tiles (Market Coverage, Revenue-Ready, Priority Accounts, Pipeline Potential, Revenue at Risk).

## Proposed Changes

Replace the **Revenue-Ready** tile with a more relevant metric, and fix the data issues on the others.

### Tile 1: Market Coverage -- Fix data mapping
- When no external TAM source exists, show the raw account count instead of a meaningless "100%"
- Change to: show `totalAccounts` as the value, with "of X TAM" in the subtitle only when TAM data actually exists
- When TAM is available, keep the percentage

### Tile 2: Replace "Revenue-Ready" with "Data Completeness"
- Shows the `data_completeness` percentage from dashboard metrics (already available)
- "So what" text: explains how many fields are filled across accounts
- Links to `/enrichment` on click
- This is actionable and relevant -- it tells you how enriched your data is

### Tile 3: Priority Accounts -- No change needed
Works correctly, shows high-fit account count.

### Tile 4: Pipeline Potential -- Use real deal data if available
- Check if deals exist; if so, sum actual deal amounts instead of the static formula
- Fall back to the modelled formula only when no deals are present
- Remove the hardcoded `benchmarkPercent: 70`

### Tile 5: Revenue at Risk -- No change needed
Already uses data completeness gap to model risk.

## Files Changed

| File | Change |
|------|--------|
| `src/components/executive/GrowthCommandKPIs.tsx` | Replace Revenue-Ready tile with Data Completeness; fix Market Coverage to handle missing TAM gracefully; improve Pipeline Potential benchmark logic |
| `src/pages/ExecutiveDashboard.tsx` | Update props passed to `GrowthCommandKPIs` -- replace `accountsWithContacts` with `dataCompleteness`, pass deal totals if available |

## Technical Details

### Updated Props Interface

```typescript
interface GrowthCommandKPIsProps {
  totalAccounts: number;
  tamEstimate: number;
  dataCompleteness: number;        // replaces accountsWithContacts
  highFitAccounts: number;
  campaignReadyAccounts: number;
  pipelinePotential: number;
  revenueAtRisk: number;
  averageDealSize: number;
}
```

### Market Coverage Logic Fix

```typescript
// When TAM exists and differs from totalAccounts, show percentage
// When no TAM, show raw account count instead of fake 100%
const hasTAM = tamEstimate > 0 && tamEstimate !== totalAccounts;
```

### Data Completeness Tile

```typescript
{
  label: "Data Completeness",
  value: `${dataCompleteness}%`,
  soWhat: dataCompleteness >= 80
    ? "Strong enrichment -- ready for scoring"
    : "Enrich accounts to improve scoring accuracy",
  icon: Database,
  benchmarkPercent: dataCompleteness,
  onClick: () => navigate("/enrichment"),
}
```

### Dashboard Props Update (ExecutiveDashboard.tsx)

```typescript
<GrowthCommandKPIs
  ...
  dataCompleteness={dataCompleteness}  // already computed in dashboard
  ...
/>
```

Two files, focused edits. No new dependencies.
