

# Fix "No accounts found" — Broken Sort in Database Function

## Problem
The Accounts page shows "No accounts found" with "Failed to load data" because the `get_filtered_accounts` database function crashes when executing its dynamic SQL `ORDER BY` clause.

The root cause: the function uses Postgres `format('%I', 'a.updated_at')` which produces `"a.updated_at"` (treating the whole string including the dot as one column name). Postgres then can't find a column literally named `a.updated_at` and throws: **column "a.updated_at" does not exist**.

## Fix

**Database migration** — Update the `get_filtered_accounts` function to avoid using `%I` with table-qualified column names. Instead, build the ORDER BY clause safely using a CASE statement (already partially done for the column mapping) and inject it directly with `%s` since the values are controlled by the CASE (not user input).

The CASE block already maps sort fields to qualified column references like `'a.updated_at'`, `'a.name'`, etc. The fix changes:

```sql
-- BEFORE (broken):
ORDER BY %I %s   -- %I quotes "a.updated_at" as a single identifier

-- AFTER (fixed):
ORDER BY ' || 
  CASE p_sort_field
    WHEN 'name' THEN 'a.name'
    WHEN 'industry_norm' THEN 'a.industry_norm'  
    WHEN 'country' THEN 'a.country'
    WHEN 'score' THEN 's.overall'
    ELSE 'a.updated_at'
  END || ' ' ||
  CASE WHEN p_sort_direction = 'asc' THEN 'ASC' ELSE 'DESC' END || '
LIMIT $11'
```

This is safe because both CASE outputs are hardcoded strings (no user input reaches the SQL text).

## Steps

1. Run a database migration to replace the `get_filtered_accounts` function with the fixed ORDER BY logic
2. No frontend code changes needed — the function signature and return type stay the same

