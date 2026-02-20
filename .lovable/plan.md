
# Update Healthcare ICP Company Sizes

## Problem
The Healthcare ICP (`91.Life Heart+ - Hospital & Health System ICP`) has `company_sizes` of `[30, 50, 75, 100, 150, 300, 500]`. The maximum is 500 employees, but large hospital systems have 10,000-175,000+ employees. This causes all major hospital systems to score 0/15 on the size dimension.

## Change

Run a single SQL update to add 1000, 5000, and 10000 to the existing company_sizes array:

```sql
UPDATE icp_profiles
SET company_sizes = ARRAY[30, 50, 75, 100, 150, 300, 500, 1000, 5000, 10000]
WHERE id = 'f0d17a6b-6476-4e2d-a90f-9afc8d8e232b';
```

This extends the range from [30-500] to [30-10000], which covers the scoring function's range-based logic (accounts between min and max of the array earn size points).

## Impact

The scoring function (in the latest migration) uses range-based matching:
- It finds `MIN(company_sizes)` = 30 and `MAX(company_sizes)` = 10000
- Accounts with employee_count between 30 and 10000 earn full size points (15/15)
- Accounts above 10000 (e.g., CommonSpirit at 175,000) will still score partial points based on proximity

After updating, a **re-score** of the 232 hospital accounts will be needed to recalculate fit scores with the new size range. This can be triggered via the existing bulk scoring function.

## Expected Score Changes (examples)

| Hospital | Current Score | Expected Gain | New Score |
|----------|--------------|---------------|-----------|
| CommonSpirit Health | 85 | +8-15 pts | ~93-100 |
| AdventHealth | 93 | +0-7 pts | ~93-100 |
| Ascension | 65 | +8-15 pts | ~73-80 |
| Alberta Health | 50 | +8-15 pts | ~58-65 |

## Steps
1. Update the `company_sizes` array in the `icp_profiles` table (data update via SQL)
2. Trigger a re-score of hospital accounts to apply the new size dimension
