

# Wire Vertical Attributes into Scoring Engine

## What Changes

When an ICP has `vertical_filters` set (e.g., `{"ehr_system": "Epic", "bed_count_min": 100}`), accounts with matching `custom_attributes` will receive a score boost. This rewards accounts that match vertical-specific criteria without breaking existing scores for orgs that don't use custom attributes.

## Scoring Design

The current engine scores 4 dimensions out of 100 points:

| Dimension | Points |
|-----------|--------|
| Industry  | 30     |
| Size      | 25     |
| Geography | 25     |
| Revenue   | 20     |

We'll add a **vertical bonus** (up to 15 points) on top, similar to the existing compound match boost. This keeps the base scoring unchanged while rewarding vertical alignment.

**Vertical scoring logic:**
- For each key in `icp_rec.vertical_filters`, check if `account_rec.custom_attributes` has a matching value
- Text/select values: case-insensitive match
- Number `_min`/`_max` suffixes: numeric comparison (same pattern as the List Builder RPC)
- Array values (multi-select on the ICP side): check if account value is in the array
- Each matched vertical criterion earns points: `15 / total_vertical_criteria` (evenly distributed)
- The vertical score is added to `total_score`, capped at 100

The breakdown will include a new `vertical_score` field so it's visible in the UI.

## Technical Changes

### 1. New migration SQL -- update both scoring functions

**File: new migration**

Update `calculate_account_score` and `calculate_account_score_readonly` to:

1. Add a `vertical_score integer := 0` variable
2. After revenue scoring, add a vertical scoring block:

```sql
-- Vertical / custom attribute scoring (up to 15 points)
IF icp_rec.vertical_filters IS NOT NULL 
   AND icp_rec.vertical_filters != '{}'::jsonb
   AND account_rec.custom_attributes IS NOT NULL THEN
  DECLARE
    v_total_criteria integer := 0;
    v_matched_criteria integer := 0;
    v_key text;
    v_val jsonb;
  BEGIN
    FOR v_key, v_val IN SELECT * FROM jsonb_each(icp_rec.vertical_filters)
    LOOP
      -- Skip null/empty values
      IF v_val IS NULL OR v_val = 'null'::jsonb THEN CONTINUE; END IF;
      v_total_criteria := v_total_criteria + 1;

      IF v_key LIKE '%_min' THEN
        -- Numeric minimum
        IF (account_rec.custom_attributes ->> REPLACE(v_key, '_min', '')) IS NOT NULL
           AND (account_rec.custom_attributes ->> REPLACE(v_key, '_min', ''))::numeric 
               >= v_val::text::numeric THEN
          v_matched_criteria := v_matched_criteria + 1;
        END IF;
      ELSIF v_key LIKE '%_max' THEN
        -- Numeric maximum
        IF (account_rec.custom_attributes ->> REPLACE(v_key, '_max', '')) IS NOT NULL
           AND (account_rec.custom_attributes ->> REPLACE(v_key, '_max', ''))::numeric 
               <= v_val::text::numeric THEN
          v_matched_criteria := v_matched_criteria + 1;
        END IF;
      ELSIF jsonb_typeof(v_val) = 'array' THEN
        -- Multi-select: account value must be in the ICP array
        IF account_rec.custom_attributes ? v_key
           AND v_val @> to_jsonb(account_rec.custom_attributes ->> v_key) THEN
          v_matched_criteria := v_matched_criteria + 1;
        END IF;
      ELSE
        -- Text/select: case-insensitive match
        IF LOWER(COALESCE(account_rec.custom_attributes ->> v_key, '')) 
           = LOWER(v_val::text) THEN
          v_matched_criteria := v_matched_criteria + 1;
        END IF;
      END IF;
    END LOOP;

    IF v_total_criteria > 0 THEN
      vertical_score := ROUND(15.0 * v_matched_criteria / v_total_criteria)::integer;
      IF v_matched_criteria > 0 THEN
        matches := matches + 1;
      END IF;
    END IF;
  END;
END IF;
```

3. Add `vertical_score` to the total: `total_score := industry_score + size_score + geo_score + revenue_score + vertical_score;`
4. Cap at 100: the existing `LEAST(100, ...)` on the compound boost already handles this
5. Add `vertical_score` to the breakdown object in the return value

### 2. Update scoring version string

Change scoring version from `'sql_bulk_v1.1'` to `'sql_bulk_v2.0_vertical'` in `bulk_score_all_accounts` so rescored accounts are distinguishable.

### 3. Update score breakdown display (optional, if UI shows breakdown)

**File: check if breakdown is rendered anywhere in UI**

Add `vertical_score` to any breakdown display so users can see the vertical contribution. This is a small UI addition if the breakdown is shown.

## Summary

| What | Where |
|------|-------|
| Add vertical scoring block | `calculate_account_score` (RPC) |
| Add vertical scoring block | `calculate_account_score_readonly` (RPC) |
| Add `vertical_score` to breakdown | Both functions' return JSON |
| Bump scoring version | `bulk_score_all_accounts` |
| New migration file | `supabase/migrations/` |

No frontend changes required -- the scoring happens server-side. When users click "Score All" or score individual accounts, the vertical boost is automatically applied if the ICP has `vertical_filters` set.
