

# Make Custom Attributes Searchable in List Builder

## What This Does

Adds a new "Vertical" tab to the List Builder sidebar so you can filter accounts by custom attributes like EHR System, Facility Type, Bed Count, etc. When you select filters, the database query searches the `custom_attributes` JSONB column on accounts.

## Changes Overview

### 1. Database: Update the `search_list_builder` RPC

Add a new parameter `p_custom_attributes JSONB DEFAULT NULL` that accepts a JSON object of key-value pairs to match against `accounts.custom_attributes`.

Example input: `{"ehr_system": "Epic", "bed_count_min": 100}`

The filter logic will:
- For text/select values: exact match via `accounts.custom_attributes ->> 'key' ILIKE value`
- For number min/max: cast and compare via `(accounts.custom_attributes ->> 'key')::numeric >= value`

New migration file with `CREATE OR REPLACE FUNCTION` for the updated RPC.

### 2. Hook: Add `customAttributes` to filters

**File: `src/hooks/use-list-builder.ts`**

- Add `customAttributes: Record<string, string>` to `ListBuilderFilters` interface
- Add `customAttributes: {}` to `EMPTY_FILTERS`
- Pass `p_custom_attributes: Object.keys(filters.customAttributes).length > 0 ? filters.customAttributes : null` in the RPC call

### 3. UI: Add "Vertical" tab to SearchFilters

**File: `src/components/list-builder/SearchFilters.tsx`**

- Fetch `custom_attribute_definitions` for the org on mount
- Add a third tab "Vertical" (with a tag/layers icon) alongside Company and People
- For each definition, render the appropriate input:
  - `select` type: Input field for the value to match
  - `number` type: Min/max number inputs
  - `multi_select` type: Input field for comma-separated values
  - `text` type: Text input for partial match
- Store values in `filters.customAttributes` as `{ field_key: value }` (and `field_key_min`/`field_key_max` for numbers)
- Update the `activeCount` calculation to include custom attribute filters

### 4. Update the tab layout

Change from 2-column grid to 3-column grid for the tabs: Company | People | Vertical

## Technical Details

### New Migration SQL

```sql
CREATE OR REPLACE FUNCTION public.search_list_builder(
  -- existing params...
  p_custom_attributes JSONB DEFAULT NULL,
  p_page_offset INT DEFAULT 0,
  p_page_limit INT DEFAULT 50
)
-- In the filtered_accounts CTE, add:
AND (p_custom_attributes IS NULL OR (
  SELECT bool_and(
    CASE 
      WHEN key LIKE '%_min' THEN
        (a.custom_attributes ->> REPLACE(key, '_min', ''))::numeric >= (value)::numeric
      WHEN key LIKE '%_max' THEN
        (a.custom_attributes ->> REPLACE(key, '_max', ''))::numeric <= (value)::numeric
      ELSE
        a.custom_attributes ->> key ILIKE '%' || value::text || '%'
    END
  )
  FROM jsonb_each_text(p_custom_attributes)
))
```

### Files Modified

| File | Change |
|------|--------|
| New migration SQL | Add `p_custom_attributes` param to RPC |
| `src/hooks/use-list-builder.ts` | Add `customAttributes` to filter type and RPC call |
| `src/components/list-builder/SearchFilters.tsx` | Add Vertical tab with dynamic attribute inputs |

### No new dependencies needed
