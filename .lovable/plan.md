

# Fix Accounts Page — Type Mismatch in Database Function

## Problem
The Accounts page still shows "No accounts found" / "Failed to load data" because of a **different error** than the one fixed previously. The error is:

> "Returned type integer does not match expected type numeric in column 14."

The `get_filtered_accounts` function (12-parameter overload) declares its return column `enrichment_overall_score` as type `numeric`, but the actual `accounts.enrichment_overall_score` column in the database is type `integer`. Postgres refuses to implicitly convert between these types in function return values.

## Fix

**Database migration** -- Cast `a.enrichment_overall_score` to `numeric` in the SELECT inside the function body.

Change line in the dynamic SQL from:
```
a.enrichment_overall_score,
```
to:
```
a.enrichment_overall_score::numeric,
```

This is a single-line change inside the existing `CREATE OR REPLACE FUNCTION` migration for the 12-parameter overload. The function signature and return type stay the same -- we just add a cast so the integer column matches the declared numeric return type.

## Technical Details

- **Affected overload**: The one with 12 parameters (includes `p_sort_field`, `p_sort_direction`)
- **Column 14 in return type**: `enrichment_overall_score numeric`
- **Actual column type**: `integer`
- **Solution**: `CAST(a.enrichment_overall_score AS numeric)` or `a.enrichment_overall_score::numeric`
- No frontend changes needed

