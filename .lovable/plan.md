
# Fix Market Coverage to Show ICP-Fit Accounts

## Problem
The "Market Coverage" KPI tile currently shows `totalAccounts / tamEstimate` -- meaning it counts **all** accounts in the system, not just those that actually fit the ICP. A scored account with a low-fit score (D band) shouldn't count as "covered."

## Correct Definition
**Market Coverage** = High-Fit accounts (A+B bands) as a percentage of total scored accounts. This answers: "Of all the accounts we've evaluated, how many actually match our ICP?"

## Technical Change

### File: `src/components/executive/GrowthCommandKPIs.tsx`

**Current logic (line 48):**
```
marketCoverage = totalAccounts / tamEstimate
```

**New logic:**
```
icpFitAccounts = highFitAccounts + medFitAccounts  (A+B bands)
marketCoverage = totalScored > 0 ? (icpFitAccounts / totalScored) * 100 : 0
```

**Props change:** Add `totalScored: number` and `medFitAccounts: number` to `GrowthCommandKPIsProps`.

**Tile updates:**
- Value: `{marketCoverage}%` (percentage of scored accounts that fit)
- "So what" text: `"{icpFitAccounts} of {totalScored} scored accounts match ICP (A+B bands)"`
- Remove TAM-based fallback logic (the TAM concept moves to the dedicated TAM card)

### File: `src/pages/ExecutiveDashboard.tsx`

Pass the two new props to `GrowthCommandKPIs`:
- `totalScored={totalScores}`
- `medFitAccounts={medFitAccounts}`

Both values are already computed in the dashboard page -- no new data fetching needed.

## Result
For Ninety One Life with ~16,000 scored accounts:
- High-fit: ~6,600 accounts
- Med-fit: ~2,800 accounts  
- Market Coverage becomes: (6,600 + 2,800) / 16,000 = ~59% ICP coverage
- Instead of the misleading raw count or TAM-based percentage
