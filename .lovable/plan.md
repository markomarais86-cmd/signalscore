

# Phase 2: Integrate ICP Performance Matrix and Priority Revenue Accounts into the Dashboard

## Overview

Both components are already built and self-contained (they fetch their own data). This phase wires them into the Executive Dashboard layout in logical positions.

## Layout Changes

The current dashboard layout (after the KPI tiles) is:

1. Growth Command KPIs (5 tiles)
2. ICP Coverage Panel (fit distribution bar)
3. 3-column grid: ICP Table | TAM Card | Geography Card
4. 2-column grid: Data Health (1 col) | AI Insights (2 col)

After Phase 2:

1. Growth Command KPIs (5 tiles)
2. ICP Coverage Panel (fit distribution bar)
3. **ICP Performance Matrix** (full width -- the quadrant scatter chart)
4. 3-column grid: ICP Table | TAM Card | Geography Card
5. **Priority Revenue Accounts** (full width -- the sortable table)
6. 2-column grid: Data Health (1 col) | AI Insights (2 col)

The Matrix goes above the detail cards because it provides a visual overview of where accounts sit. The Priority table goes below the detail cards as the actionable "what to do next" section.

## File Changes

| File | Change |
|------|--------|
| `src/pages/ExecutiveDashboard.tsx` | Import and render `ICPPerformanceMatrix` and `PriorityRevenueAccounts` in the dashboard layout |

## Technical Details

### Imports to Add

```typescript
import { ICPPerformanceMatrix } from "@/components/executive/ICPPerformanceMatrix";
import { PriorityRevenueAccounts } from "@/components/executive/PriorityRevenueAccounts";
```

### Placement

After the `ICPCoveragePanel` block (~line 602), insert:
```tsx
<ICPPerformanceMatrix />
```

After the 3-column grid closing `</div>` (~line 639), insert:
```tsx
<PriorityRevenueAccounts />
```

Both components are self-contained -- no props needed. They use `useEffectiveOrg()` internally to scope data to the correct organization.

### No Other Changes

No props to thread, no new hooks, no new dependencies. Two import lines and two JSX lines.

