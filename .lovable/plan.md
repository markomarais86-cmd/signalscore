

# Auto-Detect Unmapped CSV Columns as Custom Attributes

## Overview

When a user uploads a CSV, many columns won't match standard system fields (e.g., `bed_count`, `ehr_system`, `churn_rate`). Currently these are silently skipped. This update will detect unmapped columns and offer to store them in `accounts.custom_attributes` JSONB, optionally matching them to existing `custom_attribute_definitions`.

## Changes

### 1. FieldMappingDialog.tsx -- Add "Custom Attribute" mapping option

**What changes:**
- After the standard system fields in each `<Select>`, add a separator and a "Map as Custom Attribute" option (value prefix `custom::<column_name>`)
- Fetch `custom_attribute_definitions` for the org via React Query
- If definitions exist, show them as named options (e.g., "Custom: Bed Count", "Custom: EHR System")
- Also offer a generic "Custom: [use column name]" catch-all option
- Add a new section at the bottom of the dialog showing unmapped columns count with a "Map all unmapped as custom attributes" bulk action button

**New props:**
- `orgId?: string` -- needed to fetch custom attribute definitions

**UI detail:**
- Unmapped columns get a subtle info banner: "3 columns are unmapped. Map as custom attributes?"
- Clicking "Map all as custom" auto-assigns each unmapped column to `custom::<column_key>`

### 2. DataUpload.tsx -- Pass custom mappings to upload logic

**What changes in the small-upload path (lines 268-335):**
- After building `reverseMapping`, separate entries into two groups: standard fields (existing behavior) and custom attributes (keys starting with `custom::`)
- For each row, collect custom-mapped values into a `custom_attributes` JSON object
- Include `custom_attributes` in the lead record inserted into the `Leads` table (if column exists) or hold for account enrichment

**What changes in the large-upload path (lines 207-265):**
- Pass the full mapping (including `custom::` prefixed keys) to the `bulk-upload` edge function

### 3. bulk-upload Edge Function -- Store custom attributes on accounts

**What changes in `supabase/functions/bulk-upload/index.ts`:**
- In the reverse mapping step (line 282-286), detect `custom::` prefixed mappings and separate them
- When building lead records, collect custom-mapped CSV values into a `custom_attributes` JSONB field on the lead
- After matching leads to accounts (post-matching step), propagate `custom_attributes` from leads to their matched accounts by merging into `accounts.custom_attributes` via a JSONB merge update:
  ```sql
  UPDATE accounts SET custom_attributes = COALESCE(custom_attributes, '{}'::jsonb) || new_attrs
  WHERE id = matched_account_id
  ```

### 4. FieldMappingDialog.tsx -- Visual distinction for custom mappings

- Custom attribute mappings shown with a distinct badge (e.g., purple "Custom" badge vs green "High Match")
- The bulk action button uses a `Package` or `Database` icon from lucide

## File Summary

| File | Change |
|------|--------|
| `src/components/data-upload/FieldMappingDialog.tsx` | Add custom attribute options to Select, bulk-map button, fetch definitions |
| `src/pages/DataUpload.tsx` | Handle `custom::` prefix in mapping for both small and large upload paths |
| `supabase/functions/bulk-upload/index.ts` | Parse `custom::` mappings, store on leads, propagate to accounts after matching |

## Technical Details

**Custom mapping key format:** `custom::field_key` (e.g., `custom::bed_count`, `custom::churn_rate`)

**Propagation flow:**
1. User maps CSV column "Bed Count" to `custom::bed_count`
2. Upload stores `{ "bed_count": "250" }` in lead's custom_attributes
3. After lead-to-account matching, the edge function merges those values into `accounts.custom_attributes`
4. If `bed_count` already exists in `custom_attribute_definitions`, the value is typed accordingly (number parsed, etc.)

**No schema migration needed** -- `accounts.custom_attributes` JSONB column already exists.

