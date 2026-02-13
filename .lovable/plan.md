

# ICP Performance Matrix — Quadrant Chart Component

## What It Does

A 2x2 scatter-plot quadrant chart plotting every scored account by **ICP Fit** (x-axis, 0-100) vs **Intent/Readiness** (y-axis, 0-100). Each dot = one account, colored by quadrant:

```text
                        Intent (high)
                            |
         Nurture            |         Prioritise
     (low fit, high intent) |    (high fit, high intent)
                            |
    ────────────────────────┼────────────────────────
                            |
         Deprioritise       |         Develop
     (low fit, low intent)  |    (high fit, low intent)
                            |
                        Intent (low)
       Fit (low) ─────────────────────── Fit (high)
```

Accounts with deals show as larger dots; won deals get a distinct color.

## Data Source

Query `scores` table joined to `accounts` (for name, industry) and optionally `deals` (for deal status/amount). Uses `effectiveOrgId` so it works correctly with the org switcher.

- **X-axis:** `scores.fit` (0-100)
- **Y-axis:** `scores.intent` (0-100)  
- **Dot size:** base size, larger if account has a deal
- **Dot color:** quadrant-based (green = Prioritise, blue = Develop, amber = Nurture, grey = Deprioritise)
- **Tooltip:** account name, fit score, intent score, deal status if any

## New File

**`src/components/executive/ICPPerformanceMatrix.tsx`**

A standalone Card component using Recharts `ScatterChart` with:

- `effectiveOrgId` via `useEffectiveOrg()` hook
- React Query to fetch scores + account names + deal status in one query
- Quadrant lines drawn as `ReferenceLine` at x=50 and y=50
- Quadrant labels rendered as `ReferenceArea` or custom `Label` elements
- Quadrant summary counts shown below the chart (e.g., "Prioritise: 42 accounts")
- Loading skeleton while data fetches
- Empty state if no scores exist

## Technical Details

### Query (inside React Query)
```
supabase.from('scores')
  .select('fit, intent, overall, account_external_id, accounts!inner(name, industry_norm, revenue_range)')
  .eq('org_id', effectiveOrgId)
  .not('fit', 'is', null)
  .not('intent', 'is', null)
```

Then a secondary query to check for deals:
```
supabase.from('deals')
  .select('account_external_id, status, amount')
  .eq('org_id', effectiveOrgId)
```

### Recharts Components Used
- `ScatterChart`, `Scatter`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `ReferenceLine`, `ResponsiveContainer`, `ZAxis`
- All already available via `recharts ^2.15.4` (installed)

### Quadrant Classification Logic
```
fit >= 50 && intent >= 50  =>  "Prioritise" (green)
fit >= 50 && intent < 50   =>  "Develop" (blue)
fit < 50  && intent >= 50  =>  "Nurture" (amber)
fit < 50  && intent < 50   =>  "Deprioritise" (grey)
```

### Props Interface
The component is self-contained (fetches its own data), but accepts an optional `icpId` filter to scope to a specific ICP profile.

```typescript
interface ICPPerformanceMatrixProps {
  icpId?: string;  // optional filter to one ICP
}
```

### File Structure
| File | Action |
|------|--------|
| `src/components/executive/ICPPerformanceMatrix.tsx` | **Create** — standalone quadrant scatter chart |

No other files need changes for this standalone validation step. Integration into the dashboard will happen in a later step once the data mapping is confirmed.
