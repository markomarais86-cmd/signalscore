

# Fix ICP Coverage Table: Show ICP-Fit (Not Just High-Fit) and Fix Database Row

## Problems

1. **"High-Fit" column only shows A+B band accounts (2,798)** -- it should show all ICP-fit accounts (A+B+C bands = high + medium = 9,414 for Ninety One Life).
2. **Database row shows 0** -- the Apollo data (1.1M accounts) exists in `external_data_sources` for the child org but wasn't loading due to the RLS policy issue fixed in the previous change. After that fix takes effect, the Database row should populate. However, the query may still need verification.
3. **Coverage percentage is misleading** -- currently shows `high-fit / total` (~17%), should show `ICP-fit / total` (~59%).

## Changes

### 1. `src/components/executive/SimpleICPTable.tsx`

- Add `medFitCrmAccounts` and `medFitDatabaseAccounts` (and `apolloMedFitEstimate`) props
- Rename column header from "High-Fit" to "ICP-Fit"
- Compute ICP-fit as `highFit + medFit` for each row
- Update coverage percentage to use ICP-fit / total
- Update the badge text from "X% High-Fit" to "X% ICP-Fit"

### 2. `src/pages/ExecutiveDashboard.tsx`

- Pass `medFitCrmAccounts` and `medFitDatabaseAccounts` to SimpleICPTable
- For Apollo medium-fit estimate, derive from existing Apollo data (similar to the high-fit estimate logic)

## Expected Result

For Ninety One Life:
- **CRM row**: Total 16,000 | ICP-Fit 9,414 (2,798 high + 6,616 med) | 59% ICP-Fit
- **Database row**: Shows Apollo data (1.1M accounts) once RLS fix propagates, with estimated ICP-fit percentage

