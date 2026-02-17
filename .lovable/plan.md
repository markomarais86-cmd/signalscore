

# Fix TAM/SAM/SOM Definitions

## Problem

The Market Sizing card currently defines:
- **TAM** = all accounts in the system (wrong)
- **SAM** = high-fit accounts
- **SOM** = campaign-ready accounts

The user's correct definitions:
- **TAM** = accounts that fit the ICP (high-fit + medium-fit, A+B+C bands)
- **SAM** = serviceable subset of those (high-fit only, A+B bands)
- **SOM** = obtainable subset (campaign-ready accounts with conversion applied)

## Changes

### 1. `src/components/executive/SimpleTAMCard.tsx`

Add `medFitAccounts` to the props interface and redefine the calculations:

```
// CURRENT (wrong):
const tamAccounts = totalAccounts;

// NEW (correct):
const tamAccounts = highFitAccounts + medFitAccounts;  // ICP-fit = A+B+C bands
```

SAM and SOM logic stays the same (SAM = highFitAccounts, SOM = campaignReadyAccounts with conversion). Only TAM changes -- it narrows from "all accounts" to "accounts that match the ICP."

Update labels:
- TAM sublabel: "Total Market" becomes "ICP-Fit Market"
- Keep SAM as "Serviceable" and SOM as "Obtainable"

### 2. `src/pages/ExecutiveDashboard.tsx`

Pass `medFitAccounts` to `SimpleTAMCard`:

```tsx
<SimpleTAMCard
  totalAccounts={...}        // kept for reference but no longer used as TAM
  medFitAccounts={medFitAccounts}
  highFitAccounts={highFitAccounts}
  campaignReadyAccounts={campaignReadyAccounts}
  averageDealSize={averageDealSize}
  conversionRate={conversionRate}
/>
```

Also apply source filtering to `medFitAccounts` the same way `highFitAccounts` is filtered (database vs CRM vs all).

## Result

For Ninety One Life (16,000 scored accounts):
- **TAM**: ~9,400 accounts (6,600 high + 2,800 med) instead of 16,000
- **SAM**: ~6,600 accounts (high-fit only)
- **SOM**: campaign-ready subset with conversion rate applied

Dollar values scale accordingly using the average deal size.
